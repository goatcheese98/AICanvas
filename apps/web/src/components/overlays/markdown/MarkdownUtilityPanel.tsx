import type { RefObject } from 'react';
import { DEFAULT_MARKDOWN_NOTE_SETTINGS } from '@ai-canvas/shared/schemas';
import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
	FONT_OPTIONS_WITH_MARKDOWN_EXTRAS,
	NOTE_EDGE_OPTIONS,
	NOTE_PANEL,
	NOTE_RESET_BUTTON,
	NOTE_SEGMENTED_ACTIVE,
	NOTE_SEGMENTED_BUTTON,
	NOTE_SEGMENTED_IDLE,
	NOTE_SEGMENTED_SHELL,
	NOTE_TOOL_BUTTON,
	NOTE_TOOL_IDLE,
	getRoundnessOptionId,
} from './markdown-note-helpers';

interface MarkdownUtilityPanelProps {
	layout: 'icon' | 'full';
	isSelected: boolean;
	activeUtilityPanel: 'none' | 'style' | 'image';
	utilityPanelRef: RefObject<HTMLDivElement | null>;
	surfaceBackground: string;
	strokeColor: string;
	strokeWidth: number;
	roundness: ExcalidrawElement['roundness'] | undefined;
	settings: MarkdownNoteSettings;
	imageCount: number;
	onActiveUtilityPanelChange: (
		next:
			| 'none'
			| 'style'
			| 'image'
			| ((current: 'none' | 'style' | 'image') => 'none' | 'style' | 'image'),
	) => void;
	onSurfaceStyleChange: (elementStyle: {
		backgroundColor?: string;
		strokeColor?: string;
		strokeWidth?: number;
		roundness?: ExcalidrawElement['roundness'];
	}) => void;
	onSettingsChange: (
		updater: (current: MarkdownNoteSettings) => MarkdownNoteSettings,
	) => void;
	onRequestImagePicker: () => void;
}

