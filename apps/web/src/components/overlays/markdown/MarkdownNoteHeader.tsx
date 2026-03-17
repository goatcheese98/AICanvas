import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { RefObject } from 'react';
import { MarkdownUtilityPanel } from './MarkdownUtilityPanel';
import {
	MODE_OPTIONS,
	NOTE_SEGMENTED_ACTIVE,
	NOTE_SEGMENTED_BUTTON,
	NOTE_SEGMENTED_IDLE,
	NOTE_SEGMENTED_SHELL,
	abbreviateMarkdownTitle,
	renderModeIcon,
} from './markdown-note-helpers';

interface MarkdownNoteHeaderProps {
	title: string;
	titleNotice: boolean;
	hasLocalEdits: boolean;
	isSelected: boolean;
	compactTitle: boolean;
	controlsLayout: 'hidden' | 'icon' | 'full';
	activeMode: 'raw' | 'hybrid' | 'preview';
	showCompactControls: boolean;
	activeUtilityPanel: 'none' | 'style' | 'image';
	headerRef: RefObject<HTMLDivElement | null>;
	utilityPanelRef: RefObject<HTMLDivElement | null>;
	surfaceBackground: string;
	strokeColor: string;
	strokeWidth: number;
	roundness: ExcalidrawElement['roundness'] | undefined;
	settings: MarkdownNoteSettings;
	imageCount: number;
	onTitleChange: (value: string) => void;
	onTitlePaste: (pasted: string, currentValueLength: number) => void;
	onTitleBlur: () => void;
	onSelectMode: (mode: 'raw' | 'hybrid' | 'preview') => void;
	onActiveUtilityPanelChange: (
		next:
			| 'none'
			| 'style'
			| 'image'
			| ((current: 'none' | 'style' | 'image') => 'none' | 'style' | 'image'),
	) => void;
	onSettingsChange: (updater: (current: MarkdownNoteSettings) => MarkdownNoteSettings) => void;
	onSurfaceStyleChange: (elementStyle: {
		backgroundColor?: string;
		strokeColor?: string;
		strokeWidth?: number;
		roundness?: ExcalidrawElement['roundness'];
	}) => void;
	onRequestImagePicker: () => void;
	onCompactControlsVisibilityChange: (visible: boolean) => void;
}

export function MarkdownNoteHeader({
	title,
	titleNotice,
	hasLocalEdits,
	isSelected,
	compactTitle,
	controlsLayout,
	activeMode,
	showCompactControls,
	activeUtilityPanel,
	headerRef,
	utilityPanelRef,
	surfaceBackground,
	strokeColor,
	strokeWidth,
	roundness,
	settings,
	imageCount,
	onTitleChange,
	onTitlePaste,
	onTitleBlur,
	onSelectMode,
	onActiveUtilityPanelChange,
	onSettingsChange,
	onSurfaceStyleChange,
	onRequestImagePicker,
	onCompactControlsVisibilityChange,
}: MarkdownNoteHeaderProps) {
	const renderModeSwitcher = (layout: 'icon' | 'full') => (
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
					onClick={() => onSelectMode(mode)}
				>
					{layout === 'icon' ? renderModeIcon(icon) : label}
				</button>
			))}
		</div>
	);

	return (
		<div
			ref={headerRef}
			className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500"
		>
			<div className="flex min-w-0 items-center gap-2">
				{isSelected && !compactTitle ? (
					<div className="min-w-0">
						<input
							type="text"
							value={title}
							maxLength={8}
							onChange={(event) => onTitleChange(event.target.value)}
							onPaste={(event) => {
								onTitlePaste(event.clipboardData.getData('text'), event.currentTarget.value.length);
							}}
							onBlur={onTitleBlur}
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
					<span className="truncate">{compactTitle ? abbreviateMarkdownTitle(title) : title}</span>
				)}
				{hasLocalEdits ? <span className="text-[10px] text-amber-600">Unsaved</span> : null}
			</div>
			<div
				className="flex items-center justify-center"
				onMouseEnter={() => {
					if (isSelected && controlsLayout === 'hidden') onCompactControlsVisibilityChange(true);
				}}
			>
				{controlsLayout === 'hidden' ? (
					<div className="h-7 w-28" />
				) : (
					renderModeSwitcher(controlsLayout)
				)}
			</div>
			<div
				className="flex items-center justify-end"
				onMouseEnter={() => {
					if (isSelected && controlsLayout === 'hidden') onCompactControlsVisibilityChange(true);
				}}
				onMouseLeave={() => {
					if (isSelected && controlsLayout === 'hidden' && activeUtilityPanel === 'none') {
						onCompactControlsVisibilityChange(false);
					}
				}}
			>
				{controlsLayout === 'hidden' ? (
					<div className="h-7 w-16" />
				) : (
					<MarkdownUtilityPanel
						layout={controlsLayout}
						isSelected={isSelected}
						activeUtilityPanel={activeUtilityPanel}
						utilityPanelRef={utilityPanelRef}
						surfaceBackground={surfaceBackground}
						strokeColor={strokeColor}
						strokeWidth={strokeWidth}
						roundness={roundness}
						settings={settings}
						imageCount={imageCount}
						onActiveUtilityPanelChange={onActiveUtilityPanelChange}
						onSurfaceStyleChange={onSurfaceStyleChange}
						onSettingsChange={onSettingsChange}
						onRequestImagePicker={onRequestImagePicker}
					/>
				)}
			</div>
			{showCompactControls ? (
				<div
					className="absolute inset-y-0 left-[5.25rem] right-3 z-20 flex items-center justify-between"
					onMouseEnter={() => onCompactControlsVisibilityChange(true)}
					onMouseLeave={() => {
						if (activeUtilityPanel === 'none') onCompactControlsVisibilityChange(false);
					}}
				>
					<div className="flex flex-1 justify-center">{renderModeSwitcher('icon')}</div>
					<div className="ml-3 shrink-0">
						<MarkdownUtilityPanel
							layout="icon"
							isSelected={isSelected}
							activeUtilityPanel={activeUtilityPanel}
							utilityPanelRef={utilityPanelRef}
							surfaceBackground={surfaceBackground}
							strokeColor={strokeColor}
							strokeWidth={strokeWidth}
							roundness={roundness}
							settings={settings}
							imageCount={imageCount}
							onActiveUtilityPanelChange={onActiveUtilityPanelChange}
							onSurfaceStyleChange={onSurfaceStyleChange}
							onSettingsChange={onSettingsChange}
							onRequestImagePicker={onRequestImagePicker}
						/>
					</div>
				</div>
			) : null}
		</div>
	);
}
