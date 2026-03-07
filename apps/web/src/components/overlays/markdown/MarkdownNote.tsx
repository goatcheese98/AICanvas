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
		title?: string,
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
type UtilityPanel = 'none' | 'style' | 'image';
type ControlsLayout = 'hidden' | 'icon' | 'full';

const FONT_OPTIONS = EXCALIDRAW_FONT_OPTIONS.map((option) => ({
	id: option.id,
	label: option.label,
	font: getExcalidrawFontFamily(option.family) ?? DEFAULT_MARKDOWN_NOTE_SETTINGS.font,
}));

const MODE_OPTIONS = [
	{ mode: 'raw', label: 'Raw', icon: 'raw' },
	{ mode: 'hybrid', label: 'Hybrid', icon: 'hybrid' },
	{ mode: 'preview', label: 'Preview', icon: 'preview' },
] as const;

const NOTE_SEGMENTED_SHELL =
	'inline-flex items-center rounded-[8px] border border-stone-200 bg-stone-50 p-[2px]';
const NOTE_SEGMENTED_BUTTON =
	'h-7 rounded-[6px] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] transition-colors';
const NOTE_SEGMENTED_ACTIVE = 'bg-[var(--color-accent-bg)] text-[var(--color-accent-text)] shadow-sm';
const NOTE_SEGMENTED_IDLE =
	'text-stone-600 hover:bg-[var(--color-accent-hover)] hover:text-[var(--color-accent-text)]';
const NOTE_TOOL_BUTTON =
	'inline-flex h-7 items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] transition-colors';
const NOTE_TOOL_IDLE =
	'border-stone-300 bg-white text-stone-700 hover:border-[var(--color-accent-border)] hover:bg-[var(--color-accent-hover)] hover:text-[var(--color-accent-text)]';
const NOTE_PANEL =
	'absolute right-0 top-[calc(100%+0.5rem)] z-20 rounded-[12px] border border-stone-200 bg-white p-3 shadow-xl';
const NOTE_RESET_BUTTON =
	'rounded-[8px] border border-stone-300 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-600 transition-colors hover:border-[var(--color-accent-border)] hover:bg-[var(--color-accent-hover)] hover:text-[var(--color-accent-text)]';
const MAX_MARKDOWN_TITLE_LENGTH = 8;
const TITLE_COMPACT_BREAKPOINT = 220;

function abbreviateMarkdownTitle(title: string) {
	const compact = title.replace(/\s+/g, '');
	return (compact.slice(0, 2) || title.slice(0, 2) || 'MD').toUpperCase();
}

