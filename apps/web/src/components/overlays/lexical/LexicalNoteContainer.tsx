import { OverlaySurface } from '@/components/overlays/overlay-surface';
import { useAppStore } from '@/stores/store';
import { type MouseEvent, useCallback, useRef } from 'react';
import { LexicalCommentComposer } from './LexicalCommentComposer';
import { LexicalCommentsPanel } from './LexicalCommentsPanel';
import { LexicalDebugPanel } from './LexicalDebugPanel';
import { LexicalEditor } from './LexicalEditor';
import { LexicalNoteHeader } from './LexicalNoteHeader';
import {
	MIN_EXPANDED_EDITOR_WIDTH,
	MIN_EXPANDED_EDITOR_WITH_COMMENTS_WIDTH,
	NOTE_FONT_STACK,
} from './lexical-note-helpers';
import type { LexicalNoteProps } from './lexical-note-types';
import { useLexicalNoteState } from './useLexicalNoteState';

export function LexicalNoteContainer({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: LexicalNoteProps) {
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const renderCountRef = useRef(0);
	renderCountRef.current += 1;

	const {
		editorInitialValue,
		editorInstanceKey,
		scheduleLocalChange,
		debugState,
		debugEnabled,
		isEditing,
		setIsEditing,
		title,
		titleNotice,
		handleTitleChange,
		showTitleLimitNotice,
		commitTitle,
		commentsPanelOpen,
		setCommentsPanelOpen,
		selectedCommentId,
		setSelectedCommentId,
		replyDraftByThread,
		setReplyDraftByThread,
		showCommentComposer,
		setShowCommentComposer,
		commentDraft,
		setCommentDraft,
		pendingAnchorText,
		handleRequestComment,
		submitInlineComment,
		deleteThread,
		deleteComment,
		addReply,
		updateThread,
		orderedComments,
	} = useLexicalNoteState({
		element,
		isSelected,
		onChange,
		onEditingChange,
	});

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

	const handlePreviewDoubleClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (!isSelected || isEditing) return;
			event.preventDefault();
			event.stopPropagation();
			window.getSelection()?.removeAllRanges();
			setIsEditing(true);
		},
		[isEditing, isSelected, setIsEditing],
	);

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
			<LexicalNoteHeader
				title={title}
				titleNotice={titleNotice}
				isSelected={isSelected}
				isEditing={isEditing}
				commentsPanelOpen={commentsPanelOpen}
				commentCount={orderedComments.length}
				elementWidth={element.width}
				onTitleChange={handleTitleChange}
				onCommitTitle={commitTitle}
				onToggleCommentsPanel={() => {
					setCommentsPanelOpen((current) => !current);
				}}
				onToggleEditing={() => setIsEditing((current) => !current)}
				onExpandForToolbar={expandForToolbar}
				onShowTitleLimitNotice={showTitleLimitNotice}
			/>

			<div
				data-testid="lexical-note-body"
				className="min-h-0 flex flex-1 bg-transparent"
				onDoubleClick={handlePreviewDoubleClick}
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
					<LexicalCommentsPanel
						orderedComments={orderedComments}
						selectedCommentId={selectedCommentId}
						replyDraftByThread={replyDraftByThread}
						onSelectComment={setSelectedCommentId}
						onDeleteThread={deleteThread}
						onToggleResolved={(threadId) => {
							updateThread(threadId, (current) => ({
								...current,
								resolved: !current.resolved,
							}));
						}}
						onDeleteComment={deleteComment}
						onReplyDraftChange={(threadId, value) =>
							setReplyDraftByThread((current) => ({
								...current,
								[threadId]: value,
							}))
						}
						onAddReply={addReply}
					/>
				) : null}
			</div>

			{debugEnabled && isSelected ? (
				<LexicalDebugPanel
					elementId={element.id}
					renderCount={renderCountRef.current}
					debugState={debugState}
				/>
			) : null}

			<LexicalCommentComposer
				show={showCommentComposer}
				pendingAnchorText={pendingAnchorText}
				commentDraft={commentDraft}
				onChangeDraft={setCommentDraft}
				onClose={() => setShowCommentComposer(false)}
				onSubmit={submitInlineComment}
			/>
		</OverlaySurface>
	);
}
