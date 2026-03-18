import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { RefObject } from 'react';
import { MarkdownImagePanel } from './MarkdownImagePanel';
import { MarkdownStylePanel } from './MarkdownStylePanel';
import { NOTE_TOOL_BUTTON, NOTE_TOOL_IDLE } from './markdown-note-helpers';
import { useMarkdownUtilityPanelState } from './useMarkdownUtilityPanelState';

export interface MarkdownUtilityPanelProps {
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
	onSettingsChange: (updater: (current: MarkdownNoteSettings) => MarkdownNoteSettings) => void;
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
	const { handleSettingsChange, handleReset } = useMarkdownUtilityPanelState({
		onSettingsChange,
		onSurfaceStyleChange,
	});

	const handleTogglePanel = () => {
		onActiveUtilityPanelChange((current) => {
			if (!isSelected) return 'none';
			return current === 'none' ? 'style' : 'none';
		});
	};

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
				onClick={handleTogglePanel}
			>
				<svg
					width="11"
					height="11"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				>
					<path d="M4 12h16" />
					<path d="M4 6h16" />
					<path d="M4 18h16" />
				</svg>
				{layout === 'full' ? 'Options' : null}
			</button>
			{activeUtilityPanel === 'style' && (
				<MarkdownStylePanel
					surfaceBackground={surfaceBackground}
					strokeColor={strokeColor}
					strokeWidth={strokeWidth}
					roundness={roundness}
					settings={settings}
					onActiveUtilityPanelChange={onActiveUtilityPanelChange}
					onSurfaceStyleChange={onSurfaceStyleChange}
					onSettingsChange={handleSettingsChange}
					onReset={handleReset}
				/>
			)}
			{activeUtilityPanel === 'image' && (
				<MarkdownImagePanel
					imageCount={imageCount}
					onActiveUtilityPanelChange={onActiveUtilityPanelChange}
					onRequestImagePicker={onRequestImagePicker}
				/>
			)}
		</div>
	);
}
