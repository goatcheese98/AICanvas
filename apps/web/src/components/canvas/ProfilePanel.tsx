import { useAppStore } from '@/stores/store';
import { CollaborationPanel } from './CollaborationPanel';
import type { CollaborationPanelProps } from './CollaborationPanel';
import { CHROME_BUTTON_ACTIVE, CHROME_BUTTON_BASE, CHROME_BUTTON_IDLE } from './canvas-chrome';

interface ProfilePanelProps {
	initials: string;
	profileName: string;
	profileEmail: string;
	userImageUrl?: string;
	collaboration: CollaborationPanelProps;
	onSaveCanvas: () => Promise<void>;
	onNavigateDashboard: () => void;
}

function formatLastSaved(lastSaved: Date | null): string {
	if (!lastSaved) {
		return 'No remote save yet.';
	}

	return `Last saved at ${lastSaved.toLocaleTimeString([], {
		hour: 'numeric',
		minute: '2-digit',
	})}`;
}

export function ProfilePanel({
	initials,
	profileName,
	profileEmail,
	userImageUrl,
	collaboration,
	onSaveCanvas,
	onNavigateDashboard,
}: ProfilePanelProps) {
	const isSaving = useAppStore((s) => s.isSaving);
	const isRemoteSaving = useAppStore((s) => s.isRemoteSaving);
	const lastSaved = useAppStore((s) => s.lastSaved);
	const hasUnsavedChanges = useAppStore((s) => s.hasUnsavedChanges);
	const isSaveActive = isSaving || isRemoteSaving;
	const saveStatus = isSaveActive
		? 'Saving canvas…'
		: hasUnsavedChanges
			? 'Unsaved changes pending sync.'
			: formatLastSaved(lastSaved);

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

			<div className="rounded-[10px] border border-stone-200 bg-stone-50 px-3 py-3">
				<div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
					Canvas Sync
				</div>
				<div className="mt-2 text-sm text-stone-900">{saveStatus}</div>
				<div className="mt-1 text-xs text-stone-500">
					Changes flush automatically every minute and also when you save manually.
				</div>
				<button
					type="button"
					onClick={() => void onSaveCanvas()}
					disabled={isSaveActive}
					className={`${CHROME_BUTTON_BASE} ${
						isSaveActive ? CHROME_BUTTON_IDLE : CHROME_BUTTON_ACTIVE
					} mt-3 w-full text-xs disabled:cursor-wait disabled:opacity-70`}
				>
					{isSaveActive ? 'Saving…' : 'Save Canvas'}
				</button>
			</div>

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
