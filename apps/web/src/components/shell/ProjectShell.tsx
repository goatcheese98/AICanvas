import { AIChatPanelContent } from '@/components/ai-chat/AIChatPanelContent';
import { updateSceneAndSyncAppStore } from '@/components/canvas/excalidraw-store-sync';
import type { TypedOverlayCanvasElement } from '@/components/canvas/overlay-definition-types';
import type { CollaborationSessionStatus } from '@/hooks/collaboration-utils';
import { useAppStore } from '@/stores/store';
import type { OverlayType } from '@ai-canvas/shared/types';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { DetailsPanelContent } from './DetailsPanelContent';
import { LeftSidebar, type NewResourceOption } from './LeftSidebar';
import { RightPanel } from './RightPanel';
import { Shell } from './Shell';
import { getOverlayTypeAIGenerationMode } from './resource-type-utils';
import type { ProjectResource } from './types';
import { useDetailsPanelOnSelection } from './useDetailsPanelOnSelection';
import { useNewResourceCreation } from './useNewResourceCreation';
import { useShellKeyboardShortcuts } from './useShellKeyboardShortcuts';
import { useShellState } from './useShellState';

interface ProjectShellProps {
	projectId: string;
	projectName: string;
	canvasId: string;
	resources: ProjectResource[];
	activeResourceId?: string;
	children: React.ReactNode;
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
	onNavigateToResource: (resource: ProjectResource) => void;
	onNavigateToSettings?: () => void;
}

