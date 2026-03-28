import { useCallback, useEffect } from 'react';
import type { RightPanelMode } from './useShellState';

interface UseShellKeyboardShortcutsProps {
	rightPanelMode: RightPanelMode;
	openRightPanel: (mode: Exclude<RightPanelMode, 'none'>) => void;
	closeRightPanel: () => void;
	toggleRightPanel: (mode: Exclude<RightPanelMode, 'none'>) => void;
	toggleSidebar: () => void;
	onOpenShortcutsHelp?: () => void;
	isShortcutsHelpOpen?: boolean;
	onOpenNewResourceMenu?: () => void;
}

export function useShellKeyboardShortcuts({
	rightPanelMode,
	openRightPanel,
	closeRightPanel,
	toggleRightPanel,
	toggleSidebar,
	onOpenShortcutsHelp,
	isShortcutsHelpOpen = false,
	onOpenNewResourceMenu,
}: UseShellKeyboardShortcutsProps) {
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			const isMeta = event.metaKey || event.ctrlKey;

			// ? - Show keyboard shortcuts help (only when not typing in an input)
			if (
				event.key === '?' &&
				!isMeta &&
				onOpenShortcutsHelp &&
				!isShortcutsHelpOpen &&
				!isTypingInInput(event)
			) {
				event.preventDefault();
				onOpenShortcutsHelp();
				return;
			}

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

			// Cmd/Ctrl + Shift + N - Open new resource menu
			if (isMeta && event.shiftKey && event.key.toLowerCase() === 'n') {
				event.preventDefault();
				onOpenNewResourceMenu?.();
				return;
			}

			// Escape - Close right panel or shortcuts help
			if (event.key === 'Escape') {
				if (isShortcutsHelpOpen) {
					// Let the help modal handle its own close
					return;
				}
				if (rightPanelMode !== 'none') {
					event.preventDefault();
					closeRightPanel();
					return;
				}
			}
		},
		[
			rightPanelMode,
			closeRightPanel,
			toggleRightPanel,
			toggleSidebar,
			onOpenShortcutsHelp,
			isShortcutsHelpOpen,
			onOpenNewResourceMenu,
		],
	);

	useEffect(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [handleKeyDown]);
}

function isTypingInInput(event: KeyboardEvent): boolean {
	const target = event.target as HTMLElement | null;
	if (!target) return false;

	const tagName = target.tagName.toLowerCase();
	const isInputElement =
		tagName === 'input' ||
		tagName === 'textarea' ||
		tagName === 'select' ||
		target.isContentEditable;

	return isInputElement;
}
