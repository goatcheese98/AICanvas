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
}

export function ProjectShell({
	projectId: _projectId,
	projectName,
	canvasId,
	children,
	collaboration,
	onNavigateToResource,
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

	// Convert current canvas to resources list
	// In v2, this would include boards, prototypes, etc.
	const resources: ProjectResource[] = useMemo(
		() => [
			{
				id: canvasId,
				type: 'canvas',
				name: 'Overview',
				isActive: true,
			},
		],
		[canvasId],
	);

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

	const handleShareClick = () => {
		// Open collaboration panel or share dialog
		shellState.openRightPanel('ai'); // Temporary - should open share dialog
	};

	const handleOpenAI = () => {
		shellState.toggleRightPanel('ai');
	};

	const handleOpenDetails = () => {
		shellState.toggleRightPanel('details');
	};

	const handleRightPanelModeChange = (mode: Exclude<'none' | 'ai' | 'details', 'none'>) => {
		shellState.openRightPanel(mode);
	};

	const isAIOpen = shellState.rightPanelMode === 'ai';
	const isDetailsOpen = shellState.rightPanelMode === 'details';

	const handleOpenRightPanel = (mode: Exclude<'none' | 'ai' | 'details', 'none'>) => {
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
					activeResourceId={canvasId}
					onResourceClick={handleResourceClick}
					onNewClick={handleNewClick}
					onOpenAI={handleOpenAI}
					onOpenDetails={handleOpenDetails}
					isAIOpen={isAIOpen}
					isDetailsOpen={isDetailsOpen}
					collaboration={{
						isCollaborating: collaboration.isCollaborating,
						collaborators: collaboratorsList,
						onShareClick: handleShareClick,
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
