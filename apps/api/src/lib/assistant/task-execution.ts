import type {
	AssistantArtifact,
	AssistantArtifactRecord,
	AssistantContextMode,
	AssistantMessage,
	AssistantTask,
	AssistantTaskInput,
	GenerationMode,
} from '@ai-canvas/shared/types';
import { generateAssistantResponse } from './service';
import { buildCanvasSafeImagePrompt } from './visual-prompts';

interface StoredAssistantAssetContent {
	kind: 'stored_asset';
	r2Key: string;
	mimeType: string;
	provider: string;
	model?: string;
	prompt?: string;
	revisedPrompt?: string;
	tool?: string;
	byteSize?: number;
	sourceArtifactId?: string;
	artifactId?: string;
	runId?: string;
}

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

	try {
		const parsed = JSON.parse(artifact.content) as StoredAssistantAssetContent;
		if (parsed.kind !== 'stored_asset') {
			return artifact.content;
		}

		return JSON.stringify({
			...parsed,
			artifactId: artifact.id,
			runId: artifact.runId,
		});
	} catch {
		return artifact.content;
	}
}

function getTaskOutputArtifactIds(task: AssistantTask): string[] {
	if (!task.output) {
		return [];
	}

	switch (task.output.kind) {
		case 'artifact_created':
		case 'placement_ready':
			return task.output.artifactIds;
		default:
			return [];
	}
}

export function resolveSourceArtifactForTask(params: {
	artifacts: AssistantArtifactRecord[];
	tasks: AssistantTask[];
	currentTaskId: string;
	sourceArtifactType: Extract<AssistantTaskInput, { kind: 'vectorize_asset' }>['sourceArtifactType'];
	sourceArtifactId?: string;
	sourceTaskType?: Extract<AssistantTaskInput, { kind: 'vectorize_asset' }>['sourceTaskType'];
}): AssistantArtifactRecord | null {
	if (params.sourceArtifactId) {
		const sourceArtifact = params.artifacts.find(
			(artifact) =>
				artifact.id === params.sourceArtifactId
				&& artifact.type === params.sourceArtifactType,
		);
		if (sourceArtifact) {
			return sourceArtifact;
		}
	}

	const currentTaskIndex = params.tasks.findIndex((task) => task.id === params.currentTaskId);
	const priorTasks = currentTaskIndex >= 0 ? params.tasks.slice(0, currentTaskIndex) : params.tasks;

	if (params.sourceTaskType) {
		for (const task of [...priorTasks].reverse()) {
			if (task.type !== params.sourceTaskType || task.status !== 'completed') {
				continue;
			}

			for (const artifactId of [...getTaskOutputArtifactIds(task)].reverse()) {
				const sourceArtifact = params.artifacts.find(
					(artifact) => artifact.id === artifactId && artifact.type === params.sourceArtifactType,
				);
				if (sourceArtifact) {
					return sourceArtifact;
				}
			}
		}
	}

	return (
		[...params.artifacts].reverse().find((artifact) => artifact.type === params.sourceArtifactType)
		?? null
	);
}

function summarizeRequest(message: string): string {
	return message.trim().replace(/\s+/g, ' ').slice(0, 120) || 'assistant request';
}

function stripImagePromptPrefix(prompt: string): string {
	return prompt
		.replace(/^create a polished image for:\s*/i, '')
		.replace(/^create a loose whiteboard sketch for:\s*/i, '')
		.trim();
}

function getLastImagePrompt(
	history: AssistantMessage[] | undefined,
): string | null {
	if (!Array.isArray(history)) {
		return null;
	}

	for (const message of [...history].reverse()) {
		for (const artifact of [...(message.artifacts ?? [])].reverse()) {
			if (artifact.type !== 'image' && artifact.type !== 'image-vector') {
				continue;
			}

			try {
				const parsed = JSON.parse(artifact.content) as StoredAssistantAssetContent;
				const prompt = parsed.revisedPrompt ?? parsed.prompt;
				if (parsed.kind === 'stored_asset' && typeof prompt === 'string' && prompt.trim().length > 0) {
					return stripImagePromptPrefix(prompt);
				}
			} catch {
				continue;
			}
		}
	}

	return null;
}

function isPureConfirmationMessage(message: string): boolean {
	return /^(proceed|go ahead|do it|yes|yep|sure|okay|ok)$/i.test(message.trim());
}

export function createImageGenerationInput(
	message: string,
	mode: Extract<GenerationMode, 'image' | 'sketch'>,
	history?: AssistantMessage[],
): Extract<AssistantTaskInput, { kind: 'generate_image' }> {
	const summarizedMessage = summarizeRequest(message);
	const previousPrompt = getLastImagePrompt(history);
	const promptBody =
		previousPrompt && !/^(create|generate|make|render|design)\b/i.test(summarizedMessage)
			? isPureConfirmationMessage(summarizedMessage)
				? previousPrompt
				: `${previousPrompt}. Update it with this change: ${summarizedMessage}`
			: summarizedMessage;

	return {
		kind: 'generate_image',
		prompt: buildCanvasSafeImagePrompt({
			request: promptBody,
			mode,
		}),
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

	if (params.mode === 'prototype') {
		lines.push('', 'The run prepared a multi-file prototype payload for the custom runtime and canvas preview.');
	}

	return lines.join('\n');
}
