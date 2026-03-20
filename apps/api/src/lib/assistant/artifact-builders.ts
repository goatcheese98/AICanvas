import {
	parseStoredAssistantAssetContent,
	serializeStoredAssistantAssetContent,
} from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantArtifactRecord,
	AssistantContextMode,
	GenerationMode,
} from '@ai-canvas/shared/types';
import { generateAssistantResponse } from './service';

function uniqueArtifacts(artifacts: AssistantArtifact[]): AssistantArtifact[] {
	const seen = new Set<string>();
	return artifacts.filter((artifact) => {
		const key = `${artifact.type}:${artifact.content}`;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

function enrichStoredArtifactContent(artifact: AssistantArtifactRecord): string {
	if (artifact.type !== 'image' && artifact.type !== 'image-vector') {
		return artifact.content;
	}

	const parsed = parseStoredAssistantAssetContent(artifact.content);
	if (!parsed) {
		return artifact.content;
	}

	return serializeStoredAssistantAssetContent({
		...parsed,
		artifactId: artifact.id,
		runId: artifact.runId,
	});
}

export function getArtifactTitle(
	type: 'mermaid' | 'd2' | 'kanban-ops' | 'kanban-patch' | 'prototype-files' | 'markdown-patch',
): string {
	switch (type) {
		case 'mermaid':
			return 'Generated Mermaid draft';
		case 'd2':
			return 'Generated D2 draft';
		case 'kanban-ops':
			return 'Generated Kanban operations';
		case 'kanban-patch':
			return 'Generated Kanban patch';
		case 'prototype-files':
			return 'Generated prototype files';
		case 'markdown-patch':
			return 'Generated Markdown patch';
	}
}

export async function buildMarkdownOverlayArtifact(params: {
	message: string;
	contextMode: AssistantContextMode;
	mode: GenerationMode;
	artifacts: AssistantArtifactRecord[];
}): Promise<{ title: string; content: string }> {
	const result = await generateAssistantResponse({
		message: params.message,
		contextMode: params.contextMode,
		generationMode: params.mode,
	});
	const primaryArtifact = result.message.artifacts?.[0];

	if (!primaryArtifact) {
		return {
			title: 'Generated markdown overlay',
			content: ['# Assistant Summary', '', result.message.content].join('\n'),
		};
	}

	if (primaryArtifact.type === 'mermaid') {
		return {
			title: 'Generated markdown overlay',
			content: ['# Mermaid Draft', '', '```mermaid', primaryArtifact.content, '```'].join('\n'),
		};
	}

	if (primaryArtifact.type === 'd2') {
		return {
			title: 'Generated markdown overlay',
			content: ['# D2 Draft', '', '```d2', primaryArtifact.content, '```'].join('\n'),
		};
	}

	return {
		title: 'Generated markdown overlay',
		content: ['# Assistant Summary', '', primaryArtifact.content].join('\n'),
	};
}

export function buildPlacementPlanArtifact(params: {
	title: string;
	artifacts: AssistantArtifactRecord[];
}): { title: string; content: string } {
	const placements = params.artifacts.map((artifact, index) => ({
		artifactId: artifact.id,
		artifactType: artifact.type,
		x: index * 460,
		y: index === 0 ? 0 : 32,
		width: artifact.type === 'markdown' ? 420 : 380,
		height: artifact.type === 'layout-plan' ? 180 : artifact.type === 'markdown' ? 320 : 280,
		anchor: index === 0 ? 'scene-center' : 'right-of-previous',
	}));

	return {
		title: params.title,
		content: JSON.stringify(
			{
				strategy: 'avoid-overlap',
				placements,
			},
			null,
			2,
		),
	};
}

export function buildResponseArtifacts(
	storedArtifacts: AssistantArtifactRecord[],
	includeArtifactTypes: AssistantArtifact['type'][],
	serviceArtifacts: AssistantArtifact[] = [],
): AssistantArtifact[] {
	const persisted = storedArtifacts
		.filter((artifact) => includeArtifactTypes.includes(artifact.type))
		.map<AssistantArtifact>((artifact) => ({
			type: artifact.type,
			content: enrichStoredArtifactContent(artifact),
		}));

	return uniqueArtifacts([...serviceArtifacts, ...persisted]);
}

function summarizeRequest(message: string): string {
	return message.trim().replace(/\s+/g, ' ').slice(0, 120) || 'assistant request';
}

export function buildResponseSummary(params: {
	mode: GenerationMode;
	message: string;
	artifacts: AssistantArtifactRecord[];
	summary: string;
}): string {
	const baseSummary =
		params.mode === 'prototype' && params.artifacts.length === 0
			? 'Prototype generation did not produce a valid file bundle.'
			: params.summary;
	const lines = [baseSummary, '', `Request: ${summarizeRequest(params.message)}`];
	if (params.artifacts.length > 0) {
		lines.push('', 'Prepared artifacts:');
		for (const artifact of params.artifacts) {
			lines.push(`- ${artifact.title}`);
		}
	}

	if (params.mode === 'prototype') {
		lines.push(
			'',
			params.artifacts.length > 0
				? 'The run prepared a multi-file prototype payload for the custom runtime and canvas preview.'
				: 'No prototype artifact was stored for this run.',
		);
	}

	return lines.join('\n');
}
