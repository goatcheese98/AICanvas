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
	getRoundnessOptionId,
} from './markdown-note-helpers';

export interface MarkdownStylePanelProps {
	surfaceBackground: string;
	strokeColor: string;
	strokeWidth: number;
	roundness: ExcalidrawElement['roundness'] | undefined;
	settings: MarkdownNoteSettings;
	onActiveUtilityPanelChange: (panel: 'image') => void;
	onSurfaceStyleChange: (elementStyle: {
		backgroundColor?: string;
		strokeColor?: string;
		strokeWidth?: number;
		roundness?: ExcalidrawElement['roundness'];
	}) => void;
	onSettingsChange: (updates: Partial<MarkdownNoteSettings>) => void;
	onReset: () => void;
}

export function MarkdownStylePanel({
	surfaceBackground,
	strokeColor,
	strokeWidth,
	roundness,
	settings,
	onActiveUtilityPanelChange,
	onSurfaceStyleChange,
	onSettingsChange,
	onReset,
}: MarkdownStylePanelProps) {
	return (
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
						onChange={(event) => onSettingsChange({ font: event.target.value })}
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
						onChange={(event) => onSettingsChange({ fontSize: Number(event.target.value) })}
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
						onChange={(event) => onSettingsChange({ lineHeight: Number(event.target.value) })}
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
							onChange={(event) => onSettingsChange({ inlineCodeColor: event.target.value })}
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
					onClick={() => onSettingsChange({ showEmptyLines: !settings.showEmptyLines })}
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
					onClick={() => onSettingsChange({ autoHideToolbar: !settings.autoHideToolbar })}
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
					<button type="button" onClick={onReset} className={NOTE_RESET_BUTTON}>
						Reset
					</button>
				</div>
			</div>
		</div>
	);
}
