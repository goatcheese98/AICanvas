import { useEffect } from 'react';
import type { RightPanelMode } from './useShellState';

interface UseShellKeyboardShortcutsProps {
	rightPanelMode: RightPanelMode;
	openRightPanel: (mode: Exclude<RightPanelMode, 'none'>) => void;
	closeRightPanel: () => void;
	toggleRightPanel: (mode: Exclude<RightPanelMode, 'none'>) => void;
	toggleSidebar: () => void;
}

export function useShellKeyboardShortcuts({
	rightPanelMode,
	openRightPanel,
	closeRightPanel,
	toggleRightPanel,
	toggleSidebar,
}: UseShellKeyboardShortcutsProps) {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const isMeta = event.metaKey || event.ctrlKey;

			// Cmd/Ctrl + B - Toggle AI panel
			if (isMeta && event.key === 'b') {
				event.preventDefault();
				toggleRightPanel('ai');
				return;
			}

			// Cmd/Ctrl + I - Toggle Details panel
			if (isMeta && event.key === 'i') {
				event.preventDefault();
				toggleRightPanel('details');
				return;
			}

			// Cmd/Ctrl + [ - Toggle sidebar
			if (isMeta && event.key === '[') {
				event.preventDefault();
				toggleSidebar();
				return;
			}

			// Escape - Close right panel
			if (event.key === 'Escape' && rightPanelMode !== 'none') {
				event.preventDefault();
				closeRightPanel();
				return;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [rightPanelMode, openRightPanel, closeRightPanel, toggleRightPanel, toggleSidebar]);
}
