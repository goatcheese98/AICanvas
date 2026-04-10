import { CollaborationPanel } from './CollaborationPanel';
import type { CollaborationPanelProps } from './CollaborationPanel';
import { CHROME_BUTTON_BASE, CHROME_BUTTON_IDLE } from './canvas-chrome';

interface ProfilePanelProps {
	initials: string;
	profileName: string;
	profileEmail: string;
	userImageUrl?: string;
	collaboration: CollaborationPanelProps;
	onNavigateDashboard: () => void;
}

export function ProfilePanel({
	initials,
	profileName,
	profileEmail,
	userImageUrl,
	collaboration,
	onNavigateDashboard,
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

			<CollaborationPanel {...collaboration} />

			<button
				type="button"
				onClick={onNavigateDashboard}
				className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} w-full rounded-[8px] px-3 py-3 text-left text-sm font-medium normal-case tracking-normal text-stone-800`}
			>
				Back To Dashboard
			</button>
		</div>
	);
}
