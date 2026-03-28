import { AIChatPanelContent } from '@/components/ai-chat/AIChatPanelContent';
import type { CollaborationSessionStatus } from '@/hooks/collaboration-utils';
import { useMemo } from 'react';
import { LeftSidebar } from './LeftSidebar';
import { RightPanel } from './RightPanel';
import { Shell } from './Shell';
import type { ProjectResource } from './types';
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

	// Keyboard shortcuts
	useShellKeyboardShortcuts({
		rightPanelMode: shellState.rightPanelMode,
		openRightPanel: shellState.openRightPanel,
		closeRightPanel: shellState.closeRightPanel,
		toggleRightPanel: shellState.toggleRightPanel,
		toggleSidebar: shellState.toggleSidebar,
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

	const handleNewClick = () => {
		// TODO: Open new resource menu
		// For now, just log
		console.log('New resource clicked');
	};

	const handleOpenAI = () => {
		shellState.toggleRightPanel('ai');
	};

	const handleOpenDetails = () => {
		shellState.toggleRightPanel('details');
	};

	const handleRightPanelModeChange = (
		mode: Exclude<ReturnType<typeof useShellState>['rightPanelMode'], 'none'>,
	) => {
		shellState.openRightPanel(mode);
	};

	const handleOpenRightPanel = (mode: Exclude<ReturnType<typeof useShellState>['rightPanelMode'], 'none'>) => {
		shellState.openRightPanel(mode);
	};

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
					onNewClick={handleNewClick}
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
						<div className="p-4 text-sm text-stone-500">
							<p>Select an item to view details</p>
						</div>
					</RightPanel>
				),
			}}
		>
			{children}
		</Shell>
	);
}