export function MarkdownUtilityPanel({
	layout,
	isSelected,
	activeUtilityPanel,
	utilityPanelRef,
	surfaceBackground,
	strokeColor,
	strokeWidth,
	roundness,
	settings,
	imageCount,
	onActiveUtilityPanelChange,
	onSurfaceStyleChange,
	onSettingsChange,
	onRequestImagePicker,
}: MarkdownUtilityPanelProps) {
	const renderPanel = () => (
		<>
			{activeUtilityPanel === 'style' ? (
				<div className={`${NOTE_PANEL} w-[19rem]`}>
					<div className={`mb-3 ${NOTE_SEGMENTED_SHELL}`}>
						<button type="button" className={`${NOTE_SEGMENTED_BUTTON} ${NOTE_SEGMENTED_ACTIVE}`}>
							Style
						</button>
						<button
							type="button"
							onClick={() => onActiveUtilityPanelChange('image')}
							className={`${NOTE_SEGMENTED_BUTTON} ${NOTE_SEGMENTED_IDLE}`}
						>
							Image
						</button>
					</div>
					<div className="grid grid-cols-2 gap-3 text-[11px] text-stone-600">
						<label className="space-y-1.5">
							<span className="block font-semibold uppercase tracking-[0.18em] text-stone-500">
								Fill
							</span>
							<div className="flex items-center gap-2 rounded-[8px] border border-stone-200 bg-stone-50 px-2.5 py-2">
								<input
									type="color"
									value={surfaceBackground}
									onChange={(event) =>
										onSurfaceStyleChange({
											backgroundColor: event.target.value,
										})
									}
									className="h-9 w-11 cursor-pointer rounded-[8px] border border-stone-300 bg-white p-1"
								/>
								<span className="text-[11px] text-stone-500">{surfaceBackground}</span>
							</div>
						</label>
						<label className="space-y-1.5">
							<span className="block font-semibold uppercase tracking-[0.18em] text-stone-500">
								Border
							</span>
							<div className="flex items-center gap-2 rounded-[8px] border border-stone-200 bg-stone-50 px-2.5 py-2">
								<input
									type="color"
									value={strokeColor}
									onChange={(event) =>
										onSurfaceStyleChange({
											strokeColor: event.target.value,
										})
									}
									className="h-9 w-11 cursor-pointer rounded-[8px] border border-stone-300 bg-white p-1"
								/>
								<span className="text-[11px] text-stone-500">{strokeColor}</span>
							</div>
						</label>
						<label className="space-y-1.5">
							<span className="block font-semibold uppercase tracking-[0.18em] text-stone-500">
								Stroke Width
							</span>
							<div className="rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2">
								<input
									type="range"
									min="1"
									max="6"
									step="1"
									value={strokeWidth}
									onChange={(event) =>
										onSurfaceStyleChange({
											strokeWidth: Number(event.target.value),
										})
									}
									className="w-full"
								/>
								<div className="mt-1 text-[11px] text-stone-500">{strokeWidth}px</div>
							</div>
						</label>
						<label className="space-y-1.5">
							<span className="block font-semibold uppercase tracking-[0.18em] text-stone-500">
								Edges
							</span>
							<select
								value={getRoundnessOptionId(roundness)}
								onChange={(event) => {
									const selected = NOTE_EDGE_OPTIONS.find((option) => option.id === event.target.value);
									onSurfaceStyleChange({
										roundness: selected?.roundness ?? null,
									});
								}}
								className="w-full rounded-[8px] border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-700"
							>
								{NOTE_EDGE_OPTIONS.map((option) => (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1.5">
							<span className="block font-semibold uppercase tracking-[0.18em] text-stone-500">
								Font
							</span>
							<select
								value={settings.font}
								onChange={(event) =>
									onSettingsChange((current) => ({ ...current, font: event.target.value }))
								}
								className="w-full rounded-[8px] border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-700"
							>
								{FONT_OPTIONS_WITH_MARKDOWN_EXTRAS.map((option) => (
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
								min="8"
								max="28"
								value={settings.fontSize}
								onChange={(event) =>
									onSettingsChange((current) => ({
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
									onSettingsChange((current) => ({
										...current,
										lineHeight: Number(event.target.value),
									}))
								}
								className="w-full"
							/>
						</label>
						<label className="col-span-2 space-y-1.5">
							<span className="block font-semibold uppercase tracking-[0.18em] text-stone-500">
								Inline Color
							</span>
							<div className="flex items-center gap-3 rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2">
								<input
									type="color"
									value={settings.inlineCodeColor}
									onChange={(event) =>
										onSettingsChange((current) => ({
											...current,
											inlineCodeColor: event.target.value,
										}))
									}
									className="h-9 w-11 cursor-pointer rounded-[8px] border border-stone-300 bg-white p-1"
								/>
								<div className="min-w-0 flex-1">
									<div
										className="inline-flex max-w-full items-center rounded-[6px] border px-2 py-1 text-[12px] font-medium"
										style={{
											color: settings.inlineCodeColor,
											backgroundColor: `${settings.inlineCodeColor}24`,
											borderColor: `${settings.inlineCodeColor}38`,
										}}
									>
										inline-preview
									</div>
									<div className="mt-1 text-[11px] text-stone-500">{settings.inlineCodeColor}</div>
								</div>
							</div>
						</label>
						<button
							type="button"
							role="switch"
							aria-checked={settings.showEmptyLines}
							onClick={() =>
								onSettingsChange((current) => ({
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
								onSettingsChange((current) => ({
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
								onClick={() => {
									onSettingsChange(() => DEFAULT_MARKDOWN_NOTE_SETTINGS);
									onSurfaceStyleChange({
										backgroundColor: '#ffffff',
										strokeColor: 'rgba(17,24,39,0.09)',
										strokeWidth: 1,
										roundness: null,
									});
								}}
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
							onClick={() => onActiveUtilityPanelChange('style')}
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
							onClick={onRequestImagePicker}
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
								{imageCount} image{imageCount === 1 ? '' : 's'} attached to this note.
							</div>
							<div className="mt-1">You can also paste images directly while editing in raw or hybrid mode.</div>
						</div>
					</div>
				</div>
			) : null}
		</>
	);

	return (
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
					onActiveUtilityPanelChange((current) => {
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
			{renderPanel()}
		</div>
	);
}
