import { parseStoredAssistantAssetContent } from '@ai-canvas/shared/schemas';
import type { AssistantArtifact } from '@ai-canvas/shared/types';

export function describeAssistantArtifact(artifact: AssistantArtifact): string {
	const storedAsset = parseStoredAssistantAssetContent(artifact.content);
	if (!storedAsset) {
		return artifact.content;
	}

	const lines = [
		`Provider: ${storedAsset.provider}`,
		storedAsset.model
			? `Model: ${storedAsset.model}`
			: storedAsset.tool
				? `Tool: ${storedAsset.tool}`
				: null,
		storedAsset.mimeType ? `MIME: ${storedAsset.mimeType}` : null,
		storedAsset.prompt ? `Prompt: ${storedAsset.prompt}` : null,
		storedAsset.revisedPrompt ? `Revised prompt: ${storedAsset.revisedPrompt}` : null,
	];

	return lines.filter(Boolean).join('\n');
}

export function buildMarkdownArtifactContent(artifact: AssistantArtifact): string {
	switch (artifact.type) {
		case 'mermaid':
			return ['# Mermaid Draft', '', '```mermaid', artifact.content, '```'].join('\n');
		case 'd2':
			return ['# D2 Draft', '', '```d2', artifact.content, '```'].join('\n');
		case 'markdown':
			return artifact.content;
		case 'layout-plan':
			return ['# Layout Plan', '', '```json', artifact.content, '```'].join('\n');
		case 'image-vector':
			return ['# Vectorized Asset', '', describeAssistantArtifact(artifact)].join('\n');
		case 'kanban-ops':
			return ['# Kanban Operations', '', '```json', artifact.content, '```'].join('\n');
		case 'prototype-files':
			return ['# Prototype Files', '', '```json', artifact.content, '```'].join('\n');
		case 'prototype-patch':
			return ['# Prototype Patch', '', '```json', artifact.content, '```'].join('\n');
		case 'markdown-patch':
		case 'kanban-patch':
			return ['# Patch Artifact', '', '```json', artifact.content, '```'].join('\n');
		case 'image':
			return ['# Image Artifact', '', describeAssistantArtifact(artifact)].join('\n');
	}
}
