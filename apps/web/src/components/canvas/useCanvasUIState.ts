import type { CollaborationSessionStatus } from '@/hooks/collaboration-utils';
import { useSyncExternalStore } from '@/hooks/useSyncExternalStore';
import { useAppStore } from '@/stores/store';
import type { OverlayType } from '@ai-canvas/shared/types';
import type { AppState } from '@excalidraw/excalidraw/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
	MAX_CHAT_HEIGHT_RATIO,
	MAX_CHAT_WIDTH,
	MAX_PANEL_WIDTH,
	MIN_CHAT_HEIGHT,
	MIN_CHAT_WIDTH,
	MIN_PANEL_WIDTH,
	clampPanelWidth,
	getOverlayInsertionMessage,
} from './canvas-ui-utils';
import { buildOverlayInsertionScene } from './element-factories';
import { updateSceneAndSyncAppStore } from './excalidraw-store-sync';

interface UseCanvasUIStateProps {
	canvasId: string;
	sessionStatus: CollaborationSessionStatus;
}

interface UseCanvasUIStateReturn {
	// Panel state
	activePanel: 'none' | 'assets' | 'collab' | 'chat';
	setActivePanel: (panel: 'none' | 'assets' | 'collab' | 'chat') => void;

	// Insert menu state
	isInsertMenuOpen: boolean;
	setIsInsertMenuOpen: (open: boolean) => void;
	insertMenuRef: React.RefObject<HTMLDivElement | null>;
	toggleInsertMenu: () => void;

	// Panel dimensions
	sidePanelWidth: number;
	chatPanelWidth: number;
	chatPanelHeight: number;

	// Resize handlers
	startSidePanelResize: (event: React.PointerEvent<HTMLDivElement>) => void;
	startChatPanelResize: (event: React.PointerEvent<HTMLDivElement>) => void;
	startChatHeightResize: (event: React.PointerEvent<HTMLDivElement>) => void;

	// Overlay insertion
	insertOverlay: (type: OverlayType) => void;

	// Window dimensions (synced)
	windowWidth: number;
}

function subscribeToWindowResize(callback: () => void): () => void {
	window.addEventListener('resize', callback);
	return () => window.removeEventListener('resize', callback);
}

function getWindowWidth(): number {
	return window.innerWidth;
}

function getServerWindowWidth(): number {
	return 1024;
}

export function useCanvasUIState(_props: UseCanvasUIStateProps): UseCanvasUIStateReturn {
	const activePanel = useAppStore((s) => s.activePanel);
	const setActivePanel = useAppStore((s) => s.setActivePanel);
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const elements = useAppStore((s) => s.elements);
	const appState = useAppStore((s) => s.appState);
	const addToast = useAppStore((s) => s.addToast);

	const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
	const insertMenuRef = useRef<HTMLDivElement | null>(null);

	// Use useSyncExternalStore for window dimensions (replaces useEffect)
	const windowWidth = useSyncExternalStore(
		subscribeToWindowResize,
		getWindowWidth,
		getServerWindowWidth,
	);

	// Derive clamped panel widths from window width
	const sidePanelWidth = useMemo(() => {
		const stored = 332; // Default value
		return clampPanelWidth(stored, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH, windowWidth);
	}, [windowWidth]);

	const [chatPanelWidthState, setChatPanelWidth] = useState(920);
	const [chatPanelHeightState, setChatPanelHeight] = useState(680);

	// Clamp chat panel width on window resize
	const chatPanelWidth = useMemo(() => {
		return clampPanelWidth(chatPanelWidthState, MIN_CHAT_WIDTH, MAX_CHAT_WIDTH, windowWidth);
	}, [chatPanelWidthState, windowWidth]);

	const chatPanelHeight = chatPanelHeightState;

	const toggleInsertMenu = useCallback(() => {
		setIsInsertMenuOpen((current) => !current);
	}, []);

	// Generic resize handler factory
	const startResize = useCallback(
		(setter: React.Dispatch<React.SetStateAction<number>>, min: number, max: number) =>
			(event: React.PointerEvent<HTMLDivElement>) => {
				event.preventDefault();
				const startX = event.clientX;
				let snapshot = min;
				setter((value) => {
					snapshot = value;
					return value;
				});

				const handleMove = (moveEvent: PointerEvent) => {
					const delta = moveEvent.clientX - startX;
					const viewportMax = Math.max(min, Math.min(max, window.innerWidth - 48));
					setter(Math.max(min, Math.min(viewportMax, snapshot - delta)));
				};

				const handleUp = () => {
					window.removeEventListener('pointermove', handleMove);
					window.removeEventListener('pointerup', handleUp);
				};

				window.addEventListener('pointermove', handleMove);
				window.addEventListener('pointerup', handleUp);
			},
		[],
	);

	const startSidePanelResize = startResize(setChatPanelWidth, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH);
	const startChatPanelResize = startResize(setChatPanelWidth, MIN_CHAT_WIDTH, MAX_CHAT_WIDTH);

	const startChatHeightResize = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			const startY = event.clientY;
			let snapshot = chatPanelHeightState;
			setChatPanelHeight((v) => {
				snapshot = v;
				return v;
			});
			const handleMove = (e: PointerEvent) => {
				const delta = e.clientY - startY;
				const maxH = Math.floor(window.innerHeight * MAX_CHAT_HEIGHT_RATIO);
				setChatPanelHeight(Math.max(MIN_CHAT_HEIGHT, Math.min(maxH, snapshot - delta)));
			};
			const handleUp = () => {
				window.removeEventListener('pointermove', handleMove);
				window.removeEventListener('pointerup', handleUp);
			};
			window.addEventListener('pointermove', handleMove);
			window.addEventListener('pointerup', handleUp);
		},
		[chatPanelHeightState],
	);

	const insertOverlay = useCallback(
		(type: OverlayType) => {
			if (!excalidrawApi) {
				addToast({ message: 'Canvas is still loading. Try again in a moment.', type: 'info' });
				return;
			}

			const sceneUpdate = buildOverlayInsertionScene(type, elements, appState);
			updateSceneAndSyncAppStore(excalidrawApi, {
				elements: sceneUpdate.elements,
				appState: sceneUpdate.appState as AppState,
			});
			setIsInsertMenuOpen(false);
			addToast({
				message: getOverlayInsertionMessage(type),
				type: 'success',
			});
		},
		[excalidrawApi, elements, appState, addToast],
	);

	return {
		activePanel: activePanel as 'none' | 'assets' | 'collab' | 'chat',
		setActivePanel: setActivePanel as (panel: 'none' | 'assets' | 'collab' | 'chat') => void,
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
		windowWidth,
	};
}
