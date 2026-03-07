import { useNavigate } from '@tanstack/react-router';
import { useAppStore } from '@/stores/store';
import { AIChatPanel } from '@/components/ai-chat';

interface CanvasUIProps {
	canvasId: string;
	collaboration: {
		isCollaborating: boolean;
		collaborators: Map<string, { username?: string }>;
		roomLink: string | null;
		username: string;
		setUsername: (name: string) => void;
		startSession: () => Promise<void>;
		stopSession: () => void;
	};
}

export function CanvasUI({ canvasId, collaboration }: CanvasUIProps) {
	const navigate = useNavigate();
	const activePanel = useAppStore((s) => s.activePanel);
	const setActivePanel = useAppStore((s) => s.setActivePanel);
	const collaboratorList = Array.from(collaboration.collaborators.values()).filter((collaborator) =>
		Boolean(collaborator.username),
	);

	return (
		<>
			<div className="absolute left-16 top-4 z-20">
				<button
					type="button"
					onClick={() => void navigate({ to: '/dashboard' })}
					className="rounded-full border border-stone-200 bg-white/92 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-700 shadow-md backdrop-blur hover:bg-white"
				>
					Back To Dashboard
				</button>
			</div>

			<div className="absolute right-4 top-4 z-20 flex gap-2">
				<button
					type="button"
					onClick={() => setActivePanel(activePanel === 'chat' ? 'none' : 'chat')}
					className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] shadow-md backdrop-blur ${
						activePanel === 'chat'
							? 'bg-stone-900 text-white'
							: 'border border-stone-200 bg-white/92 text-stone-700 hover:bg-white'
					}`}
				>
					AI
				</button>
				<button
					type="button"
					onClick={() => setActivePanel(activePanel === 'collab' ? 'none' : 'collab')}
					className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] shadow-md backdrop-blur ${
						activePanel === 'collab'
							? 'bg-stone-900 text-white'
							: 'border border-stone-200 bg-white/92 text-stone-700 hover:bg-white'
					}`}
				>
					Live
				</button>
			</div>

			{/* AI Chat Panel */}
			{activePanel === 'chat' && (
				<div className="absolute bottom-4 right-4 top-16 z-20 w-96 rounded-xl bg-white shadow-xl">
					<AIChatPanel />
				</div>
			)}

			{activePanel === 'collab' && (
				<div className="absolute right-4 top-16 z-20 w-96 rounded-[28px] border border-stone-200 bg-white shadow-xl">
					<div className="border-b border-stone-200 px-4 py-4">
						<div className="text-sm font-semibold text-stone-900">Live Collaboration</div>
						<div className="mt-1 text-xs text-stone-500">
							End-to-end encrypted room sharing through PartyKit.
						</div>
					</div>
					<div className="space-y-4 px-4 py-4">
						<div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3">
							<div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
								Session Status
							</div>
							<div className="mt-2 text-sm text-stone-900">
								{collaboration.isCollaborating ? 'Live' : 'Not connected'}
							</div>
							<div className="mt-1 text-xs text-stone-500">
								{collaboratorList.length} collaborator{collaboratorList.length === 1 ? '' : 's'} connected
							</div>
							{collaboratorList.length > 0 ? (
								<div className="mt-3 flex flex-wrap gap-2">
									{collaboratorList.map((collaborator, index) => (
										<span
											key={`${collaborator.username ?? 'anon'}-${index}`}
											className="rounded-full bg-white px-3 py-1 text-[11px] text-stone-700"
										>
											{collaborator.username}
										</span>
									))}
								</div>
							) : null}
						</div>

						<div>
							<label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
								Display Name
							</label>
							<input
								value={collaboration.username}
								onChange={(event) => collaboration.setUsername(event.target.value)}
								className="w-full rounded-2xl border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none"
								placeholder="Anonymous"
							/>
						</div>

						{collaboration.roomLink ? (
							<div>
								<label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
									Share Link
								</label>
								<textarea
									readOnly
									value={collaboration.roomLink}
									className="min-h-24 w-full resize-none rounded-2xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-700 outline-none"
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
										className="flex-1 rounded-full border border-stone-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-700"
									>
										Copy Link
									</button>
									<button
										type="button"
										onClick={collaboration.stopSession}
										className="flex-1 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
									>
										Stop Session
									</button>
								</>
							) : (
								<button
									type="button"
									onClick={() => void collaboration.startSession()}
									className="w-full rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
								>
									Start Collaboration
								</button>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}
