import { PatchArtifactCard } from './AIChatPatchArtifactCard';
import type {
	AssistantInsertionState,
	AssistantPatchApplyOptions,
	AssistantPatchApplyState,
	MarkdownPatchReviewState,
} from './ai-chat-types';
import {
	CodeArtifactCard,
	DiagramArtifactPreview,
	ImageArtifactCard,
	ImageVectorArtifactCard,
	KanbanArtifactCard,
	LayoutPlanArtifactCard,
	PrototypeArtifactCard,
} from './artifacts';
import type { AssistantArtifact, CanvasElement, GenerationMode } from '@ai-canvas/shared/types';

export interface ArtifactCardProps {
	artifact: AssistantArtifact;
	artifactKey: string;
	elements?: readonly CanvasElement[];
	onInsertArtifact?: (artifactKey: string, artifact: AssistantArtifact) => void;
	onVectorizeArtifact?: (artifactKey: string, artifact: AssistantArtifact) => void;
	insertionState?: AssistantInsertionState;
	onUndoInsertedArtifact?: (artifactKey: string) => void;
	onInsertRenderedDiagram?: (
		artifactKey: string,
		input: {
			title: string;
			svgMarkup: string;
			width: number;
			height: number;
			diagram: { language: 'mermaid' | 'd2'; code: string };
		},
	) => void;
	patchApplyState?: AssistantPatchApplyState;
	markdownReviewState?: MarkdownPatchReviewState;
	onChangeMarkdownAcceptedHunks?: (artifactKey: string, acceptedHunkIds: string[]) => void;
	onApplyPatch?: (
		artifactKey: string,
		artifact: AssistantArtifact,
		options?: AssistantPatchApplyOptions,
	) => void;
	onUndoPatch?: (artifactKey: string, artifact: AssistantArtifact) => void;
	onReapplyPatch?: (
		artifactKey: string,
		artifact: AssistantArtifact,
		options?: AssistantPatchApplyOptions,
	) => void;
	generationMode?: GenerationMode;
	hasVectorCompanionArtifact?: boolean;
}

export function ArtifactCard(props: ArtifactCardProps) {
	const { artifact } = props;

	// Diagram artifacts (mermaid, d2)
	if (artifact.type === 'mermaid' || artifact.type === 'd2') {
		return <DiagramArtifactPreview {...props} />;
	}

	// Patch artifacts (markdown-patch, kanban-patch, prototype-patch)
	if (
		artifact.type === 'markdown-patch' ||
		artifact.type === 'kanban-patch' ||
		artifact.type === 'prototype-patch'
	) {
		return (
			<PatchArtifactCard
				artifact={props.artifact}
				artifactKey={props.artifactKey}
				applyState={props.patchApplyState}
				elements={props.elements}
				markdownReviewState={props.markdownReviewState}
				onChangeMarkdownAcceptedHunks={props.onChangeMarkdownAcceptedHunks}
				onApplyPatch={props.onApplyPatch}
				onUndoPatch={props.onUndoPatch}
				onReapplyPatch={props.onReapplyPatch}
			/>
		);
	}

	// Type-specific dispatch
	switch (artifact.type) {
		case 'markdown':
			return <CodeArtifactCard {...props} label="Markdown" language="Markdown" />;
		case 'kanban-ops':
			return <KanbanArtifactCard {...props} />;
		case 'prototype-files':
			return <PrototypeArtifactCard {...props} />;
		case 'image':
			return <ImageArtifactCard {...props} />;
		case 'image-vector':
			return <ImageVectorArtifactCard {...props} />;
		case 'layout-plan':
			return <LayoutPlanArtifactCard artifact={artifact} />;
		default:
			return null;
	}
}

// Public API: export ArtifactCard as AIChatArtifactCard for backward compatibility
export { ArtifactCard as AIChatArtifactCard };
