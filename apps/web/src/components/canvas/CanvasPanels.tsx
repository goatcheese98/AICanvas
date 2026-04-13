import { AIChatPanel } from '@/components/ai-chat';
import type { CollaborationSessionStatus } from '@/hooks/collaboration-utils';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from '@tanstack/react-router';
import { ProfilePanel } from './ProfilePanel';
import { PanelFrame, PanelShell } from './canvas-chrome';
import { getProfileInfo } from './canvas-ui-utils';

interface CanvasPanelsProps {
	activePanel: 'none' | 'assets' | 'collab' | 'chat';
	onSetActivePanel: (panel: 'none' | 'assets' | 'collab' | 'chat') => void;
	sidePanelWidth: number;
	onStartSidePanelResize: (event: React.PointerEvent<HTMLDivElement>) => void;
	chatPanelWidth: number;
	chatPanelHeight: number;
	onStartChatPanelResize: (event: React.PointerEvent<HTMLDivElement>) => void;
	onStartChatHeightResize: (event: React.PointerEvent<HTMLDivElement>) => void;
	canvasId: string;
	onSaveCanvas: () => Promise<void>;
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

export function CanvasPanels({
	activePanel,
	onSetActivePanel,
	sidePanelWidth,
	onStartSidePanelResize,
	chatPanelWidth,
	chatPanelHeight,
	onStartChatPanelResize,
	onStartChatHeightResize,
	canvasId,
	onSaveCanvas,
	collaboration,
}: CanvasPanelsProps) {
	const { user } = useUser();
	const navigate = useNavigate();
	const { initials, profileName, profileEmail } = getProfileInfo(user);

	return (
		<>
			{activePanel === 'assets' ? (
				<PanelFrame
					width={sidePanelWidth}
					onResizeStart={onStartSidePanelResize}
					className="absolute right-4 top-20 z-20 max-h-[calc(100%-6rem)]"
				>
					<PanelShell
						title="Profile & Workspace"
						description="Account details and live collaboration."
						onClose={() => onSetActivePanel('none')}
					>
						<ProfilePanel
							initials={initials}
							profileName={profileName}
							profileEmail={profileEmail}
							userImageUrl={user?.imageUrl}
							collaboration={collaboration}
							onSaveCanvas={onSaveCanvas}
							onNavigateDashboard={() => void navigate({ to: '/dashboard' })}
						/>
					</PanelShell>
				</PanelFrame>
			) : null}

			{activePanel === 'chat' ? (
				<div
					className="absolute bottom-20 right-4 z-20"
					style={{ width: chatPanelWidth, height: chatPanelHeight }}
				>
					{/* Horizontal resize handle (left edge) */}
					<div
						className="absolute inset-y-8 -left-2 z-30 flex w-4 cursor-ew-resize items-center justify-center"
						onPointerDown={onStartChatPanelResize}
						aria-label="Resize panel width"
					>
						<div className="h-16 w-1 rounded-[999px] bg-stone-200/90 shadow-sm" />
					</div>
					{/* Vertical resize handle (top edge) */}
					<div
						className="absolute -top-2 inset-x-8 z-30 flex h-4 cursor-ns-resize items-center justify-center"
						onPointerDown={onStartChatHeightResize}
						aria-label="Resize panel height"
					>
						<div className="h-1 w-16 rounded-[999px] bg-stone-200/90 shadow-sm" />
					</div>
					<div className="h-full">
						<AIChatPanel canvasId={canvasId} />
					</div>
				</div>
			) : null}
		</>
	);
}
