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
	resources: ProjectResource[];
	onNavigateToResource: (resource: ProjectResource) => void;
}

export function ProjectShell({
	projectId: _projectId,
	projectName,
	canvasId,
	children,
	collaboration,
	resources,
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

	// Determine active resource ID from resources list
	const activeResourceId = useMemo(() => {
		const activeResource = resources.find((r) => r.isActive);
		return activeResource?.id ?? canvasId;
	}, [resources, canvasId]);

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
		// Open share/collaboration panel
		shellState.openRightPanel('share');
	};

	const handleOpenAI = () => {
		shellState.toggleRightPanel('ai');
	};

	const handleOpenDetails = () => {
		shellState.toggleRightPanel('details');
	};

	const handleRightPanelModeChange = (
		mode: Exclude<'none' | 'ai' | 'details' | 'share', 'none'>,
	) => {
		shellState.openRightPanel(mode);
	};

	const isAIOpen = shellState.rightPanelMode === 'ai';
	const isDetailsOpen = shellState.rightPanelMode === 'details';
	const isShareOpen = shellState.rightPanelMode === 'share';

	const handleOpenRightPanel = (mode: Exclude<'none' | 'ai' | 'details' | 'share', 'none'>) => {
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
					activeResourceId={activeResourceId}
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
						isShareOpen,
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
				share: (
					<RightPanel
						mode={shellState.rightPanelMode}
						onClose={shellState.closeRightPanel}
						onChangeMode={handleRightPanelModeChange}
					>
						<div className="p-4">
							<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
								<p className="font-medium">Share & Collaboration</p>
								<p className="mt-1 text-amber-700">This feature is being rebuilt for V2.</p>
							</div>
							{collaboration.roomLink && (
								<div className="mt-4">
									<p className="text-xs font-medium text-stone-500">Current Session</p>
									<p className="mt-1 break-all text-xs text-stone-600">{collaboration.roomLink}</p>
								</div>
							)}
						</div>
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
