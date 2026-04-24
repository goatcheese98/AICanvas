import type { AssistantArtifact, AssistantMessage, CanvasElement } from '@ai-canvas/shared/types';
import type {
	AssistantInsertionState,
	AssistantPatchApplyState,
	DiagramInsertInput,
	MarkdownPatchReviewState,
} from './ai-chat-types';
import type { AssistantRunProgress } from './run-progress';

/**
 * Authentication context required by AI chat hooks.
 */
export interface AuthContext {
	getToken: () => Promise<string | null>;
	isSignedIn: boolean | undefined;
}

/**
 * Props for AIChatPanel component.
 */
export interface AIChatPanelProps {
	canvasId: string;
}

/**
 * Props for AIChatMessageList component.
 */
export interface AIChatMessageListProps {
	messages: AssistantMessage[];
	elements: readonly CanvasElement[];
	canvasActions: {
		assistantInsertionStates: Record<string, AssistantInsertionState>;
		assistantPatchStates: Record<string, AssistantPatchApplyState>;
		markdownPatchReviewStates: Record<string, MarkdownPatchReviewState>;
		rememberInsertionState: (artifactKey: string, state: AssistantInsertionState) => void;
		insertArtifactOnCanvas: (
			artifact: AssistantArtifact,
		) => Promise<AssistantInsertionState | null>;
		vectorizeRasterAssetOnCanvas: (
			artifact: AssistantArtifact,
		) => Promise<AssistantInsertionState | null>;
		insertRenderedDiagramOnCanvas: (
			input: DiagramInsertInput,
		) => Promise<AssistantInsertionState | null>;
		insertSvgMarkupOnCanvas: (svgMarkup: string) => Promise<AssistantInsertionState | null>;
		removeInsertedArtifact: (artifactKey: string) => void;
		insertMarkdownOnCanvas: (content: string) => Promise<AssistantInsertionState | null>;
		updateMarkdownPatchAcceptedHunks: (artifactKey: string, acceptedHunkIds: string[]) => void;
		applyAssistantPatch: (
			artifactKey: string,
			artifact: AssistantArtifact,
			mode?: 'apply' | 'reapply',
			options?: { markdownContentOverride?: string },
		) => boolean;
		undoAssistantPatch: (artifactKey: string) => void;
	};
	runProgress: AssistantRunProgress | null;
	isRunProgressExpanded: boolean;
	setIsRunProgressExpanded: (value: boolean | ((prev: boolean) => boolean)) => void;
	latestMessage: AssistantMessage | null;
	setChatError: (error: string | null) => void;
}

/**
 * Props for AIChatEmptyState component.
 */
export interface AIChatEmptyStateProps {
	onSuggestionClick?: (suggestion: string) => void;
}

/**
 * UI State for AIChatPanel.
 */
interface AIChatPanelUIState {
	input: string;
	setInput: (value: string) => void;
	isHistoryCollapsed: boolean;
	setIsHistoryCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
}
