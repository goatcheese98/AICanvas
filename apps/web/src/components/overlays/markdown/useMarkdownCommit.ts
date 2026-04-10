import type { MarkdownEditorMode, MarkdownNoteSettings } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useRef } from 'react';
import { serializeNoteState } from './markdown-note-helpers';

interface CommitStateArgs {
	content: string;
	images: Record<string, string>;
	title: string;
	settings: MarkdownNoteSettings;
	editorMode: MarkdownEditorMode;
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
}

interface ScheduleDebounceArgs extends CommitStateArgs {
	externalSignatureRef: React.MutableRefObject<string>;
	timeoutRef: React.MutableRefObject<number | null>;
}

export function commitState({
	content,
	images,
	title,
	settings,
	editorMode,
	elementId,
	onChangeRef,
	lastCommittedSignatureRef,
}: CommitStateArgs): void {
	const nextSignature = serializeNoteState({
		content,
		images,
		title,
		settings,
		editorMode,
	});
	lastCommittedSignatureRef.current = nextSignature;
	onChangeRef.current?.(elementId, content, images, title, settings, editorMode);
}

function scheduleDebounce({
	content,
	images,
	title,
	settings,
	editorMode,
	elementId,
	onChangeRef,
	externalSignatureRef,
	lastCommittedSignatureRef,
	timeoutRef,
}: ScheduleDebounceArgs): void {
	const nextSignature = serializeNoteState({
		content,
		images,
		title,
		settings,
		editorMode,
	});
	if (
		nextSignature === externalSignatureRef.current ||
		nextSignature === lastCommittedSignatureRef.current
	) {
		return;
	}
	if (timeoutRef.current !== null) {
		window.clearTimeout(timeoutRef.current);
	}
	timeoutRef.current = window.setTimeout(() => {
		lastCommittedSignatureRef.current = nextSignature;
		onChangeRef.current?.(elementId, content, images, title, settings, editorMode);
		timeoutRef.current = null;
	}, 180);
}

interface UseMarkdownCommitProps {
	elementId: string;
	onChange: (
		elementId: string,
		content: string,
		images: Record<string, string>,
		title: string,
		settings: MarkdownNoteSettings,
		editorMode: MarkdownEditorMode,
	) => void;
	externalSignature: string;
}

type OnChangeCallback = (
	id: string,
	content: string,
	images: Record<string, string>,
	title: string,
	settings: MarkdownNoteSettings,
	editorMode: MarkdownEditorMode,
	elementStyle?: {
		backgroundColor?: string;
		strokeColor?: string;
		strokeWidth?: number;
		roundness?: ExcalidrawElement['roundness'];
	},
) => void;

interface UseMarkdownCommitReturn {
	onChangeRef: React.MutableRefObject<OnChangeCallback | undefined>;
	externalSignatureRef: React.MutableRefObject<string>;
	lastCommittedSignatureRef: React.MutableRefObject<string>;
	debounceTimeoutRef: React.MutableRefObject<number | null>;
	handleCommit: (state: {
		content: string;
		images: Record<string, string>;
		title: string;
		settings: MarkdownNoteSettings;
		editorMode: MarkdownEditorMode;
	}) => void;
	scheduleAutoCommit: (state: {
		content: string;
		images: Record<string, string>;
		title: string;
		settings: MarkdownNoteSettings;
		editorMode: MarkdownEditorMode;
		isPreview: boolean;
		activeUtilityPanel: string;
	}) => void;
	cleanupDebounce: (state: {
		content: string;
		images: Record<string, string>;
		title: string;
		settings: MarkdownNoteSettings;
		editorMode: MarkdownEditorMode;
	}) => void;
}

export function useMarkdownCommit({
	elementId,
	onChange,
	externalSignature,
}: UseMarkdownCommitProps): UseMarkdownCommitReturn {
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const externalSignatureRef = useRef(externalSignature);
	externalSignatureRef.current = externalSignature;

	const lastCommittedSignatureRef = useRef(externalSignature);
	const debounceTimeoutRef = useRef<number | null>(null);

	const handleCommit = useCallback(
		(state: {
			content: string;
			images: Record<string, string>;
			title: string;
			settings: MarkdownNoteSettings;
			editorMode: MarkdownEditorMode;
		}) => {
			commitState({
				...state,
				elementId,
				onChangeRef,
				lastCommittedSignatureRef,
			});
		},
		[elementId],
	);

	const scheduleAutoCommit = useCallback(
		(state: {
			content: string;
			images: Record<string, string>;
			title: string;
			settings: MarkdownNoteSettings;
			editorMode: MarkdownEditorMode;
			isPreview: boolean;
			activeUtilityPanel: string;
		}) => {
			if (state.isPreview && state.activeUtilityPanel === 'none') {
				return;
			}

			scheduleDebounce({
				content: state.content,
				images: state.images,
				title: state.title,
				settings: state.settings,
				editorMode: state.editorMode,
				elementId,
				onChangeRef,
				externalSignatureRef,
				lastCommittedSignatureRef,
				timeoutRef: debounceTimeoutRef,
			});
		},
		[elementId],
	);

	const cleanupDebounce = useCallback(
		(state: {
			content: string;
			images: Record<string, string>;
			title: string;
			settings: MarkdownNoteSettings;
			editorMode: MarkdownEditorMode;
		}) => {
			if (debounceTimeoutRef.current !== null) {
				window.clearTimeout(debounceTimeoutRef.current);
				commitState({
					...state,
					elementId,
					onChangeRef,
					lastCommittedSignatureRef,
				});
				debounceTimeoutRef.current = null;
			}
		},
		[elementId],
	);

	return {
		onChangeRef,
		externalSignatureRef,
		lastCommittedSignatureRef,
		debounceTimeoutRef,
		handleCommit,
		scheduleAutoCommit,
		cleanupDebounce,
	};
}
