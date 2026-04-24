import { DEFAULT_MARKDOWN_NOTE_SETTINGS } from '@ai-canvas/shared/schemas';
import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';
import { useCallback } from 'react';

interface UseMarkdownUtilityPanelStateProps {
	onSettingsChange: (updater: (current: MarkdownNoteSettings) => MarkdownNoteSettings) => void;
	onSurfaceStyleChange: (elementStyle: {
		backgroundColor?: string;
		strokeColor?: string;
		strokeWidth?: number;
	}) => void;
}

interface UseMarkdownUtilityPanelStateReturn {
	handleSettingsChange: (updates: Partial<MarkdownNoteSettings>) => void;
	handleReset: () => void;
}

export function useMarkdownUtilityPanelState({
	onSettingsChange,
	onSurfaceStyleChange,
}: UseMarkdownUtilityPanelStateProps): UseMarkdownUtilityPanelStateReturn {
	const handleSettingsChange = useCallback(
		(updates: Partial<MarkdownNoteSettings>) => {
			onSettingsChange((current) => ({ ...current, ...updates }));
		},
		[onSettingsChange],
	);

	const handleReset = useCallback(() => {
		onSettingsChange(() => DEFAULT_MARKDOWN_NOTE_SETTINGS);
		onSurfaceStyleChange({
			backgroundColor: '#ffffff',
			strokeColor: 'rgba(17,24,39,0.09)',
			strokeWidth: 1,
		});
	}, [onSettingsChange, onSurfaceStyleChange]);

	return {
		handleSettingsChange,
		handleReset,
	};
}
