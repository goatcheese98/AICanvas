import { useEffect, useMemo, useRef, useState } from 'react';
import type { NewLexCommentThread, NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { LexicalEditor } from './LexicalEditor';

type LexicalElement = ExcalidrawElement & {
	customData: NewLexOverlayCustomData;
};

interface LexicalNoteProps {
	element: LexicalElement;
	isSelected: boolean;
	onChange: (
		elementId: string,
		updates: {
			lexicalState?: string;
			comments?: NewLexOverlayCustomData['comments'];
			commentsPanelOpen?: boolean;
		},
	) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

const DEFAULT_NEWLEX_CONTENT =
	'{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

function createCommentThread(comment: string): NewLexCommentThread {
	return {
		id: crypto.randomUUID(),
		author: 'You',
		comment,
		commentDeleted: false,
		anchorText: '',
		createdAt: Date.now(),
		resolved: false,
		collapsed: false,
		replies: [],
	};
}

export function LexicalNote({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: LexicalNoteProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [draftComment, setDraftComment] = useState('');
	const [comments, setComments] = useState<NewLexCommentThread[]>(element.customData.comments ?? []);
	const [commentsPanelOpen, setCommentsPanelOpen] = useState(Boolean(element.customData.commentsPanelOpen));
	const onEditingChangeRef = useRef(onEditingChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);

	useEffect(() => {
		onEditingChangeRef.current = onEditingChange;
	}, [onEditingChange]);

	useEffect(() => {
		setComments(element.customData.comments ?? []);
	}, [element.customData.comments]);

	useEffect(() => {
		setCommentsPanelOpen(Boolean(element.customData.commentsPanelOpen));
	}, [element.customData.commentsPanelOpen]);

	useEffect(() => {
		if (!isSelected) setIsEditing(false);
	}, [isSelected]);

	const isActivelyEditing = isEditing || commentsPanelOpen;

	useEffect(() => {
		if (lastReportedEditingRef.current === isActivelyEditing) return;
		lastReportedEditingRef.current = isActivelyEditing;
		onEditingChangeRef.current?.(isActivelyEditing);
	}, [isActivelyEditing]);

	useEffect(
		() => () => {
			if (lastReportedEditingRef.current) {
				onEditingChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		},
		[],
	);

	const openThreadCount = useMemo(
		() => comments.filter((thread) => !thread.commentDeleted && !thread.resolved).length,
		[comments],
	);

	const persistComments = (nextComments: NewLexCommentThread[], nextOpen = commentsPanelOpen) => {
		setComments(nextComments);
		setCommentsPanelOpen(nextOpen);
		onChange(element.id, {
			comments: nextComments,
			commentsPanelOpen: nextOpen,
		});
	};

	return (
		<OverlaySurface element={element} isSelected={isSelected} className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-stone-200 bg-stone-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
				<span>Rich Text</span>
				<div className="flex items-center gap-2">
					<button
						type="button"
						className="rounded-full bg-stone-200 px-2 py-1 text-[10px] text-stone-700"
						onClick={() => {
							const next = !commentsPanelOpen;
							setCommentsPanelOpen(next);
							onChange(element.id, { commentsPanelOpen: next });
						}}
					>
						{openThreadCount} comments
					</button>
					{isSelected && (
						<button
							type="button"
							className="rounded-full border border-stone-300 px-2 py-1 text-[10px] text-stone-700"
							onClick={() => setIsEditing((current) => !current)}
						>
							{isEditing ? 'Read' : 'Edit'}
						</button>
					)}
				</div>
			</div>

			<div className="min-h-0 flex flex-1" onDoubleClick={() => isSelected && setIsEditing(true)}>
				<div className="min-w-0 flex-1">
					<LexicalEditor
						namespace={`canvas-note-${element.id}`}
						initialState={element.customData.lexicalState || DEFAULT_NEWLEX_CONTENT}
						readOnly={!isEditing}
						onChange={(lexicalState) => onChange(element.id, { lexicalState })}
					/>
				</div>

				{commentsPanelOpen ? (
					<aside className="flex w-72 shrink-0 flex-col border-l border-stone-200 bg-stone-50/90">
						<div className="border-b border-stone-200 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
							Discussion
						</div>
						<div className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3">
							{comments.length === 0 ? (
								<div className="rounded-2xl border border-dashed border-stone-300 bg-white px-3 py-4 text-xs text-stone-500">
									No comments yet. Add one to review this note with collaborators.
								</div>
							) : (
								comments.map((thread) => (
									<div key={thread.id} className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-xs text-stone-600">
										<div className="flex items-center justify-between gap-2">
											<div className="font-semibold text-stone-800">{thread.author}</div>
											<div className="flex gap-2">
												<button
													type="button"
													className="text-[10px] uppercase tracking-[0.18em] text-stone-500"
													onClick={() =>
														persistComments(
															comments.map((candidate) =>
																candidate.id === thread.id
																	? { ...candidate, resolved: !candidate.resolved }
																	: candidate,
															),
														)
													}
												>
													{thread.resolved ? 'Reopen' : 'Resolve'}
												</button>
												<button
													type="button"
													className="text-[10px] uppercase tracking-[0.18em] text-rose-600"
													onClick={() =>
														persistComments(
															comments.map((candidate) =>
																candidate.id === thread.id
																	? { ...candidate, commentDeleted: true }
																	: candidate,
															),
														)
													}
												>
													Delete
												</button>
											</div>
										</div>
										<div className={`mt-2 ${thread.commentDeleted ? 'italic text-stone-400 line-through' : ''}`}>
											{thread.commentDeleted ? 'Comment removed' : thread.comment}
										</div>
										{thread.replies?.length ? (
											<div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
												{thread.replies.map((reply) => (
													<div key={reply.id} className="rounded-xl bg-stone-50 px-3 py-2">
														<div className="font-semibold text-stone-700">{reply.author}</div>
														<div className="mt-1">{reply.deleted ? 'Reply removed' : reply.message}</div>
													</div>
												))}
											</div>
										) : null}
									</div>
								))
							)}
						</div>
						<div className="border-t border-stone-200 px-3 py-3">
							<textarea
								value={draftComment}
								onChange={(event) => setDraftComment(event.target.value)}
								placeholder="Add a comment..."
								className="min-h-24 w-full resize-none rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none"
							/>
							<div className="mt-2 flex justify-end">
								<button
									type="button"
									disabled={!draftComment.trim()}
									onClick={() => {
										const nextComments = [...comments, createCommentThread(draftComment.trim())];
										persistComments(nextComments, true);
										setDraftComment('');
									}}
									className="rounded-full bg-stone-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-40"
								>
									Add comment
								</button>
							</div>
						</div>
					</aside>
				) : null}
			</div>
		</OverlaySurface>
	);
}