export function ProjectShell({
	projectId: _projectId,
	projectName,
	canvasId,
	resources,
	activeResourceId,
	children,
	collaboration,
	onNavigateToResource,
	onNavigateToSettings,
}: ProjectShellProps) {
	const shellState = useShellState();
	const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
	const openExpandedOverlay = useAppStore((s) => s.openExpandedOverlay);
	const addToast = useAppStore((s) => s.addToast);
	const setChatError = useAppStore((s) => s.setChatError);
	const setContextMode = useAppStore((s) => s.setContextMode);
	const setGenerationMode = useAppStore((s) => s.setGenerationMode);
	const navigate = useNavigate();

	// New resource creation hook
	const { createResource } = useNewResourceCreation({
		canvasId,
		onSuccess: (_resource, type) => {
			addToast({
				message: `${type === 'canvas' ? 'Canvas' : type === 'board' ? 'Board' : type === 'document' ? 'Document' : 'Prototype'} created`,
				type: 'success',
			});
		},
		onError: (error) => {
			addToast({
				message: error.message,
				type: 'error',
			});
		},
	});

	// Open details panel when heavy resource is selected
	const isDetailsPanelOpen = shellState.rightPanelMode === 'details';
	const handleAutoOpenDetails = useCallback(() => {
		shellState.openRightPanel('details');
	}, [shellState.openRightPanel]);

	useDetailsPanelOnSelection({
		onOpenDetails: handleAutoOpenDetails,
		isDetailsPanelOpen,
	});

	// Keyboard shortcuts
	useShellKeyboardShortcuts({
		rightPanelMode: shellState.rightPanelMode,
		openRightPanel: shellState.openRightPanel,
		closeRightPanel: shellState.closeRightPanel,
		toggleRightPanel: shellState.toggleRightPanel,
		toggleSidebar: shellState.toggleSidebar,
		onOpenShortcutsHelp: () => setIsShortcutsHelpOpen(true),
		isShortcutsHelpOpen,
	});

	// Convert collaborators map to array
	const collaboratorsList = useMemo(() => {
		const list: { id: string; name: string; avatarUrl?: string }[] = [];
		collaboration.collaborators.forEach((value, key) => {
			list.push({
				id: key,
				name: value.username || 'Anonymous',
			});
		});
		return list;
	}, [collaboration.collaborators]);

	const handleResourceClick = (resource: ProjectResource) => {
		onNavigateToResource(resource);
	};

	const handleNewResource = useCallback(
		async (option: NewResourceOption) => {
			const { type } = option;

			// Canvas-native resources (lightweight - insert directly)
			if (type === 'quick-note') {
				const result = await createResource({ type: 'quick-note' });
				if (result.success && result.elementId) {
					addToast({
						message: 'Quick note added to canvas',
						type: 'success',
					});
				}
				return;
			}

			if (type === 'web-embed') {
				const result = await createResource({ type: 'web-embed' });
				if (result.success && result.elementId) {
					addToast({
						message: 'Web embed added to canvas',
						type: 'success',
					});
				}
				return;
			}

			// Heavy resources - create, add to canvas, open focused view
			if (type === 'canvas') {
				const result = await createResource({ type: 'canvas' });
				if (result.success && result.elementId) {
					void navigate({
						to: '/canvas/$id',
						params: { id: result.elementId },
					});
				}
				return;
			}

			if (type === 'board') {
				const result = await createResource({ type: 'board' });
				if (result.success && result.elementId) {
					// Open board in focused view
					void navigate({
						to: '/canvas/$id/board/$boardId',
						params: { id: canvasId, boardId: result.elementId },
					});
				}
				return;
			}

			if (type === 'document') {
				const result = await createResource({ type: 'document' });
				if (result.success && result.elementId) {
					void navigate({
						to: '/canvas/$id/document/$documentId',
						params: { id: canvasId, documentId: result.elementId },
					});
				}
				return;
			}

			if (type === 'prototype') {
				const result = await createResource({ type: 'prototype' });
				if (result.success && result.elementId) {
					// Open prototype in focused view
					void navigate({
						to: '/canvas/$id/prototype/$prototypeId',
						params: { id: canvasId, prototypeId: result.elementId },
					});
				}
				return;
			}
		},
		[canvasId, createResource, navigate, addToast],
	);

	const handleRightPanelModeChange = (
		mode: Exclude<ReturnType<typeof useShellState>['rightPanelMode'], 'none'>,
	) => {
		shellState.openRightPanel(mode);
	};

	const handleOpenRightPanel = (
		mode: Exclude<ReturnType<typeof useShellState>['rightPanelMode'], 'none'>,
	) => {
		shellState.openRightPanel(mode);
	};

	const handleOpenFocusedView = useCallback(
		(elementId: string) => {
			const resource = resources.find((candidate) => candidate.id === elementId);
			if (!resource) {
				openExpandedOverlay(elementId);
				return;
			}

			// Save current navigation state before leaving canvas
			const { appState, saveNavigationState } = useAppStore.getState();
			const selectedIds = appState.selectedElementIds ?? {};
			const normalizedSelectedIds: Record<string, true> = {};
			for (const [id, selected] of Object.entries(selectedIds)) {
				if (selected) normalizedSelectedIds[id] = true;
			}
			saveNavigationState({
				scrollX: appState.scrollX ?? 0,
				scrollY: appState.scrollY ?? 0,
				zoomValue: appState.zoom?.value ?? 1,
				selectedElementIds: normalizedSelectedIds,
			});

			if (resource.type === 'board') {
				void navigate({
					to: '/canvas/$id/board/$boardId',
					params: { id: canvasId, boardId: resource.id },
				});
				return;
			}

			if (resource.type === 'prototype') {
				void navigate({
					to: '/canvas/$id/prototype/$prototypeId',
					params: { id: canvasId, prototypeId: resource.id },
				});
				return;
			}

			if (resource.type === 'document') {
				void navigate({
					to: '/canvas/$id/document/$documentId',
					params: { id: canvasId, documentId: resource.id },
				});
				return;
			}

			void navigate({ to: '/canvas/$id', params: { id: canvasId } });
		},
		[canvasId, navigate, openExpandedOverlay, resources],
	);

	const handleDeleteElement = useCallback((elementId: string) => {
		const { excalidrawApi } = useAppStore.getState();
		if (!excalidrawApi) return;

		const currentElements = excalidrawApi.getSceneElements();
		const nextElements = currentElements.map((el) =>
			el.id === elementId ? { ...el, isDeleted: true } : el,
		);

		updateSceneAndSyncAppStore(
			excalidrawApi,
			{ elements: nextElements },
			{ elements: nextElements },
		);
	}, []);

	const handleAskAI = useCallback(
		(element: TypedOverlayCanvasElement) => {
			const overlayType = element.customData.type as OverlayType;
			setContextMode('selected');
			setGenerationMode(getOverlayTypeAIGenerationMode(overlayType));
			setChatError(null);
			shellState.openRightPanel('ai');
		},
		[setChatError, setContextMode, setGenerationMode, shellState.openRightPanel],
	);

	return (
		<Shell
			shellState={shellState}
			onOpenRightPanel={handleOpenRightPanel}
			sidebarContent={
				<LeftSidebar
					isExpanded={shellState.isSidebarExpanded}
					onToggleExpand={shellState.toggleSidebar}
					projectName={projectName}
					resources={resources}
					activeResourceId={activeResourceId ?? canvasId}
					onResourceClick={handleResourceClick}
					onNewResource={handleNewResource}
					onNavigateToSettings={onNavigateToSettings}
					collaboration={{
						isCollaborating: collaboration.isCollaborating,
						collaborators: collaboratorsList,
						roomLink: collaboration.roomLink,
						username: collaboration.username,
						setUsername: collaboration.setUsername,
						startSession: collaboration.startSession,
						stopSession: collaboration.stopSession,
					}}
				/>
			}
			rightPanelContent={{
				ai: (
					<RightPanel
						mode={shellState.rightPanelMode}
						onClose={shellState.closeRightPanel}
						onChangeMode={handleRightPanelModeChange}
					>
						<AIChatPanelContent canvasId={canvasId} />
					</RightPanel>
				),
				details: (
					<RightPanel
						mode={shellState.rightPanelMode}
						onClose={shellState.closeRightPanel}
						onChangeMode={handleRightPanelModeChange}
					>
						<DetailsPanelContent
							onOpenFocusedView={handleOpenFocusedView}
							onAskAI={handleAskAI}
							onDeleteElement={handleDeleteElement}
						/>
					</RightPanel>
				),
			}}
		>
			{children}
		</Shell>
	);
}
