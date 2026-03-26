import type { AssistantThread } from '@ai-canvas/shared/types';
import { PANEL_BUTTON, PANEL_BUTTON_ACTIVE, PANEL_BUTTON_IDLE } from './ai-chat-constants';
import {
	formatThreadTimestamp,
	getThreadDisplayTitle,
	getThreadMonogram,
	getThreadPreview,
} from './ai-chat-helpers';

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
		<aside
			className={`flex min-h-0 shrink-0 flex-col border-r border-stone-200 bg-stone-50 transition-[width] duration-200 ${
				isHistoryCollapsed ? 'w-[60px]' : 'w-[286px]'
			}`}
		>
			<div className="border-b border-stone-200 px-3 py-2">
				<div
					className={`flex items-center ${isHistoryCollapsed ? 'justify-center' : 'justify-between'} gap-2`}
				>
					{isHistoryCollapsed ? null : (
						<div className="text-[11px] font-medium text-stone-500">History</div>
					)}
					<button
						type="button"
						onClick={onToggleCollapse}
						className="group inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-transparent text-stone-500 transition-all duration-200 hover:border-stone-200 hover:bg-white hover:text-stone-900"
						aria-label={isHistoryCollapsed ? 'Expand chat history' : 'Collapse chat history'}
						title={isHistoryCollapsed ? 'Expand chat history' : 'Collapse chat history'}
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
				</div>
				<button
					type="button"
					onClick={onCreateThread}
					className={`mt-2 ${PANEL_BUTTON} ${isHistoryCollapsed ? PANEL_BUTTON_ACTIVE : PANEL_BUTTON_IDLE} ${
						isHistoryCollapsed ? 'h-9 w-full rounded-[9px] px-0' : 'w-full justify-center'
					}`}
					title="Create a new chat"
				>
					{isHistoryCollapsed ? (
						<span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
							<span className="absolute h-px w-4 rounded-full bg-current" />
							<span className="absolute h-4 w-px rounded-full bg-current" />
						</span>
					) : (
						'New Chat'
					)}
				</button>
			</div>

			<div className="min-h-0 flex-1 overflow-auto p-2">
				<div className="space-y-1">
					{threads.map((thread) => {
						const isActive = thread.id === currentThreadId;
						const displayTitle = getThreadDisplayTitle(thread);
						return (
							<div key={thread.id} className="group relative">
								<button
									type="button"
									onClick={() => onSelectThread(thread.id)}
									className={`text-left transition-colors ${
										isHistoryCollapsed
											? `flex h-9 w-full items-center justify-center rounded-[10px] border ${
													isActive
														? 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]'
														: 'border-stone-200 bg-white text-stone-500 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]'
												}`
											: `flex w-full items-start rounded-[10px] border px-3 py-2 ${
													isActive
														? 'border-[#d7dafd] bg-[#f3f1ff]'
														: 'border-transparent bg-transparent hover:border-stone-200 hover:bg-white'
												}`
									}`}
								>
									{isHistoryCollapsed ? (
										<span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
											{getThreadMonogram(displayTitle)}
										</span>
									) : (
										<div className="min-w-0 flex-1 pr-7">
											<div className="flex items-center justify-between gap-3">
												<div className="truncate text-[13px] font-medium text-stone-900">
													{displayTitle}
												</div>
												<div className="shrink-0 text-[9px] text-stone-400">
													{formatThreadTimestamp(thread.updatedAt)}
												</div>
											</div>
											<div className="mt-1 truncate text-[11px] text-stone-500">
												{getThreadPreview(thread)}
											</div>
										</div>
									)}
								</button>
								{!isHistoryCollapsed && threads.length > 0 ? (
									<button
										type="button"
										onClick={(event) => {
											event.stopPropagation();
											onDeleteThread(thread.id);
										}}
										className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-stone-500 opacity-0 transition-all hover:bg-white hover:text-rose-600 group-hover:opacity-100"
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
								) : null}
							</div>
						);
					})}
					{threads.length === 0 ? (
						<div className="rounded-[10px] border border-dashed border-stone-200 bg-white px-3 py-4 text-[11px] text-stone-500">
							No saved chats for this canvas yet.
						</div>
					) : null}
				</div>
			</div>
		</aside>
	);
}
