import type { CollaborationSessionStatus } from '@/hooks/collaboration-utils';
import type { OverlayType } from '@ai-canvas/shared/types';
import { useCallback } from 'react';
import { CanvasBottomToolbar } from './CanvasBottomToolbar';
import { CanvasPanels } from './CanvasPanels';
import { CanvasTopToolbar } from './CanvasTopToolbar';
import { useCanvasUIState } from './useCanvasUIState';
import { useOutsideClick } from './useOutsideClick';

interface CanvasUIProps {
	canvasId: string;
	collaboration: {
		isCollaborating: boolean;
		collaborators: Map<string, { username?: string }>;
		roomLink: string | null;
		sessionError: string | null;
		sessionStatus: CollaborationSessionStatus;
		username: string;
		setUsername: (name: string) => void;
		startSession: () => Promise<void>;
		stopSession: () => void;
	};
}

export function CanvasUI({ canvasId, collaboration }: CanvasUIProps) {
	const {
		activePanel,
		setActivePanel,
		isInsertMenuOpen,
		setIsInsertMenuOpen,
		insertMenuRef,
		toggleInsertMenu,
		sidePanelWidth,
		chatPanelWidth,
		chatPanelHeight,
		startSidePanelResize,
		startChatPanelResize,
		startChatHeightResize,
		insertOverlay,
	} = useCanvasUIState({
		canvasId,
		sessionStatus: collaboration.sessionStatus,
	});

	// Close insert menu when clicking outside
	useOutsideClick(insertMenuRef, isInsertMenuOpen, () => setIsInsertMenuOpen(false));

	// Panel toggle handlers
	const handleToggleAssetsPanel = useCallback(() => {
		setActivePanel(activePanel === 'assets' ? 'none' : 'assets');
	}, [activePanel, setActivePanel]);

	const handleToggleChatPanel = useCallback(() => {
		setActivePanel(activePanel === 'chat' ? 'none' : 'chat');
	}, [activePanel, setActivePanel]);

	// Overlay insertion handler
	const handleInsertOverlay = useCallback(
		(type: OverlayType) => {
			insertOverlay(type);
		},
		[insertOverlay],
	);

	return (
		<>
			<CanvasTopToolbar
				isInsertMenuOpen={isInsertMenuOpen}
				onToggleInsertMenu={toggleInsertMenu}
				onInsertOverlay={handleInsertOverlay}
				activePanel={activePanel}
				onToggleAssetsPanel={handleToggleAssetsPanel}
				insertMenuRef={insertMenuRef}
			/>

			<CanvasPanels
				activePanel={activePanel}
				onSetActivePanel={setActivePanel}
				sidePanelWidth={sidePanelWidth}
				onStartSidePanelResize={startSidePanelResize}
				chatPanelWidth={chatPanelWidth}
				chatPanelHeight={chatPanelHeight}
				onStartChatPanelResize={startChatPanelResize}
				onStartChatHeightResize={startChatHeightResize}
				canvasId={canvasId}
				collaboration={collaboration}
			/>

			<CanvasBottomToolbar activePanel={activePanel} onToggleChatPanel={handleToggleChatPanel} />
		</>
	);
}
