import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NewLexCommentReply, NewLexCommentThread, NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useAppStore } from '@/stores/store';
import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { LexicalEditor } from './LexicalEditor';
import { LexicalDebugPanel } from './LexicalDebugPanel';
import { useBufferedDocument } from './useBufferedDocument';

type LexicalElement = ExcalidrawElement & {
	customData: NewLexOverlayCustomData;
};

interface LexicalNoteProps {
	element: LexicalElement;
	isSelected: boolean;
	onChange: (
		elementId: string,
		updates: {
			title?: string;
			lexicalState?: string;
			comments?: NewLexOverlayCustomData['comments'];
		},
	) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

const DEFAULT_NEWLEX_CONTENT =
	'{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';
const CONTENT_COMMIT_DEBOUNCE_MS = 350;
const NOTE_FONT_STACK =
	'"Segoe UI Variable", "SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const MAX_NEWLEX_TITLE_LENGTH = 32;
const DEFAULT_NEWLEX_TITLE = 'Rich Text';
const MIN_EXPANDED_EDITOR_WIDTH = 1120;
const MIN_EXPANDED_EDITOR_WITH_COMMENTS_WIDTH = 1420;

function formatTimestamp(timestamp: number) {
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(timestamp));
}

function createCommentThread(comment: string, anchorText = ''): NewLexCommentThread {
	return {
		id: crypto.randomUUID(),
		author: 'You',
		comment,
		commentDeleted: false,
		anchorText,
		createdAt: Date.now(),
		resolved: false,
		collapsed: false,
		replies: [],
	};
}

function createReply(message: string): NewLexCommentReply {
	return {
		id: crypto.randomUUID(),
		author: 'You',
		message,
		createdAt: Date.now(),
		deleted: false,
	};
}

function shouldShowLexicalDebugPanel() {
	if (!import.meta.env.DEV || typeof window === 'undefined') return false;
	const url = new URL(window.location.href);
	return (
		url.searchParams.get('debugLexical') === '1' ||
		window.localStorage.getItem('ai-canvas:debug:lexical') === '1'
	);
}

