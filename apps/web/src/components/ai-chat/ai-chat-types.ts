import type { AssistantArtifact } from '@ai-canvas/shared/types';

export type AssistantPatchApplyState = {
	status: 'idle' | 'applied' | 'undone';
	targetId: string;
	targetType: 'markdown' | 'kanban' | 'prototype';
	previousCustomData: Record<string, unknown>;
};

export type AssistantInsertionState = {
	status: 'inserted' | 'removed';
	insertedElementIds: string[];
	insertedFileIds?: string[];
	insertMode?: 'native-vector' | 'image-file';
	vectorStrategy?: 'sketch-vectorizer' | 'svg-trace' | 'svg-compile';
};

export type MarkdownPatchReviewState = {
	acceptedHunkIds: string[];
};

export type AssistantPatchApplyOptions = {
	markdownContentOverride?: string;
};

type PendingSelectionConfirmation = {
	prompt: string;
	createdAt: string;
} | null;

export type SelectionIndicator = {
	count: number;
	label: string;
	detail: string;
} | null;

export type DiagramInsertInput = {
	title: string;
	svgMarkup: string;
	width: number;
	height: number;
	diagram: {
		language: 'mermaid' | 'd2';
		code: string;
	};
};

export type PatchArtifactDescriptor = {
	artifact: AssistantArtifact;
	artifactKey: string;
};
