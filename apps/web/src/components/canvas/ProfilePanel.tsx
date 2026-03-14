import type { OverlayType } from '@ai-canvas/shared/types';
import { CHROME_BUTTON_BASE, CHROME_BUTTON_IDLE } from './canvas-chrome';

interface ProfilePanelProps {
	initials: string;
	profileName: string;
	profileEmail: string;
	userImageUrl?: string;
	overlayActions: ReadonlyArray<{ type: OverlayType; label: string; description: string }>;
	onNavigateDashboard: () => void;
	onOpenInsertMenu: () => void;
	onOpenCollaboration: () => void;
	onOpenChat: () => void;
	onInsertOverlay: (type: OverlayType) => void;
}

export function ProfilePanel({
	initials,
	profileName,
	profileEmail,
	userImageUrl,
	overlayActions,
	onNavigateDashboard,
	onOpenInsertMenu,
	onOpenCollaboration,
	onOpenChat,
	onInsertOverlay,
}: ProfilePanelProps) {
	return (
		<div className="max-h-[calc(100vh-9rem)] space-y-4 overflow-auto px-4 py-4">
			<div className="flex items-center gap-3 rounded-[10px] border border-stone-200 bg-stone-50 px-4 py-4">
				{userImageUrl ? (
					<img src={userImageUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
				) : (
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white">
						{initials}
					</div>
				)}
				<div className="min-w-0">
					<div className="truncate text-sm font-semibold text-stone-900">{profileName}</div>
					<div className="truncate text-xs text-stone-500">{profileEmail}</div>
					<div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
						Canvas workspace
					</div>
				</div>
			</div>

			<div className="rounded-[10px] border border-stone-200 bg-white px-4 py-4">
				<div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
					Quick Actions
				</div>
				<div className="mt-3 grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={onNavigateDashboard}
						className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} rounded-[8px] px-3 py-3 text-left text-sm font-medium normal-case tracking-normal text-stone-800`}
					>
						Browse Canvases
					</button>
					<button
						type="button"
						onClick={onOpenInsertMenu}
						className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} rounded-[8px] px-3 py-3 text-left text-sm font-medium normal-case tracking-normal text-stone-800`}
					>
						Open Insert Menu
					</button>
					<button
						type="button"
						onClick={onOpenCollaboration}
						className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} rounded-[8px] px-3 py-3 text-left text-sm font-medium normal-case tracking-normal text-stone-800`}
					>
						Live Collaboration
					</button>
					<button
						type="button"
						onClick={onOpenChat}
						className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} rounded-[8px] px-3 py-3 text-left text-sm font-medium normal-case tracking-normal text-stone-800`}
					>
						Open AI Assistant
					</button>
				</div>
			</div>

			<div>
				<div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
					Available Inserts
				</div>
				<div className="space-y-2">
					{overlayActions.map((action) => (
						<button
							key={action.type}
							type="button"
							onClick={() => onInsertOverlay(action.type)}
							className="flex w-full items-start justify-between rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-3 text-left hover:border-[#d7dafd] hover:bg-[#f3f1ff]"
						>
							<div>
								<div className="text-sm font-semibold text-stone-900">{action.label}</div>
								<div className="mt-1 text-xs text-stone-500">{action.description}</div>
							</div>
							<span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
								Add
							</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
