import type { MarkdownEditorMode, MarkdownNoteSettings } from '@ai-canvas/shared/types';
import { useCallback } from 'react';
import { toggleMarkdownCheckboxLine } from './markdown-utils';
import { commitState } from './useMarkdownCommit';

interface CheckboxState {
	content: string;
	images: Record<string, string>;
	title: string;
	settings: MarkdownNoteSettings;
	editorMode: MarkdownEditorMode;
}

interface UseMarkdownCheckboxProps {
	elementId: string;
	onChangeRef: React.MutableRefObject<
		| ((
				id: string,
				content: string,
				images: Record<string, string>,
				title: string,
				settings: MarkdownNoteSettings,
				editorMode: MarkdownEditorMode,
		  ) => void)
		| undefined
	>;
	lastCommittedSignatureRef: React.MutableRefObject<string>;
	stateRef: React.MutableRefObject<CheckboxState>;
}

interface UseMarkdownCheckboxReturn {
	handleEditorCheckboxToggle: (
		lineIndex: number,
		onContentChange: (content: string) => void,
	) => void;
	handlePreviewCheckboxToggle: (lineIndex: number) => void;
}

export function useMarkdownCheckbox({
	elementId,
	onChangeRef,
	lastCommittedSignatureRef,
	stateRef,
}: UseMarkdownCheckboxProps): UseMarkdownCheckboxReturn {
	const handleEditorCheckboxToggle = useCallback(
		(lineIndex: number, onContentChange: (content: string) => void) => {
			const nextContent = toggleMarkdownCheckboxLine(stateRef.current.content, lineIndex);
			onContentChange(nextContent);
		},
		[stateRef],
	);

	const handlePreviewCheckboxToggle = useCallback(
		(lineIndex: number) => {
			const currentState = stateRef.current;
			const nextContent = toggleMarkdownCheckboxLine(currentState.content, lineIndex);
			stateRef.current = { ...currentState, content: nextContent };
			commitState({
				content: nextContent,
				images: currentState.images,
				title: currentState.title,
				settings: currentState.settings,
				editorMode: currentState.editorMode,
				elementId,
				onChangeRef,
				lastCommittedSignatureRef,
			});
		},
		[elementId, onChangeRef, lastCommittedSignatureRef, stateRef],
	);

	return {
		handleEditorCheckboxToggle,
		handlePreviewCheckboxToggle,
	};
}
