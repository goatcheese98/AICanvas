import { useMountEffect } from '@/hooks/useMountEffect';
import type { NewLexCommentThread } from '@ai-canvas/shared/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	CONTENT_COMMIT_DEBOUNCE_MS,
	DEFAULT_NEWLEX_CONTENT,
	DEFAULT_NEWLEX_TITLE,
	MAX_NEWLEX_TITLE_LENGTH,
	createCommentThread,
	createReply,
	serializeComments,
	shouldShowLexicalDebugPanel,
} from './lexical-note-helpers';
import type {
	LexicalNoteProps,
	PersistCommentsOptions,
	ReplyDraftByThread,
	UpdateThreadFn,
} from './lexical-note-types';
import { useBufferedDocument } from './useBufferedDocument';

interface UseLexicalNoteStateArgs extends LexicalNoteProps {}

export function useLexicalNoteState({
	element,
	mode,
	isSelected,
	isActive: _isActive,
	onChange,
	onActivityChange,
}: UseLexicalNoteStateArgs) {
	const incomingTitle = element.customData.title?.trim() || DEFAULT_NEWLEX_TITLE;
	const incomingLexicalState = element.customData.lexicalState || DEFAULT_NEWLEX_CONTENT;
	const [isEditing, setIsEditing] = useState(mode === 'shell');
	const [title, setTitle] = useState(incomingTitle);
	const [titleNotice, setTitleNotice] = useState(false);
	const [comments, setComments] = useState<NewLexCommentThread[]>(
		element.customData.comments ?? [],
	);
	const [commentsPanelOpen, setCommentsPanelOpen] = useState(
		Boolean(element.customData.commentsPanelOpen),
	);
	const [selectedCommentId, setSelectedCommentIdState] = useState<string | null>(null);
	const [replyDraftByThread, setReplyDraftByThread] = useState<ReplyDraftByThread>({});
	const [showCommentComposer, setShowCommentComposer] = useState(false);
	const [commentDraft, setCommentDraft] = useState('');
	const [pendingAnchorText, setPendingAnchorText] = useState('');
	const onActivityChangeRef = useRef(onActivityChange);
	const lastReportedEditingRef = useRef<boolean | null>(null);
	const commentsRef = useRef(comments);
	const titleNoticeTimeoutRef = useRef<number | null>(null);
	const externalTitleRef = useRef(incomingTitle);
	const externalCommentsRef = useRef(serializeComments(element.customData.comments ?? []));
	const lastCommittedTitleRef = useRef(incomingTitle);
	const titleCommitTimeoutRef = useRef<number | null>(null);
	const [debugEnabled] = useState(() => shouldShowLexicalDebugPanel());

	const { editorInitialValue, editorInstanceKey, scheduleLocalChange, flush, debugState } =
		useBufferedDocument({
			remoteValue: incomingLexicalState,
			isEditing,
			debounceMs: CONTENT_COMMIT_DEBOUNCE_MS,
			onCommit: (lexicalState) => onChange(element.id, { lexicalState }),
			enableDebugMetrics: debugEnabled,
		});

	// Sync callback ref to latest (justified ref sync pattern)
	onActivityChangeRef.current = onActivityChange;

	// Keep commentsRef in sync (justified ref sync pattern)
	commentsRef.current = comments;

	useEffect(() => {
		if (incomingTitle === externalTitleRef.current) return;

		externalTitleRef.current = incomingTitle;
		lastCommittedTitleRef.current = incomingTitle;
		setTitle((current) => (current === incomingTitle ? current : incomingTitle));
	}, [incomingTitle]);

	useEffect(() => {
		const nextComments = element.customData.comments ?? [];
		const nextSignature = serializeComments(nextComments);
		if (nextSignature === externalCommentsRef.current) return;

		externalCommentsRef.current = nextSignature;
		if (serializeComments(commentsRef.current) !== nextSignature) {
			setComments(nextComments);
		}
	}, [element.customData.comments]);

	const prevIsSelectedRef = useRef(isSelected);
	useEffect(() => {
		if (prevIsSelectedRef.current && !isSelected) {
			flush('deselect');
			setIsEditing(false);
			setShowCommentComposer(false);
		}
		prevIsSelectedRef.current = isSelected;
	}, [flush, isSelected]);

	// Cleanup on unmount
	useMountEffect(() => {
		return () => {
			flush('unmount');
		};
	});

	// Derived: is actively editing
	const isActivelyEditing = isEditing || commentsPanelOpen || showCommentComposer;

	// Ref-based debounced title commit - moved to useEffect to avoid render-phase updates
	useEffect(() => {
		if (title !== externalTitleRef.current && title !== lastCommittedTitleRef.current) {
			if (titleCommitTimeoutRef.current !== null) {
				window.clearTimeout(titleCommitTimeoutRef.current);
			}
			titleCommitTimeoutRef.current = window.setTimeout(() => {
				lastCommittedTitleRef.current = title;
				onChange(element.id, { title });
			}, 180);
		}
	}, [title, element.id, onChange]);

	// Report activity changes - moved to useEffect to avoid render-phase updates
	useEffect(() => {
		if (lastReportedEditingRef.current !== isActivelyEditing) {
			lastReportedEditingRef.current = isActivelyEditing;
			onActivityChangeRef.current?.(isActivelyEditing);
		}
	}, [isActivelyEditing]);

	// Cleanup timeouts on unmount
	useMountEffect(() => {
		return () => {
			if (titleNoticeTimeoutRef.current !== null) {
				window.clearTimeout(titleNoticeTimeoutRef.current);
			}
			if (titleCommitTimeoutRef.current !== null) {
				window.clearTimeout(titleCommitTimeoutRef.current);
			}
			if (lastReportedEditingRef.current) {
				onActivityChangeRef.current?.(false);
				lastReportedEditingRef.current = false;
			}
		};
	});

	// Derived: selected comment ID validation (filter out invalid selections)
	const validSelectedCommentId = useMemo(() => {
		if (!selectedCommentId) return null;
		if (comments.some((thread) => thread.id === selectedCommentId)) {
			return selectedCommentId;
		}
		return null;
	}, [comments, selectedCommentId]);

	// Wrapper to keep selectedCommentId and validSelectedCommentId in sync
	const setSelectedCommentId = useCallback((id: string | null) => {
		setSelectedCommentIdState(id);
	}, []);

	const persistComments = useCallback(
		(nextComments: NewLexCommentThread[], options?: PersistCommentsOptions) => {
			const nextOpen = options?.nextOpen ?? commentsPanelOpen;
			const nextSelectedCommentId =
				options && 'nextSelectedCommentId' in options
					? (options.nextSelectedCommentId ?? null)
					: selectedCommentId;

			setComments(nextComments);
			commentsRef.current = nextComments;
			setCommentsPanelOpen(nextOpen);
			setSelectedCommentIdState(nextSelectedCommentId);
			onChange(element.id, { comments: nextComments });
		},
		[commentsPanelOpen, element.id, onChange, selectedCommentId],
	);

	const handleRequestComment = useCallback((selectedText: string) => {
		setPendingAnchorText(
			selectedText.length > 100 ? `${selectedText.slice(0, 99)}...` : selectedText,
		);
		setCommentDraft('');
		setShowCommentComposer(true);
	}, []);

	const submitInlineComment = useCallback(() => {
		const content = commentDraft.trim();
		if (!content) return;
		const thread = createCommentThread(content, pendingAnchorText);
		const next = [...commentsRef.current, thread];
		persistComments(next, {
			nextOpen: true,
			nextSelectedCommentId: thread.id,
		});
		setCommentDraft('');
		setPendingAnchorText('');
		setShowCommentComposer(false);
	}, [commentDraft, pendingAnchorText, persistComments]);

	const updateThread = useCallback(
		(threadId: string, updater: UpdateThreadFn) => {
			persistComments(
				commentsRef.current.map((thread) => (thread.id === threadId ? updater(thread) : thread)),
			);
		},
		[persistComments],
	);

	const deleteThread = useCallback(
		(threadId: string) => {
			persistComments(
				commentsRef.current.filter((thread) => thread.id !== threadId),
				{
					nextSelectedCommentId: selectedCommentId === threadId ? null : selectedCommentId,
				},
			);
			setReplyDraftByThread((current) => {
				const next = { ...current };
				delete next[threadId];
				return next;
			});
		},
		[persistComments, selectedCommentId],
	);

	const deleteComment = useCallback(
		(threadId: string, replyId?: string) => {
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
		},
		[updateThread],
	);

	const addReply = useCallback(
		(threadId: string) => {
			const draft = (replyDraftByThread[threadId] || '').trim();
			if (!draft) return;
			updateThread(threadId, (thread) => ({
				...thread,
				replies: [...thread.replies, createReply(draft)],
			}));
			setReplyDraftByThread((current) => ({ ...current, [threadId]: '' }));
		},
		[replyDraftByThread, updateThread],
	);

	const showTitleLimitNotice = useCallback(() => {
		setTitleNotice(true);
		if (titleNoticeTimeoutRef.current !== null) {
			window.clearTimeout(titleNoticeTimeoutRef.current);
		}
		titleNoticeTimeoutRef.current = window.setTimeout(() => {
			setTitleNotice(false);
			titleNoticeTimeoutRef.current = null;
		}, 1800);
	}, []);

	const handleTitleChange = useCallback(
		(nextValue: string) => {
			if (nextValue.length > MAX_NEWLEX_TITLE_LENGTH) {
				showTitleLimitNotice();
				setTitle(nextValue.slice(0, MAX_NEWLEX_TITLE_LENGTH));
				return;
			}
			setTitle(nextValue);
		},
		[showTitleLimitNotice],
	);

	const commitTitle = useCallback(() => {
		const trimmed = title.trim();
		const nextTitle = trimmed.length > 0 ? trimmed : incomingTitle;
		setTitle(nextTitle);
		if (nextTitle === lastCommittedTitleRef.current) return;
		lastCommittedTitleRef.current = nextTitle;
		onChange(element.id, { title: nextTitle });
	}, [element.id, incomingTitle, onChange, title]);

	const orderedComments = useMemo(
		() => [...comments].sort((a, b) => b.createdAt - a.createdAt),
		[comments],
	);

	const openThreadCount = useMemo(
		() => comments.filter((thread) => !thread.commentDeleted && !thread.resolved).length,
		[comments],
	);

	return {
		editorInitialValue,
		editorInstanceKey,
		scheduleLocalChange,
		flush,
		debugState,
		debugEnabled,
		isEditing,
		setIsEditing,
		title,
		titleNotice,
		handleTitleChange,
		showTitleLimitNotice,
		commitTitle,
		comments,
		commentsPanelOpen,
		setCommentsPanelOpen,
		selectedCommentId: validSelectedCommentId,
		setSelectedCommentId,
		replyDraftByThread,
		setReplyDraftByThread,
		showCommentComposer,
		setShowCommentComposer,
		commentDraft,
		setCommentDraft,
		pendingAnchorText,
		setPendingAnchorText,
		handleRequestComment,
		submitInlineComment,
		deleteThread,
		deleteComment,
		addReply,
		updateThread,
		orderedComments,
		openThreadCount,
		isActivelyEditing,
	};
}
