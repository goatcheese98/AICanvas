import type {
	AssistantArtifact,
	CanvasElement,
	GenerationMode,
} from '@ai-canvas/shared/types';
import type {
	AssistantInsertionState,
	AssistantPatchApplyOptions,
	AssistantPatchApplyState,
	MarkdownPatchReviewState,
} from '../ai-chat-types';

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
