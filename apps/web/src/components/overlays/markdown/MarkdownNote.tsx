import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MARKDOWN_NOTE_SETTINGS, normalizeMarkdownOverlay } from '@ai-canvas/shared/schemas';
import type { MarkdownEditorMode, MarkdownOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
	EXCALIDRAW_FONT_OPTIONS,
	getExcalidrawFontFamily,
} from '@/components/canvas/excalidraw-element-style';
import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { appendBlock, createMarkdownImageToken, toggleMarkdownCheckboxLine } from './markdown-utils';
import { compressImageDataUrl, prewarmImageCache } from './markdown-media';
import { MarkdownPlainEditor } from './MarkdownPlainEditor';
import { MarkdownHybridEditor } from './MarkdownHybridEditor';
import { MarkdownRenderer } from './MarkdownRenderer';

type MarkdownElement = ExcalidrawElement & {
	customData: MarkdownOverlayCustomData;
};

interface MarkdownNoteProps {
	element: MarkdownElement;
	isSelected: boolean;
	onChange: (
		elementId: string,
		content: string,
		images?: Record<string, string>,
		settings?: MarkdownOverlayCustomData['settings'],
		editorMode?: MarkdownOverlayCustomData['editorMode'],
		elementStyle?: {
			backgroundColor?: string;
			strokeColor?: string;
		},
	) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

type MarkdownViewMode = MarkdownEditorMode | 'preview';

const FONT_OPTIONS = EXCALIDRAW_FONT_OPTIONS.map((option) => ({
	id: option.id,
	label: option.label,
	font: getExcalidrawFontFamily(option.family) ?? DEFAULT_MARKDOWN_NOTE_SETTINGS.font,
}));

const BACKGROUND_OPTIONS = ['transparent', '#ffffff', '#fce8e6', '#d4edda', '#cfe8ff', '#f6e58d'] as const;
const STROKE_OPTIONS = ['transparent', '#1e1e1e', '#e03131', '#2f9e44', '#1c7ed6', '#f08c00'] as const;
const NOTE_SEGMENTED_SHELL = 'inline-flex items-center rounded-[8px] border border-stone-200 bg-stone-50 p-[2px]';
const NOTE_SEGMENTED_BUTTON =
	'h-7 rounded-[6px] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] transition-colors';
const NOTE_SEGMENTED_ACTIVE = 'bg-[#eef0ff] text-[#4d55cc] shadow-sm';
const NOTE_SEGMENTED_IDLE = 'text-stone-600 hover:bg-[#f3f1ff] hover:text-[#4d55cc]';
const NOTE_TOOL_BUTTON =
	'inline-flex h-7 items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] transition-colors';
const NOTE_TOOL_IDLE = 'border-stone-300 bg-white text-stone-700 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';
const NOTE_PANEL = 'absolute right-0 top-[calc(100%+0.5rem)] z-20 rounded-[12px] border border-stone-200 bg-white p-3 shadow-xl';
const NOTE_SWATCH = 'h-7 w-7 rounded-[8px] border';
const NOTE_RESET_BUTTON =
	'rounded-[8px] border border-stone-300 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-600 transition-colors hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';

function getTransparentSwatchStyle() {
	return {
		backgroundColor: '#ffffff',
		backgroundImage:
			'linear-gradient(45deg, #d6d3d1 25%, transparent 25%, transparent 75%, #d6d3d1 75%, #d6d3d1), linear-gradient(45deg, #d6d3d1 25%, transparent 25%, transparent 75%, #d6d3d1 75%, #d6d3d1)',
		backgroundPosition: '0 0, 6px 6px',
		backgroundSize: '12px 12px',
	} as const;
}

export function MarkdownNote({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: MarkdownNoteProps) {
	const normalizedElement = useMemo(() => normalizeMarkdownOverlay(element.customData), [element.customData]);
	const [content, setContent] = useState(normalizedElement.content);
	const [images, setImages] = useState<Record<string, string>>(normalizedElement.images ?? {});
	const [settings, setSettings] = useState(normalizedElement.settings);
	const [editorMode, setEditorMode] = useState<MarkdownEditorMode>(normalizedElement.editorMode ?? 'raw');
	const [isPreview, setIsPreview] = useState(false);
	const [activeUtilityPanel, setActiveUtilityPanel] = useState<'none' | 'style' | 'image'>('none');
	const fileInputRef = useRef<HTMLInputElement>(null);
	const utilityPanelRef = useRef<HTMLDivElement | null>(null);
	const headerRef = useRef<HTMLDivElement | null>(null);
	const [headerWidth, setHeaderWidth] = useState(element.width);

	useEffect(() => {
		setContent(normalizedElement.content);
	}, [normalizedElement.content]);

	useEffect(() => {
		setImages(normalizedElement.images ?? {});
	}, [normalizedElement.images]);

	useEffect(() => {
		setSettings(normalizedElement.settings);
	}, [normalizedElement.settings]);

	useEffect(() => {
		const nextBackground = element.backgroundColor ?? DEFAULT_MARKDOWN_NOTE_SETTINGS.background;
		setSettings((current) =>
			current.background === nextBackground ? current : { ...current, background: nextBackground },
		);
	}, [element.backgroundColor]);

	useEffect(() => {
		setEditorMode(normalizedElement.editorMode ?? 'raw');
	}, [normalizedElement.editorMode]);

	useEffect(() => {
		if (!isSelected) {
			setActiveUtilityPanel('none');
			setIsPreview(true);
		}
	}, [isSelected]);

	useEffect(() => {
		const node = headerRef.current;
		if (!node) return;

		const updateWidth = () => {
			setHeaderWidth(node.getBoundingClientRect().width);
		};

		updateWidth();

		const resizeObserver = new ResizeObserver(() => updateWidth());
		resizeObserver.observe(node);
		return () => resizeObserver.disconnect();
	}, [element.id]);

	useEffect(() => {
		if (activeUtilityPanel === 'none') return;

		const handlePointerDown = (event: PointerEvent) => {
			if (!utilityPanelRef.current?.contains(event.target as Node)) {
				setActiveUtilityPanel('none');
			}
		};

		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, [activeUtilityPanel]);

	useEffect(() => {
		if (Object.keys(images).length > 0) prewarmImageCache(images);
	}, [images]);

	useEffect(() => {
		onEditingChange?.(isSelected && (!isPreview || activeUtilityPanel !== 'none'));
		return () => onEditingChange?.(false);
	}, [activeUtilityPanel, isPreview, isSelected, onEditingChange]);

	useEffect(() => {
		try {
			window.localStorage.setItem('md-note-defaults', JSON.stringify(settings));
		} catch {
			// ignore local storage failures
		}
	}, [settings]);

	useEffect(() => {
		if (isPreview && activeUtilityPanel === 'none') return;
		const timeout = window.setTimeout(() => {
			onChange(element.id, content, images, settings, editorMode);
		}, 180);
		return () => window.clearTimeout(timeout);
	}, [activeUtilityPanel, content, editorMode, element.id, images, isPreview, onChange, settings]);

	const hasLocalEdits =
		content !== normalizedElement.content ||
		JSON.stringify(images) !== JSON.stringify(normalizedElement.images ?? {}) ||
		JSON.stringify(settings) !== JSON.stringify(normalizedElement.settings) ||
		editorMode !== (normalizedElement.editorMode ?? 'raw');

	const insertImageFiles = async (fileList: FileList | null) => {
		if (!fileList?.length) return;

		const nextImages = { ...images };
		let nextContent = content;

		for (const file of Array.from(fileList)) {
			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(reader.error);
				reader.readAsDataURL(file);
			});

			const imageId = crypto.randomUUID();
			nextImages[imageId] = await compressImageDataUrl(dataUrl);
			nextContent = appendBlock(nextContent, createMarkdownImageToken(imageId, file.name || 'image'));
		}

		setImages(nextImages);
		setContent(nextContent);
		setActiveUtilityPanel('none');
	};

	const handleCommit = () => {
		onChange(element.id, content, images, settings, editorMode);
	};

	const activeMode: MarkdownViewMode = isPreview ? 'preview' : editorMode;
	const controlsLayout = headerWidth < 320 ? 'hidden' : headerWidth < 760 ? 'icon' : 'full';
	const compactTitle = headerWidth < 520;
	const surfaceBackground = element.backgroundColor ?? settings.background;
	const surfaceStroke = element.strokeColor ?? 'transparent';
	const surfaceOptions = BACKGROUND_OPTIONS.includes(surfaceBackground as (typeof BACKGROUND_OPTIONS)[number])
		? BACKGROUND_OPTIONS
		: [surfaceBackground, ...BACKGROUND_OPTIONS];
	const strokeOptions = STROKE_OPTIONS.includes(surfaceStroke as (typeof STROKE_OPTIONS)[number])
		? STROKE_OPTIONS
		: [surfaceStroke, ...STROKE_OPTIONS];

	const applySurfaceBackground = (backgroundColor: string) => {
		const nextSettings = { ...settings, background: backgroundColor };
		setSettings(nextSettings);
		onChange(element.id, content, images, nextSettings, editorMode, { backgroundColor });
	};

	const applySurfaceStroke = (strokeColor: string) => {
		onChange(element.id, content, images, settings, editorMode, { strokeColor });
	};

	useEffect(() => {
		if (controlsLayout === 'hidden') {
			setActiveUtilityPanel('none');
		}
	}, [controlsLayout]);

	return (
		<OverlaySurface
			element={element}
			isSelected={isSelected}
			backgroundColor={surfaceBackground}
			className="flex h-full flex-col"
		>
			<div
				ref={headerRef}
				className={`relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 bg-stone-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500 ${
					isSelected ? 'border-b border-stone-200' : ''
				}`}
			>
				<div className="flex min-w-0 items-center gap-2">
					<span>{compactTitle ? 'MD' : 'Markdown'}</span>
					{hasLocalEdits ? <span className="text-[10px] text-amber-600">Unsaved</span> : null}
				</div>
				<div className="flex items-center justify-center">
					{controlsLayout !== 'hidden' ? (
						<div className={NOTE_SEGMENTED_SHELL}>
							{([
								{ mode: 'raw', label: 'Raw', icon: 'raw' },
								{ mode: 'hybrid', label: 'Hybrid', icon: 'hybrid' },
								{ mode: 'preview', label: 'Preview', icon: 'preview' },
							] as const).map(({ mode, label, icon }) => (
								<button
									key={mode}
									type="button"
									title={label}
									aria-label={label}
									disabled={!isSelected}
									className={`${NOTE_SEGMENTED_BUTTON} ${
										activeMode === mode ? NOTE_SEGMENTED_ACTIVE : NOTE_SEGMENTED_IDLE
									} ${!isSelected ? 'cursor-default opacity-70 hover:bg-transparent hover:text-inherit' : ''}`}
									onClick={() => {
										if (!isSelected) return;
										if (mode === 'preview') {
											handleCommit();
											setIsPreview(true);
											return;
										}
										setEditorMode(mode);
										setIsPreview(false);
									}}
								>
									{controlsLayout === 'icon' ? (
										icon === 'raw' ? (
											<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="m18 16 4-4-4-4" />
												<path d="m6 8-4 4 4 4" />
												<path d="m14.5 4-5 16" />
											</svg>
										) : icon === 'hybrid' ? (
											<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<rect x="3" y="4" width="7" height="7" rx="1.5" />
												<rect x="14" y="4" width="7" height="7" rx="1.5" />
												<rect x="3" y="14" width="7" height="7" rx="1.5" />
												<path d="M14 18h7" />
											</svg>
										) : (
											<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
												<circle cx="12" cy="12" r="3" />
											</svg>
										)
									) : (
										label
									)}
								</button>
							))}
						</div>
					) : null}
				</div>
				<div className="flex items-center justify-end">
					{controlsLayout !== 'hidden' ? (
						<div className="relative" ref={utilityPanelRef}>
							<button
								type="button"
								title="Options"
								aria-label="Options"
								disabled={!isSelected}
								className={`${NOTE_TOOL_BUTTON} ${
									activeUtilityPanel !== 'none' ? 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]' : NOTE_TOOL_IDLE
								} ${!isSelected ? 'cursor-default opacity-70 hover:bg-white hover:text-stone-700' : ''}`}
								onClick={() =>
									setActiveUtilityPanel((current) => {
										if (!isSelected) return 'none';
										return current === 'none' ? 'style' : 'none';
									})
								}
							>
								<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M4 12h16" />
									<path d="M4 6h16" />
									<path d="M4 18h16" />
								</svg>
								{controlsLayout === 'full' ? 'Options' : null}
							</button>
							{activeUtilityPanel === 'style' ? (
								<div className={`${NOTE_PANEL} w-[19rem]`}>
									<div className={`mb-3 ${NOTE_SEGMENTED_SHELL}`}>
										<button
											type="button"
											className={`${NOTE_SEGMENTED_BUTTON} ${NOTE_SEGMENTED_ACTIVE}`}
										>
											Style
										</button>
										<button
											type="button"
											onClick={() => setActiveUtilityPanel('image')}
											className={`${NOTE_SEGMENTED_BUTTON} ${NOTE_SEGMENTED_IDLE}`}
										>
											Image
										</button>
									</div>
									<div className="grid grid-cols-2 gap-3 text-[11px] text-stone-600">
										<label className="space-y-1.5">
											<span className="block font-semibold uppercase tracking-[0.18em] text-stone-500">
												Font
											</span>
											<select
												value={settings.font}
												onChange={(event) =>
													setSettings((current) => ({ ...current, font: event.target.value }))
												}
												className="w-full rounded-[8px] border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-700"
											>
												{FONT_OPTIONS.map((option) => (
													<option key={option.id} value={option.font}>
														{option.label}
													</option>
												))}
											</select>
										</label>
										<label className="space-y-1.5">
											<span className="block font-semibold uppercase tracking-[0.18em] text-stone-500">
												Size
											</span>
											<input
												type="range"
												min="12"
												max="28"
												value={settings.fontSize}
												onChange={(event) =>
													setSettings((current) => ({
														...current,
														fontSize: Number(event.target.value),
													}))
												}
												className="w-full"
											/>
										</label>
										<label className="space-y-1.5">
											<span className="block font-semibold uppercase tracking-[0.18em] text-stone-500">
												Leading
											</span>
											<input
												type="range"
												min="1.2"
												max="2.2"
												step="0.05"
												value={settings.lineHeight}
												onChange={(event) =>
													setSettings((current) => ({
														...current,
														lineHeight: Number(event.target.value),
													}))
												}
												className="w-full"
											/>
										</label>
										<div className="space-y-1.5">
											<span className="block font-semibold uppercase tracking-[0.18em] text-stone-500">
												Surface
											</span>
											<div className="flex flex-wrap gap-2">
												{surfaceOptions.map((color) => (
													<button
														key={color}
														type="button"
														aria-label={`Background ${color}`}
														onClick={() => applySurfaceBackground(color)}
														className={`${NOTE_SWATCH} ${
															surfaceBackground === color
																? 'border-stone-900'
																: 'border-stone-300'
														}`}
														style={color === 'transparent' ? getTransparentSwatchStyle() : { background: color }}
													/>
												))}
												<div className="mt-2 flex w-full flex-wrap gap-2">
													<span className="w-full text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500">
														Stroke
													</span>
													{strokeOptions.map((color) => (
														<button
															key={color}
															type="button"
															aria-label={`Stroke ${color}`}
															onClick={() => applySurfaceStroke(color)}
															className={`${NOTE_SWATCH} ${
																surfaceStroke === color ? 'border-stone-900' : 'border-stone-300'
															}`}
															style={color === 'transparent' ? getTransparentSwatchStyle() : { background: color }}
														/>
													))}
												</div>
												<button
													type="button"
													onClick={() => {
														setSettings(DEFAULT_MARKDOWN_NOTE_SETTINGS);
														onChange(
															element.id,
															content,
															images,
															DEFAULT_MARKDOWN_NOTE_SETTINGS,
															editorMode,
															{
																backgroundColor: DEFAULT_MARKDOWN_NOTE_SETTINGS.background,
																strokeColor: 'transparent',
															},
														);
													}}
													className={NOTE_RESET_BUTTON}
												>
													Reset
												</button>
											</div>
										</div>
									</div>
								</div>
							) : null}
							{activeUtilityPanel === 'image' ? (
								<div className={`${NOTE_PANEL} w-[18rem]`}>
									<div className={`mb-3 ${NOTE_SEGMENTED_SHELL}`}>
										<button
											type="button"
											onClick={() => setActiveUtilityPanel('style')}
											className={`${NOTE_SEGMENTED_BUTTON} ${NOTE_SEGMENTED_IDLE}`}
										>
											Style
										</button>
										<button
											type="button"
											className={`${NOTE_SEGMENTED_BUTTON} ${NOTE_SEGMENTED_ACTIVE}`}
										>
											Image
										</button>
									</div>
									<div className="mt-3 space-y-3">
										<button
											type="button"
											onClick={() => fileInputRef.current?.click()}
											className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d7dafd] bg-[#eef0ff] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#4d55cc]"
										>
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
												<path d="M7 10l5-5 5 5" />
												<path d="M12 15V5" />
											</svg>
											Upload image
										</button>
										<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-2.5 py-2.5 text-[11px] text-stone-500">
											<div>
												{Object.keys(images).length} image{Object.keys(images).length === 1 ? '' : 's'} attached to this note.
											</div>
											<div className="mt-1">You can also paste images directly while editing in raw or hybrid mode.</div>
										</div>
									</div>
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</div>

			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				multiple
				className="hidden"
				onChange={(event) => {
					void insertImageFiles(event.target.files);
					event.currentTarget.value = '';
				}}
			/>

			<div
				className="min-h-0 flex-1"
				onDoubleClick={() => {
					if (isSelected && isPreview) setIsPreview(false);
				}}
			>
				{!isPreview ? (
					editorMode === 'hybrid' ? (
						<MarkdownHybridEditor
							content={content}
							images={images}
							settings={settings}
							onChange={setContent}
							onImageAdd={(id, dataUrl) => setImages((current) => ({ ...current, [id]: dataUrl }))}
							onCheckboxToggle={(lineIndex) => {
								setContent((current) => toggleMarkdownCheckboxLine(current, lineIndex));
							}}
						/>
					) : (
						<MarkdownPlainEditor
							value={content}
							images={images}
							settings={settings}
							onChange={setContent}
							onImageAdd={(id, dataUrl) => setImages((current) => ({ ...current, [id]: dataUrl }))}
						/>
					)
				) : (
					<div className="h-full overflow-auto p-4">
						<MarkdownRenderer
							content={content}
							images={images}
							settings={settings}
							onCheckboxToggle={(lineIndex) => {
								const nextContent = toggleMarkdownCheckboxLine(content, lineIndex);
								setContent(nextContent);
								onChange(element.id, nextContent, images, settings, editorMode);
							}}
						/>
					</div>
				)}
			</div>
		</OverlaySurface>
	);
}
