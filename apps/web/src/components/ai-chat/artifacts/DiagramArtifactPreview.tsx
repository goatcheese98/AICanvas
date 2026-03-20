import { DiagramArtifactCard } from '../AIChatDiagramArtifactCard';
import type { AssistantInsertionState, DiagramInsertInput } from '../ai-chat-types';
import type { AssistantArtifact } from '@ai-canvas/shared/types';

interface DiagramArtifactPreviewProps {
	artifact: AssistantArtifact;
	artifactKey: string;
	insertionState?: AssistantInsertionState;
	onUndoInsertedArtifact?: (artifactKey: string) => void;
	onInsertRenderedDiagram?: (artifactKey: string, input: DiagramInsertInput) => void;
}

export function DiagramArtifactPreview({
	artifact,
	artifactKey,
	insertionState,
	onUndoInsertedArtifact,
	onInsertRenderedDiagram,
}: DiagramArtifactPreviewProps) {
	return (
		<DiagramArtifactCard
			artifactKey={artifactKey}
			artifact={artifact}
			insertionState={insertionState}
			onUndoInsertedArtifact={onUndoInsertedArtifact}
			onInsertRenderedDiagram={onInsertRenderedDiagram}
		/>
	);
}
