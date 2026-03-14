import type { NewLexCommentThread } from '@ai-canvas/shared/types';
import { formatTimestamp } from './lexical-note-helpers';

interface LexicalCommentsPanelProps {
	orderedComments: NewLexCommentThread[];
	selectedCommentId: string | null;
	replyDraftByThread: Record<string, string>;
	onSelectComment: (threadId: string) => void;
	onDeleteThread: (threadId: string) => void;
	onToggleResolved: (threadId: string) => void;
	onDeleteComment: (threadId: string, replyId?: string) => void;
	onReplyDraftChange: (threadId: string, value: string) => void;
	onAddReply: (threadId: string) => void;
}

export function LexicalCommentsPanel({
	orderedComments,
	selectedCommentId,
	replyDraftByThread,
	onSelectComment,
	onDeleteThread,
	onToggleResolved,
	onDeleteComment,
	onReplyDraftChange,
	onAddReply,
}: LexicalCommentsPanelProps) {
	return (
		<aside className="flex w-[300px] shrink-0 flex-col border-l border-stone-200 bg-stone-50/95 backdrop-blur-sm">
			<div className="border-b border-stone-200 bg-white/70 px-4 py-3">
				<h2 className="text-sm font-semibold text-stone-800">Comments</h2>
				<p className="mt-1 text-xs text-stone-500">Discuss selections and decisions on this note.</p>
			</div>
			<div className="min-h-0 flex-1 overflow-auto">
				{orderedComments.length === 0 ? (
					<div className="px-4 py-6 text-center text-sm text-stone-500">
						No comments yet.
					</div>
				) : (
					<ul className="space-y-3 px-3 py-3">
						{orderedComments.map((thread) => {
							const isActiveThread = selectedCommentId === thread.id;

							return (
								<li
									key={thread.id}
									onClick={() => onSelectComment(thread.id)}
									className={`rounded-[16px] border px-3 py-3 shadow-sm transition ${
										isActiveThread
											? 'border-[#d7dafd] bg-[#f3f1ff]'
											: 'border-stone-200 bg-white'
									}`}
								>
									<div className="flex items-start justify-between gap-3">
										<blockquote className="min-w-0 border-l-2 border-stone-300 pl-3 text-xs text-stone-500">
											{thread.anchorText || '(no selection)'}
										</blockquote>
										<button
											type="button"
											className="text-[10px] uppercase tracking-[0.15em] text-rose-600"
											onClick={(event) => {
												event.stopPropagation();
												onDeleteThread(thread.id);
											}}
										>
											Delete
										</button>
									</div>

									<div className="mt-3 rounded-[12px] bg-stone-50 px-3 py-2.5">
										<div className="flex items-center justify-between gap-2">
											<div className="text-xs font-semibold text-stone-800">{thread.author}</div>
											<div className="text-[11px] text-stone-500">{formatTimestamp(thread.createdAt)}</div>
										</div>
										<p className={`mt-2 text-sm ${thread.commentDeleted ? 'italic text-stone-400' : 'text-stone-700'}`}>
											{thread.comment || '(empty comment)'}
										</p>
										<div className="mt-2 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.15em]">
											<button
												type="button"
												className="text-stone-500"
												onClick={(event) => {
													event.stopPropagation();
													onToggleResolved(thread.id);
												}}
											>
												{thread.resolved ? 'Reopen' : 'Resolve'}
											</button>
											{!thread.commentDeleted ? (
												<button
													type="button"
													className="text-rose-600"
													onClick={(event) => {
														event.stopPropagation();
														onDeleteComment(thread.id);
													}}
												>
													Delete Comment
												</button>
											) : null}
										</div>
									</div>

									{thread.replies.length > 0 ? (
										<ul className="mt-3 space-y-2">
											{thread.replies.map((reply) => (
												<li key={reply.id} className="rounded-[12px] border border-stone-200 bg-white px-3 py-2.5">
													<div className="flex items-center justify-between gap-2">
														<div className="text-xs font-semibold text-stone-700">{reply.author}</div>
														<div className="text-[11px] text-stone-500">{formatTimestamp(reply.createdAt)}</div>
													</div>
													<p className={`mt-1 text-sm ${reply.deleted ? 'italic text-stone-400' : 'text-stone-600'}`}>
														{reply.message}
													</p>
													{!reply.deleted ? (
														<div className="mt-2">
															<button
																type="button"
																className="text-[10px] font-semibold uppercase tracking-[0.15em] text-rose-600"
																onClick={(event) => {
																	event.stopPropagation();
																	onDeleteComment(thread.id, reply.id);
																}}
															>
																Delete Reply
															</button>
														</div>
													) : null}
												</li>
											))}
										</ul>
									) : null}

									<div className="mt-3 flex items-center gap-2">
										<input
											value={replyDraftByThread[thread.id] || ''}
											onClick={(event) => event.stopPropagation()}
											onChange={(event) => onReplyDraftChange(thread.id, event.target.value)}
											onKeyDown={(event) => {
												if (event.key !== 'Enter' || event.shiftKey) return;
												event.preventDefault();
												onAddReply(thread.id);
											}}
											placeholder="Reply..."
											className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-[#d7dafd] focus:bg-[#f8f8ff]"
										/>
										<button
											type="button"
											className="rounded-full border border-[#d7dafd] bg-[#eef0ff] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4d55cc] transition hover:bg-[#e3e7ff]"
											onClick={(event) => {
												event.stopPropagation();
												onAddReply(thread.id);
											}}
										>
											Send
										</button>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</aside>
	);
}
