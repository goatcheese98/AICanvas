import { PatchArtifactCard } from './AIChatPatchArtifactCard';
import {
	CodeArtifactCard,
	DiagramArtifactPreview,
	ImageArtifactCard,
	ImageVectorArtifactCard,
	KanbanArtifactCard,
	LayoutPlanArtifactCard,
	PrototypeArtifactCard,
} from './artifacts';
import type { ArtifactCardProps } from './artifacts/artifact-card-types';

export function ArtifactCard(props: ArtifactCardProps) {
	const { artifact } = props;

	// Diagram artifacts (mermaid, d2)
	if (artifact.type === 'mermaid' || artifact.type === 'd2') {
		return <DiagramArtifactPreview {...props} />;
	}

	// Patch artifacts (markdown-patch, kanban-patch)
	if (artifact.type === 'markdown-patch' || artifact.type === 'kanban-patch') {
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
