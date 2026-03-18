import type { CollaborationSessionStatus } from '@/hooks/collaboration-utils';
import { CHROME_BUTTON_BASE, CHROME_BUTTON_IDLE } from './canvas-chrome';
import { getCollaborationStatusDotClass } from './canvas-ui-utils';

interface CanvasBottomToolbarProps {
	activePanel: 'none' | 'assets' | 'collab' | 'chat';
	onToggleCollabPanel: () => void;
	onToggleChatPanel: () => void;
	sessionStatus: CollaborationSessionStatus;
}

export function CanvasBottomToolbar({
	activePanel,
	onToggleCollabPanel,
	onToggleChatPanel,
	sessionStatus,
}: CanvasBottomToolbarProps) {
	const statusDotClass = getCollaborationStatusDotClass(sessionStatus);

	return (
		<div className="absolute bottom-5 right-4 z-20 flex items-center gap-2">
			<button
				type="button"
				onClick={onToggleCollabPanel}
				className={`${CHROME_BUTTON_BASE} ${
					activePanel === 'collab'
						? 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]'
						: CHROME_BUTTON_IDLE
				} flex items-center gap-2 bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur`}
			>
				<span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
				Live
			</button>

			<button
				type="button"
				onClick={onToggleChatPanel}
				className={`${CHROME_BUTTON_BASE} ${
					activePanel === 'chat'
						? 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]'
						: CHROME_BUTTON_IDLE
				} flex items-center gap-2 bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur`}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					aria-label="Chat icon"
				>
					<title>AI Chat</title>
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
				AI
			</button>
		</div>
	);
}
