import type {
	AssistantArtifact,
	AssistantArtifactRecord,
	AssistantContextMode,
	AssistantTaskInput,
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

function summarizeRequest(message: string): string {
	return message.trim().replace(/\s+/g, ' ').slice(0, 120) || 'assistant request';
}

export function createImageGenerationInput(
	message: string,
	mode: Extract<GenerationMode, 'image' | 'sketch'>,
): Extract<AssistantTaskInput, { kind: 'generate_image' }> {
	return {
		kind: 'generate_image',
		prompt:
			mode === 'sketch'
				? `Create a loose whiteboard sketch for: ${summarizeRequest(message)}`
				: `Create a polished image for: ${summarizeRequest(message)}`,
		style: mode,
		outputTitle: mode === 'sketch' ? 'Generated sketch source image' : 'Generated source image',
	};
}

export async function buildMarkdownOverlayArtifact(params: {
	message: string;
	contextMode: AssistantContextMode;
	mode: GenerationMode;
	artifacts: AssistantArtifactRecord[];
}): Promise<{ title: string; content: string }> {
	if (params.mode === 'image' || params.mode === 'sketch') {
		const imageArtifact = params.artifacts.find((artifact) => artifact.type === 'image');
		const vectorArtifact = params.artifacts.find((artifact) => artifact.type === 'image-vector');
		const lines = [
			'# Generated Asset Brief',
			'',
			`Request: ${summarizeRequest(params.message)}`,
			...(params.contextMode !== 'none'
			? [`Context: ${params.contextMode === 'selected' ? 'Selected elements' : 'Whole canvas'}`]
			: []),
		];

		if (imageArtifact) {
			lines.push('', `Source image: ${imageArtifact.title}`);
		}

		if (vectorArtifact) {
			lines.push(`Vectorized asset: ${vectorArtifact.title}`);
		}

		lines.push('', 'Placement intent: keep the markdown brief adjacent to the generated asset.');

		return {
			title: 'Generated asset markdown brief',
			content: lines.join('\n'),
		};
	}

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
			content: artifact.content,
		}));

	return uniqueArtifacts([...serviceArtifacts, ...persisted]);
}

export function buildResponseSummary(params: {
	mode: GenerationMode;
	message: string;
	artifacts: AssistantArtifactRecord[];
	summary: string;
}): string {
	const lines = [params.summary, '', `Request: ${summarizeRequest(params.message)}`];
	if (params.artifacts.length > 0) {
		lines.push('', 'Prepared artifacts:');
		for (const artifact of params.artifacts) {
			lines.push(`- ${artifact.title}`);
		}
	}

	if (params.mode === 'image' || params.mode === 'sketch') {
		lines.push('', 'The run prepared an asset brief and placement plan alongside the generated media.');
	}

	if (params.mode === 'prototype') {
		lines.push('', 'The run prepared a multi-file prototype payload for the custom runtime and canvas preview.');
	}

	return lines.join('\n');
}