export function LexicalNote({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: LexicalNoteProps) {
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const incomingTitle = element.customData.title?.trim() || DEFAULT_NEWLEX_TITLE;
	const incomingLexicalState = element.customData.lexicalState || DEFAULT_NEWLEX_CONTENT;
	const [isEditing, setIsEditing] = useState(false);
	const [title, setTitle] = useState(incomingTitle);
	const [titleNotice, setTitleNotice] = useState(false);
	const [comments, setComments] = useState<NewLexCommentThread[]>(element.customData.comments ?? []);
	const [commentsPanelOpen, setCommentsPanelOpen] = useState(Boolean(element.customData.commentsPanelOpen));
	const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
	const [replyDraftByThread, setReplyDraftByThread] = useState<Record<string, string>>({});
	const [showCommentComposer, setShowCommentComposer] = useState(false);
	const [commentDraft, setCommentDraft] = useState('');
	const [pendingAnchorText, setPendingAnchorText] = useState('');
	const onEditingChangeRef = useRef(onEditingChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);
	const commentsRef = useRef(comments);
	const titleNoticeTimeoutRef = useRef<number | null>(null);
	const externalTitleRef = useRef(incomingTitle);
	const lastCommittedTitleRef = useRef(incomingTitle);
	const [debugEnabled] = useState(() => shouldShowLexicalDebugPanel());
	const renderCountRef = useRef(0);
	renderCountRef.current += 1;

	const {
		editorInitialValue,
		editorInstanceKey,
		scheduleLocalChange,
		flush,
		debugState,
	} = useBufferedDocument({
		remoteValue: incomingLexicalState,
		isEditing,
		debounceMs: CONTENT_COMMIT_DEBOUNCE_MS,
		onCommit: (lexicalState) => onChange(element.id, { lexicalState }),
		enableDebugMetrics: debugEnabled,
	});

	useEffect(() => {
		onEditingChangeRef.current = onEditingChange;
	}, [onEditingChange]);

	useEffect(() => {
		if (incomingTitle === externalTitleRef.current) return;
		externalTitleRef.current = incomingTitle;
		lastCommittedTitleRef.current = incomingTitle;
		setTitle((current) => (current === incomingTitle ? current : incomingTitle));
	}, [incomingTitle]);

	useEffect(() => {
		setComments(element.customData.comments ?? []);
	}, [element.customData.comments]);

	useEffect(() => {
		commentsRef.current = comments;
	}, [comments]);

	useEffect(() => {
		if (!isSelected) {
			flush('deselect');
			setIsEditing(false);
			setShowCommentComposer(false);
		}
	}, [flush, isSelected]);

	useEffect(() => {
		if (!selectedCommentId) return;
		if (comments.some((thread) => thread.id === selectedCommentId)) return;
		setSelectedCommentId(null);
	}, [comments, selectedCommentId]);

	const isActivelyEditing = isEditing || commentsPanelOpen || showCommentComposer;

	useEffect(() => {
		if (lastReportedEditingRef.current === isActivelyEditing) return;
		lastReportedEditingRef.current = isActivelyEditing;
		onEditingChangeRef.current?.(isActivelyEditing);
	}, [isActivelyEditing]);

	useEffect(
		() => () => {
			if (titleNoticeTimeoutRef.current !== null) {
				window.clearTimeout(titleNoticeTimeoutRef.current);
			}
			if (lastReportedEditingRef.current) {
				onEditingChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		},
		[],
	);

	useEffect(() => {
		if (title === externalTitleRef.current || title === lastCommittedTitleRef.current) return;
		const timeout = window.setTimeout(() => {
			lastCommittedTitleRef.current = title;
			onChange(element.id, { title });
		}, 180);
		return () => window.clearTimeout(timeout);
	}, [element.id, onChange, title]);

	const persistComments = (nextComments: NewLexCommentThread[], nextOpen = commentsPanelOpen) => {
		setComments(nextComments);
		commentsRef.current = nextComments;
		setCommentsPanelOpen(nextOpen);
		onChange(element.id, { comments: nextComments });
	};

	const handleRequestComment = (selectedText: string) => {
		setPendingAnchorText(selectedText.length > 100 ? `${selectedText.slice(0, 99)}…` : selectedText);
		setCommentDraft('');
		setShowCommentComposer(true);
	};

	const submitInlineComment = () => {
		const content = commentDraft.trim();
		if (!content) return;
		const thread = createCommentThread(content, pendingAnchorText);
		const next = [...commentsRef.current, thread];
		persistComments(next, true);
		setSelectedCommentId(thread.id);
		setCommentDraft('');
		setPendingAnchorText('');
		setShowCommentComposer(false);
	};

	const updateThread = (
		threadId: string,
		updater: (thread: NewLexCommentThread) => NewLexCommentThread,
	) => {
		persistComments(
			commentsRef.current.map((thread) => (thread.id === threadId ? updater(thread) : thread)),
		);
	};

	const deleteThread = (threadId: string) => {
		persistComments(commentsRef.current.filter((thread) => thread.id !== threadId));
		setReplyDraftByThread((current) => {
			const next = { ...current };
			delete next[threadId];
			return next;
		});
		if (selectedCommentId === threadId) setSelectedCommentId(null);
	};

	const deleteComment = (threadId: string, replyId?: string) => {
		if (!replyId) {
			updateThread(threadId, (thread) => ({
				...thread,
				comment: '[Deleted Comment]',
				commentDeleted: true,
			}));
			return;
		}
		updateThread(threadId, (thread) => ({
			...thread,
			replies: thread.replies.map((reply) =>
				reply.id === replyId ? { ...reply, message: '[Deleted Comment]', deleted: true } : reply,
			),
		}));
	};

	const addReply = (threadId: string) => {
		const draft = (replyDraftByThread[threadId] || '').trim();
		if (!draft) return;
		updateThread(threadId, (thread) => ({
			...thread,
			replies: [...thread.replies, createReply(draft)],
		}));
		setReplyDraftByThread((current) => ({ ...current, [threadId]: '' }));
	};

	const showTitleLimitNotice = () => {
		setTitleNotice(true);
		if (titleNoticeTimeoutRef.current !== null) {
			window.clearTimeout(titleNoticeTimeoutRef.current);
		}
		titleNoticeTimeoutRef.current = window.setTimeout(() => {
			setTitleNotice(false);
			titleNoticeTimeoutRef.current = null;
		}, 1800);
	};

	const handleTitleChange = (nextValue: string) => {
		if (nextValue.length > MAX_NEWLEX_TITLE_LENGTH) {
			showTitleLimitNotice();
			setTitle(nextValue.slice(0, MAX_NEWLEX_TITLE_LENGTH));
			return;
		}
		setTitle(nextValue);
	};

	const commitTitle = useCallback(() => {
		const trimmed = title.trim();
		const nextTitle = trimmed.length > 0 ? trimmed : incomingTitle;
		setTitle(nextTitle);
		if (nextTitle === lastCommittedTitleRef.current) return;
		lastCommittedTitleRef.current = nextTitle;
		onChange(element.id, { title: nextTitle });
	}, [element.id, incomingTitle, onChange, title]);

	const expandForToolbar = useCallback(() => {
		if (!excalidrawApi) return;
		const targetWidth = commentsPanelOpen
			? MIN_EXPANDED_EDITOR_WITH_COMMENTS_WIDTH
			: MIN_EXPANDED_EDITOR_WIDTH;
		if (element.width >= targetWidth) return;

		const nextElements = excalidrawApi.getSceneElements().map((candidate) => {
			if (candidate.id !== element.id) return candidate;
			return {
				...candidate,
				width: targetWidth,
				version: (candidate.version ?? 0) + 1,
				versionNonce: Math.floor(Math.random() * 2 ** 31),
			};
		});

		excalidrawApi.updateScene({ elements: nextElements });
	}, [commentsPanelOpen, element.id, element.width, excalidrawApi]);

	const orderedComments = useMemo(
		() => [...comments].sort((a, b) => b.createdAt - a.createdAt),
		[comments],
	);

	const openThreadCount = useMemo(
		() => comments.filter((thread) => !thread.commentDeleted && !thread.resolved).length,
		[comments],
	);

	const needsToolbarExpansion =
		isEditing &&
		isSelected &&
		element.width <
			(commentsPanelOpen
				? MIN_EXPANDED_EDITOR_WITH_COMMENTS_WIDTH
				: MIN_EXPANDED_EDITOR_WIDTH);

	return (
		<OverlaySurface
			element={element}
			isSelected={isSelected}
			backgroundColor={element.backgroundColor ?? '#ffffff'}
			className="relative flex h-full flex-col"
			style={{
				fontFamily: NOTE_FONT_STACK,
			}}
		>
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-200/90 bg-transparent px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
				<div className="min-w-0">
					{isSelected ? (
						<div className="min-w-0">
							<input
								type="text"
								value={title}
								maxLength={MAX_NEWLEX_TITLE_LENGTH}
								onChange={(event) => handleTitleChange(event.target.value)}
								onPaste={(event) => {
									const pasted = event.clipboardData.getData('text');
									if (event.currentTarget.value.length + pasted.length > MAX_NEWLEX_TITLE_LENGTH) {
										showTitleLimitNotice();
									}
								}}
								onBlur={commitTitle}
								className="w-full min-w-0 rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-600 outline-none transition-colors focus:border-[#d7dafd] focus:bg-white/70"
								aria-label="Rich text title"
							/>
								{titleNotice ? (
									<div className="mt-1 text-[10px] font-semibold normal-case tracking-normal text-amber-600">
										Title is limited to 32 characters.
									</div>
								) : null}
						</div>
					) : (
						<span className="truncate px-1 text-stone-600">{title}</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					{needsToolbarExpansion ? (
						<button
							type="button"
							className="rounded-[8px] border border-[#d7dafd] bg-[#eef0ff] px-2.5 py-1 text-[10px] text-[#4d55cc] transition hover:bg-[#e3e7ff]"
							onClick={expandForToolbar}
						>
							Expand
						</button>
					) : null}
					<button
						type="button"
						className={`rounded-[8px] border px-2.5 py-1 text-[10px] transition-colors ${
							commentsPanelOpen
								? 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]'
								: 'border-stone-200 bg-white text-stone-700 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]'
						}`}
						onClick={() => {
							setCommentsPanelOpen((current) => !current);
						}}
					>
						{openThreadCount} comments
					</button>
					{isSelected ? (
						<button
							type="button"
							className={`rounded-[8px] border px-2.5 py-1 text-[10px] transition-colors ${
								isEditing
									? 'border-stone-900 bg-stone-900 text-white'
									: 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
							}`}
							onClick={() => setIsEditing((current) => !current)}
						>
							{isEditing ? 'Exit' : 'Edit'}
						</button>
					) : null}
				</div>
			</div>

			<div
				className="min-h-0 flex flex-1 bg-transparent"
				onDoubleClick={() => isSelected && setIsEditing(true)}
			>
				<div className="min-w-0 flex-1">
					<LexicalEditor
						key={`${element.id}:${editorInstanceKey}`}
						namespace={`canvas-note-${element.id}`}
						initialState={editorInitialValue}
						readOnly={!isEditing}
						onChange={scheduleLocalChange}
						onRequestComment={handleRequestComment}
						onToggleCommentsPanel={() => {
							setCommentsPanelOpen((current) => !current);
						}}
						isCommentsPanelOpen={commentsPanelOpen}
					/>
				</div>

				{commentsPanelOpen ? (
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
												onClick={() => setSelectedCommentId(thread.id)}
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
															deleteThread(thread.id);
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
																updateThread(thread.id, (current) => ({
																	...current,
																	resolved: !current.resolved,
																}));
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
																	deleteComment(thread.id);
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
																				deleteComment(thread.id, reply.id);
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
														onChange={(event) =>
															setReplyDraftByThread((current) => ({
																...current,
																[thread.id]: event.target.value,
															}))
														}
														onKeyDown={(event) => {
															if (event.key !== 'Enter' || event.shiftKey) return;
															event.preventDefault();
															addReply(thread.id);
														}}
														placeholder="Reply..."
														className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none transition focus:border-[#d7dafd] focus:bg-[#f8f8ff]"
													/>
													<button
														type="button"
														className="rounded-full border border-[#d7dafd] bg-[#eef0ff] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4d55cc] transition hover:bg-[#e3e7ff]"
														onClick={(event) => {
															event.stopPropagation();
															addReply(thread.id);
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
				) : null}
			</div>
			{debugEnabled && isSelected ? (
				<LexicalDebugPanel
					elementId={element.id}
					renderCount={renderCountRef.current}
					debugState={debugState}
				/>
			) : null}

			{showCommentComposer && typeof document !== 'undefined'
				? createPortal(
						<div
							style={{
								position: 'fixed',
								inset: 0,
								zIndex: 4020,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								background: 'rgba(28,25,23,0.18)',
								backdropFilter: 'blur(3px)',
							}}
						>
							<div
								style={{
									width: 320,
									borderRadius: 18,
									border: '1px solid #e7e5e4',
									background: 'rgba(255,255,255,0.98)',
									boxShadow: '0 22px 60px rgba(28,25,23,0.2)',
									padding: 18,
									display: 'flex',
									flexDirection: 'column',
									gap: 12,
									fontFamily: NOTE_FONT_STACK,
								}}
							>
								<div>
									<div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#78716c' }}>
										New Comment
									</div>
									<div style={{ marginTop: 4, fontSize: 14, color: '#57534e' }}>
										Add context for this selection or note.
									</div>
								</div>
								{pendingAnchorText ? (
									<blockquote
										style={{
											margin: 0,
											padding: '6px 10px',
											borderLeft: '3px solid #d6d3d1',
											background: '#fafaf9',
											color: '#78716c',
											fontSize: 13,
										}}
									>
										{pendingAnchorText}
									</blockquote>
								) : null}
								<textarea
									autoFocus
									value={commentDraft}
									onChange={(event) => setCommentDraft(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
											event.preventDefault();
											submitInlineComment();
										}
										if (event.key === 'Escape') {
											event.preventDefault();
											setShowCommentComposer(false);
										}
									}}
									placeholder="Type a comment..."
									style={{
										minHeight: 90,
										resize: 'vertical',
										borderRadius: 14,
										border: '1px solid #d6d3d1',
										padding: '10px 12px',
										fontSize: 14,
										outline: 'none',
									}}
								/>
								<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
									<button
										type="button"
										onClick={() => setShowCommentComposer(false)}
										style={{
											border: 0,
										background: '#f5f5f4',
										color: '#57534e',
											padding: '8px 12px',
											borderRadius: 999,
											fontSize: 13,
											cursor: 'pointer',
										}}
									>
										Cancel
									</button>
									<button
										type="button"
										disabled={!commentDraft.trim()}
										onClick={submitInlineComment}
										style={{
											border: 0,
										background: '#4d55cc',
											color: '#fff',
											padding: '8px 14px',
											borderRadius: 999,
											fontSize: 13,
											cursor: commentDraft.trim() ? 'pointer' : 'not-allowed',
											opacity: commentDraft.trim() ? 1 : 0.45,
										}}
									>
										Comment
									</button>
								</div>
							</div>
						</div>,
						document.body,
					)
				: null}
		</OverlaySurface>
	);
}
