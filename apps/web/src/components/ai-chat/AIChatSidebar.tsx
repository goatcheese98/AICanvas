import type { AssistantThread } from '@ai-canvas/shared/types';
import { PANEL_BUTTON, PANEL_BUTTON_ACTIVE } from './ai-chat-constants';
import { formatThreadTimestamp, getThreadDisplayTitle, getThreadPreview } from './ai-chat-helpers';

export function AIChatSidebar({
	isHistoryCollapsed,
	threads,
	currentThreadId,
	onToggleCollapse,
	onCreateThread,
	onSelectThread,
	onDeleteThread,
}: {
	isHistoryCollapsed: boolean;
	threads: AssistantThread[];
	currentThreadId: string | null;
	onToggleCollapse: () => void;
	onCreateThread: () => void;
	onSelectThread: (threadId: string) => void;
	onDeleteThread: (threadId: string) => void;
}) {
	return (
		<section aria-label="Chat history" className="border-b border-stone-200 bg-white px-4 py-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
						Chats
					</div>
					<div className="mt-1 text-[11px] text-stone-500">
						Recent threads stay above the conversation so the panel reads top to bottom.
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						onClick={onToggleCollapse}
						className="group inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-stone-200 text-stone-500 transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900"
						aria-label={isHistoryCollapsed ? 'Show chat history' : 'Hide chat history'}
						title={isHistoryCollapsed ? 'Show chat history' : 'Hide chat history'}
					>
						<span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
							<span
								className={`absolute left-0 top-1/2 h-4 w-px -translate-y-1/2 rounded-full bg-current/35 origin-center transition-all duration-200 ${
									isHistoryCollapsed ? 'scale-y-0 opacity-0' : 'scale-y-100 opacity-100'
								}`}
							/>
							<svg
								viewBox="0 0 12 12"
								aria-hidden="true"
								focusable="false"
								className={`relative ml-1 h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
									isHistoryCollapsed ? 'rotate-180' : 'rotate-0'
								}`}
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M7.5 2.5 4 6l3.5 3.5" />
							</svg>
						</span>
					</button>
					<button
						type="button"
						onClick={onCreateThread}
						className={`${PANEL_BUTTON} ${PANEL_BUTTON_ACTIVE}`}
						title="Create a new chat"
					>
						New Chat
					</button>
				</div>
			</div>

			{!isHistoryCollapsed ? (
				<div className="mt-3 grid max-h-52 gap-2 overflow-auto pr-1 sm:grid-cols-2">
					{threads.map((thread) => {
						const isActive = thread.id === currentThreadId;
						const displayTitle = getThreadDisplayTitle(thread);
						return (
							<div key={thread.id} className="group relative">
								<button
									type="button"
									onClick={() => onSelectThread(thread.id)}
									className={`flex h-full w-full flex-col rounded-[12px] border px-3 py-2 text-left transition-colors ${
										isActive
											? 'border-[#d7dafd] bg-[#f3f1ff]'
											: 'border-stone-200 bg-white hover:border-[#d7dafd] hover:bg-[#f8f7ff]'
									}`}
								>
									<div className="flex items-center justify-between gap-2">
										<div className="min-w-0 truncate text-[13px] font-medium text-stone-900">
											{displayTitle}
										</div>
										<div className="shrink-0 text-[9px] text-stone-400">
											{formatThreadTimestamp(thread.updatedAt)}
										</div>
									</div>
									<div className="mt-1 truncate text-[11px] text-stone-500">
										{getThreadPreview(thread)}
									</div>
								</button>
								<button
									type="button"
									onClick={(event) => {
										event.stopPropagation();
										onDeleteThread(thread.id);
									}}
									className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-stone-500 opacity-0 transition-all hover:bg-white hover:text-rose-600 group-hover:opacity-100"
									aria-label={`Delete ${thread.title}`}
									title={`Delete ${thread.title}`}
								>
									<svg
										viewBox="0 0 12 12"
										className="h-3 w-3"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
										aria-hidden="true"
									>
										<path d="M3 3l6 6" />
										<path d="M9 3 3 9" />
									</svg>
								</button>
							</div>
						);
					})}
				</div>
			) : (
				<div className="mt-3 rounded-[10px] border border-dashed border-stone-200 bg-stone-50 px-3 py-3 text-[11px] text-stone-500">
					Chat history is hidden.
				</div>
			)}

			{!isHistoryCollapsed && threads.length === 0 ? (
				<div className="mt-3 rounded-[10px] border border-dashed border-stone-200 bg-stone-50 px-3 py-3 text-[11px] text-stone-500">
					No saved chats for this canvas yet.
				</div>
			) : null}
		</section>
	);
}
