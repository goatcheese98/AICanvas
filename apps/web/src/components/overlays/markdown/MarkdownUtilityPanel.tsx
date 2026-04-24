import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';
import type { CSSProperties, RefObject } from 'react';
import { useRef } from 'react';
import { MarkdownImagePanel } from './MarkdownImagePanel';
import { MarkdownStylePanel } from './MarkdownStylePanel';
import { NOTE_TOOL_BUTTON, NOTE_TOOL_IDLE } from './markdown-note-helpers';
import { useMarkdownUtilityPanelState } from './useMarkdownUtilityPanelState';

interface MarkdownUtilityPanelProps {
	layout: 'icon' | 'full';
	isSelected: boolean;
	activeUtilityPanel: 'none' | 'style' | 'image';
	utilityPanelRef: RefObject<HTMLDivElement | null>;
	detachedUtilityPanelRef: RefObject<HTMLDivElement | null>;
	surfaceBackground: string;
	strokeColor: string;
	strokeWidth: number;
	settings: MarkdownNoteSettings;
	imageCount: number;
	detachPanel?: boolean;
	detachedPanelContainer?: HTMLElement | null;
	isExpandedShell?: boolean;
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
	}) => void;
	onSettingsChange: (updater: (current: MarkdownNoteSettings) => MarkdownNoteSettings) => void;
	onRequestImagePicker: () => void;
}

export function MarkdownUtilityPanel({
	layout,
	isSelected,
	activeUtilityPanel,
	utilityPanelRef,
	detachedUtilityPanelRef,
	surfaceBackground,
	strokeColor,
	strokeWidth,
	settings,
	imageCount,
	detachPanel = false,
	detachedPanelContainer,
	isExpandedShell = false,
	onActiveUtilityPanelChange,
	onSurfaceStyleChange,
	onSettingsChange,
	onRequestImagePicker,
}: MarkdownUtilityPanelProps) {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { handleSettingsChange, handleReset } = useMarkdownUtilityPanelState({
		onSettingsChange,
		onSurfaceStyleChange,
	});
	let detachedPanelStyle: CSSProperties | undefined;
	if (detachPanel && typeof window !== 'undefined') {
		const triggerRect = triggerRef.current?.getBoundingClientRect();
		const containerRect = detachedPanelContainer?.getBoundingClientRect();
		if (triggerRect && containerRect) {
			const panelTop = Math.max(
				12,
				Math.min(triggerRect.top - containerRect.top, Math.max(12, containerRect.height - 520)),
			);

			detachedPanelStyle = {
				top: panelTop,
				left: containerRect.width + 16,
				maxHeight: Math.max(320, containerRect.height - panelTop + 12),
			};
		}
	}

	const handleTogglePanel = () => {
		onActiveUtilityPanelChange((current) => {
			if (!isSelected) return 'none';
			return current === 'none' ? 'style' : 'none';
		});
	};

	return (
		<div
			className="relative"
			ref={utilityPanelRef}
			onPointerDownCapture={(event) => event.stopPropagation()}
		>
			<button
				ref={triggerRef}
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
					aria-hidden="true"
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
					settings={settings}
					isDetached={detachPanel}
					detachedStyle={detachedPanelStyle}
					detachedPortalTarget={detachedPanelContainer}
					detachedPanelRef={detachedUtilityPanelRef}
					isExpandedShell={isExpandedShell}
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