function renderModeIcon(icon: (typeof MODE_OPTIONS)[number]['icon']) {
	if (icon === 'raw') {
		return (
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
				<path d="m18 16 4-4-4-4" />
				<path d="m6 8-4 4 4 4" />
				<path d="m14.5 4-5 16" />
			</svg>
		);
	}
	if (icon === 'hybrid') {
		return (
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
				<rect x="3" y="4" width="7" height="7" rx="1.5" />
				<rect x="14" y="4" width="7" height="7" rx="1.5" />
				<rect x="3" y="14" width="7" height="7" rx="1.5" />
				<path d="M14 18h7" />
			</svg>
		);
	}
	return (
		<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}

export function MarkdownNote({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: MarkdownNoteProps) {
	const normalizedElement = useMemo(() => normalizeMarkdownOverlay(element.customData), [element.customData]);
	const [title, setTitle] = useState(normalizedElement.title);
	const [content, setContent] = useState(normalizedElement.content);
	const [images, setImages] = useState<Record<string, string>>(normalizedElement.images ?? {});
	const [settings, setSettings] = useState(normalizedElement.settings);
	const [editorMode, setEditorMode] = useState<MarkdownEditorMode>(normalizedElement.editorMode ?? 'raw');
	const [isPreview, setIsPreview] = useState(false);
	const [activeUtilityPanel, setActiveUtilityPanel] = useState<UtilityPanel>('none');
	const [isCompactControlsVisible, setIsCompactControlsVisible] = useState(false);
	const [titleNotice, setTitleNotice] = useState(false);
	const [headerWidth, setHeaderWidth] = useState(element.width);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const utilityPanelRef = useRef<HTMLDivElement | null>(null);
	const headerRef = useRef<HTMLDivElement | null>(null);
	const titleNoticeTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		setTitle(normalizedElement.title);
	}, [normalizedElement.title]);

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
			setIsCompactControlsVisible(false);
			setIsPreview(true);
		}
	}, [isSelected]);

	useEffect(
		() => () => {
			if (titleNoticeTimeoutRef.current !== null) {
				window.clearTimeout(titleNoticeTimeoutRef.current);
			}
		},
		[],
	);

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
	}, [element.id, element.width, isSelected, settings.autoHideToolbar]);

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
			onChange(element.id, content, images, title, settings, editorMode);
		}, 180);
		return () => window.clearTimeout(timeout);
	}, [activeUtilityPanel, content, editorMode, element.id, images, isPreview, onChange, settings, title]);

	const hasLocalEdits =
		title !== normalizedElement.title ||
		content !== normalizedElement.content ||
		JSON.stringify(images) !== JSON.stringify(normalizedElement.images ?? {}) ||
		JSON.stringify(settings) !== JSON.stringify(normalizedElement.settings) ||
		editorMode !== (normalizedElement.editorMode ?? 'raw');

	const showHeader = isSelected || !settings.autoHideToolbar;
	const effectiveHeaderWidth = showHeader && headerWidth > 0 ? headerWidth : element.width;
	const controlsLayout: ControlsLayout =
		effectiveHeaderWidth < 320 ? 'hidden' : effectiveHeaderWidth < 760 ? 'icon' : 'full';
	const compactTitle = effectiveHeaderWidth < TITLE_COMPACT_BREAKPOINT;
	const activeMode: MarkdownViewMode = isPreview ? 'preview' : editorMode;
	const surfaceBackground = element.backgroundColor ?? settings.background;
	const showCompactControls =
		isSelected && controlsLayout === 'hidden' && (isCompactControlsVisible || activeUtilityPanel !== 'none');

	useEffect(() => {
		if (controlsLayout !== 'hidden') {
			setIsCompactControlsVisible(false);
		}
	}, [controlsLayout]);

	const handleCommit = () => {
		onChange(element.id, content, images, title, settings, editorMode);
	};

	const showTitleLimitNotice = () => {
		setTitleNotice(true);
		if (titleNoticeTimeoutRef.current !== null) {
			window.clearTimeout(titleNoticeTimeoutRef.current);
		}
		titleNoticeTimeoutRef.current = window.setTimeout(() => {
			setTitleNotice(false);
			titleNoticeTimeoutRef.current = null;
		}, 1800);
	};

	const handleTitleChange = (nextValue: string) => {
		if (nextValue.length > MAX_MARKDOWN_TITLE_LENGTH) {
			showTitleLimitNotice();
			setTitle(nextValue.slice(0, MAX_MARKDOWN_TITLE_LENGTH));
			return;
		}
		setTitle(nextValue);
	};

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

	const renderModeSwitcher = (layout: Exclude<ControlsLayout, 'hidden'>) => (
		<div className={NOTE_SEGMENTED_SHELL}>
			{MODE_OPTIONS.map(({ mode, label, icon }) => (
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
					{layout === 'icon' ? renderModeIcon(icon) : label}
				</button>
			))}
		</div>
	);

	const renderUtilityPanel = () => (
		<>
			{activeUtilityPanel === 'style' ? (
				<div className={`${NOTE_PANEL} w-[19rem]`}>
					<div className={`mb-3 ${NOTE_SEGMENTED_SHELL}`}>
						<button type="button" className={`${NOTE_SEGMENTED_BUTTON} ${NOTE_SEGMENTED_ACTIVE}`}>
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
						<button
							type="button"
							role="switch"
							aria-checked={settings.showEmptyLines}
							onClick={() =>
								setSettings((current) => ({
									...current,
									showEmptyLines: !current.showEmptyLines,
								}))
							}
							className={`col-span-2 flex items-center justify-between rounded-[8px] border px-3 py-3 text-left transition-colors ${
								settings.showEmptyLines
									? 'border-[var(--color-accent-border)] bg-[var(--color-accent-hover)]'
									: 'border-stone-200 bg-stone-50 hover:border-[var(--color-accent-border)] hover:bg-[var(--color-accent-hover)]'
							}`}
						>
							<div className="pr-4">
								<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
									Show Empty Lines
								</div>
								<div className="mt-1 text-[11px] text-stone-500">
									Keep blank rows visible in hybrid mode.
								</div>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-text)]">
									{settings.showEmptyLines ? 'On' : 'Off'}
								</span>
								<span
									className={`inline-flex h-8 w-14 items-center rounded-[999px] border px-1 transition-colors ${
										settings.showEmptyLines
											? 'justify-end border-[var(--color-accent-border)] bg-[var(--color-accent-bg)]'
											: 'justify-start border-stone-300 bg-white'
									}`}
								>
									<span className="h-6 w-6 rounded-full bg-white shadow-sm" />
								</span>
							</div>
						</button>
						<button
							type="button"
							role="switch"
							aria-checked={settings.autoHideToolbar}
							onClick={() =>
								setSettings((current) => ({
									...current,
									autoHideToolbar: !current.autoHideToolbar,
								}))
							}
							className={`col-span-2 flex items-center justify-between rounded-[8px] border px-3 py-3 text-left transition-colors ${
								settings.autoHideToolbar
									? 'border-[var(--color-accent-border)] bg-[var(--color-accent-hover)]'
									: 'border-stone-200 bg-stone-50 hover:border-[var(--color-accent-border)] hover:bg-[var(--color-accent-hover)]'
							}`}
						>
							<div className="pr-4">
								<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
									Auto-hide Toolbar
								</div>
								<div className="mt-1 text-[11px] text-stone-500">
									Hide the top controls whenever this note is not selected.
								</div>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-text)]">
									{settings.autoHideToolbar ? 'On' : 'Off'}
								</span>
								<span
									className={`inline-flex h-8 w-14 items-center rounded-[999px] border px-1 transition-colors ${
										settings.autoHideToolbar
											? 'justify-end border-[var(--color-accent-border)] bg-[var(--color-accent-bg)]'
											: 'justify-start border-stone-300 bg-white'
									}`}
								>
									<span className="h-6 w-6 rounded-full bg-white shadow-sm" />
								</span>
							</div>
						</button>
						<div className="col-span-2 flex justify-start">
							<button
								type="button"
								onClick={() => setSettings(DEFAULT_MARKDOWN_NOTE_SETTINGS)}
								className={NOTE_RESET_BUTTON}
							>
								Reset
							</button>
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
						<button type="button" className={`${NOTE_SEGMENTED_BUTTON} ${NOTE_SEGMENTED_ACTIVE}`}>
							Image
						</button>
					</div>
					<div className="mt-3 space-y-3">
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-text)]"
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
		</>
	);

	const renderOptionsButton = (layout: Exclude<ControlsLayout, 'hidden'>) => (
		<div className="relative" ref={utilityPanelRef}>
			<button
				type="button"
				title="Options"
				aria-label="Options"
				disabled={!isSelected}
				className={`${NOTE_TOOL_BUTTON} ${
					activeUtilityPanel !== 'none'
						? 'border-[var(--color-accent-border)] bg-[var(--color-accent-bg)] text-[var(--color-accent-text)]'
						: NOTE_TOOL_IDLE
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
				{layout === 'full' ? 'Options' : null}
			</button>
			{renderUtilityPanel()}
		</div>
	);

	return (
		<OverlaySurface
			element={element}
			isSelected={isSelected}
			backgroundColor={surfaceBackground}
			className="relative flex h-full flex-col"
		>
			{showHeader ? (
				<div
					ref={headerRef}
					className={`relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 bg-stone-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500 ${
						isSelected ? 'border-b border-stone-200' : ''
					}`}
				>
					<div className="flex min-w-0 items-center gap-2">
						{isSelected && !compactTitle ? (
							<div className="min-w-0">
								<input
									type="text"
									value={title}
									maxLength={MAX_MARKDOWN_TITLE_LENGTH}
									onChange={(event) => handleTitleChange(event.target.value)}
									onPaste={(event) => {
										const pasted = event.clipboardData.getData('text');
										if (event.currentTarget.value.length + pasted.length > MAX_MARKDOWN_TITLE_LENGTH) {
											showTitleLimitNotice();
										}
									}}
									onBlur={() => {
										const trimmedTitle = title.trim();
										setTitle(trimmedTitle.length > 0 ? trimmedTitle : normalizedElement.title);
									}}
									className="w-full min-w-0 rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-600 outline-none transition-colors focus:border-[var(--color-accent-border)] focus:bg-white"
									aria-label="Markdown title"
								/>
								{titleNotice ? (
									<div className="mt-1 text-[10px] font-semibold normal-case tracking-normal text-amber-600">
										Title is limited to 8 characters.
									</div>
								) : null}
							</div>
						) : (
							<span className="truncate">{compactTitle ? 'MD' : title}</span>
						)}
						{hasLocalEdits ? <span className="text-[10px] text-amber-600">Unsaved</span> : null}
					</div>
					<div
						className="flex items-center justify-center"
						onMouseEnter={() => {
							if (isSelected && controlsLayout === 'hidden') setIsCompactControlsVisible(true);
						}}
					>
						{controlsLayout === 'hidden' ? <div className="h-7 w-28" /> : renderModeSwitcher(controlsLayout)}
					</div>
					<div
						className="flex items-center justify-end"
						onMouseEnter={() => {
							if (isSelected && controlsLayout === 'hidden') setIsCompactControlsVisible(true);
						}}
						onMouseLeave={() => {
							if (isSelected && controlsLayout === 'hidden' && activeUtilityPanel === 'none') {
								setIsCompactControlsVisible(false);
							}
						}}
					>
						{controlsLayout === 'hidden' ? <div className="h-7 w-16" /> : renderOptionsButton(controlsLayout)}
					</div>
					{showCompactControls ? (
						<div
							className="absolute inset-y-0 left-[5.25rem] right-3 z-20 flex items-center justify-between bg-stone-100/95"
							onMouseEnter={() => setIsCompactControlsVisible(true)}
							onMouseLeave={() => {
								if (activeUtilityPanel === 'none') setIsCompactControlsVisible(false);
							}}
						>
							<div className="flex flex-1 justify-center">{renderModeSwitcher('icon')}</div>
							<div className="ml-3 shrink-0">{renderOptionsButton('icon')}</div>
						</div>
					) : null}
				</div>
			) : null}

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
								onChange(element.id, nextContent, images, title, settings, editorMode);
							}}
						/>
					</div>
				)}
			</div>
		</OverlaySurface>
	);
}
