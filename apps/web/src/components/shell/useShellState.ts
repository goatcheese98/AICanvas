import { useCallback, useState } from 'react';

export type RightPanelMode = 'none' | 'ai' | 'details';

export interface ShellState {
	// Left sidebar
	isSidebarExpanded: boolean;
	toggleSidebar: () => void;
	setSidebarExpanded: (expanded: boolean) => void;

	// Right panel
	rightPanelMode: RightPanelMode;
	openRightPanel: (mode: Exclude<RightPanelMode, 'none'>) => void;
	closeRightPanel: () => void;
	toggleRightPanel: (mode: Exclude<RightPanelMode, 'none'>) => void;

	// Widths
	sidebarWidth: number;
	rightPanelWidth: number;
}

const SIDEBAR_EXPANDED_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const RIGHT_PANEL_WIDTH = 420;

export function useShellState(): ShellState {
	const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
	const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('none');

	const toggleSidebar = useCallback(() => {
		setIsSidebarExpanded((prev) => !prev);
	}, []);

	const setSidebarExpanded = useCallback((expanded: boolean) => {
		setIsSidebarExpanded(expanded);
	}, []);

	const openRightPanel = useCallback((mode: Exclude<RightPanelMode, 'none'>) => {
		setRightPanelMode(mode);
	}, []);

	const closeRightPanel = useCallback(() => {
		setRightPanelMode('none');
	}, []);

	const toggleRightPanel = useCallback((mode: Exclude<RightPanelMode, 'none'>) => {
		setRightPanelMode((prev) => (prev === mode ? 'none' : mode));
	}, []);

	return {
		isSidebarExpanded,
		toggleSidebar,
		setSidebarExpanded,
		rightPanelMode,
		openRightPanel,
		closeRightPanel,
		toggleRightPanel,
		sidebarWidth: isSidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
		rightPanelWidth: RIGHT_PANEL_WIDTH,
	};
}
