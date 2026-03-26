import {
	type CollaborationSessionStatus,
	getCollaborationStatusCopy,
} from '@/hooks/collaboration-utils';
import {
	CHROME_BUTTON_ACTIVE,
	CHROME_BUTTON_BASE,
	CHROME_BUTTON_DANGER,
	CHROME_BUTTON_IDLE,
} from './canvas-chrome';

interface CollaborationPanelProps {
	isCollaborating: boolean;
	collaborators: Map<string, { username?: string }>;
	roomLink: string | null;
	sessionError: string | null;
	sessionStatus: CollaborationSessionStatus;
	username: string;
	setUsername: (name: string) => void;
	startSession: () => Promise<void>;
	stopSession: () => void;
}

export function CollaborationPanel({ ...collaboration }: CollaborationPanelProps) {
	const displayNameInputId = 'collaboration-display-name';
	const shareLinkInputId = 'collaboration-share-link';
	const collaboratorList = Array.from(collaboration.collaborators.values()).filter((collaborator) =>
		Boolean(collaborator.username),
	);
	const sessionCopy = getCollaborationStatusCopy(
		collaboration.sessionStatus,
		collaboratorList.length,
		collaboration.sessionError,
	);

	return (
		<div className="max-h-full space-y-4 overflow-auto px-4 py-4">
			<div className="rounded-[10px] border border-stone-200 bg-stone-50 px-3 py-3">
				<div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
					Session Status
				</div>
				<div className="mt-2 text-sm text-stone-900">{sessionCopy.label}</div>
				<div className="mt-1 text-xs text-stone-500">{sessionCopy.detail}</div>
				{collaboratorList.length > 0 ? (
					<div className="mt-3 flex flex-wrap gap-2">
						{collaboratorList.map((collaborator, index) => (
							<span
								key={`${collaborator.username ?? 'anon'}-${index}`}
								className="rounded-[8px] bg-white px-3 py-1 text-[11px] text-stone-700"
							>
								{collaborator.username}
							</span>
						))}
					</div>
				) : null}
			</div>

			<div>
				<label
					htmlFor={displayNameInputId}
					className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500"
				>
					Display Name
				</label>
				<input
					id={displayNameInputId}
					value={collaboration.username}
					onChange={(event) => collaboration.setUsername(event.target.value)}
					className="w-full rounded-[8px] border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none"
					placeholder="Anonymous"
				/>
			</div>

			{collaboration.roomLink ? (
				<div>
					<label
						htmlFor={shareLinkInputId}
						className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500"
					>
						Share Link
					</label>
					<textarea
						id={shareLinkInputId}
						readOnly
						value={collaboration.roomLink}
						className="min-h-24 w-full resize-none rounded-[8px] border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-700 outline-none"
					/>
				</div>
			) : null}

			<div className="flex gap-2">
				{collaboration.isCollaborating ? (
					<>
						<button
							type="button"
							onClick={() => {
								if (collaboration.roomLink) {
									void navigator.clipboard.writeText(collaboration.roomLink);
								}
							}}
							className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_IDLE} flex-1 text-xs`}
						>
							Copy Link
						</button>
						<button
							type="button"
							onClick={collaboration.stopSession}
							className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_DANGER} flex-1 text-xs`}
						>
							Stop
						</button>
					</>
				) : (
					<button
						type="button"
						onClick={() => void collaboration.startSession()}
						className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_ACTIVE} w-full text-xs`}
					>
						Start Collaboration
					</button>
				)}
			</div>
		</div>
	);
}
