import { parseStoredAssistantAssetContent } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifactRecord,
	AssistantMessage,
	AssistantTask,
	AssistantTaskInput,
	GenerationMode,
} from '@ai-canvas/shared/types';
export {
	buildMarkdownOverlayArtifact,
	buildPlacementPlanArtifact,
	buildResponseArtifacts,
	buildResponseSummary,
} from './artifact-builders';
import { buildCanvasSafeImagePrompt } from './visual-prompts';

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
	sourceArtifactType: Extract<
		AssistantTaskInput,
		{ kind: 'vectorize_asset' }
	>['sourceArtifactType'];
	sourceArtifactId?: string;
	sourceTaskType?: Extract<AssistantTaskInput, { kind: 'vectorize_asset' }>['sourceTaskType'];
}): AssistantArtifactRecord | null {
	if (params.sourceArtifactId) {
		const sourceArtifact = params.artifacts.find(
			(artifact) =>
				artifact.id === params.sourceArtifactId && artifact.type === params.sourceArtifactType,
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
		[...params.artifacts]
			.reverse()
			.find((artifact) => artifact.type === params.sourceArtifactType) ?? null
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

function getLastImagePrompt(history: AssistantMessage[] | undefined): string | null {
	if (!Array.isArray(history)) {
		return null;
	}

	for (const message of [...history].reverse()) {
		for (const artifact of [...(message.artifacts ?? [])].reverse()) {
			if (artifact.type !== 'image' && artifact.type !== 'image-vector') {
				continue;
			}

			const parsed = parseStoredAssistantAssetContent(artifact.content);
			const prompt = parsed?.revisedPrompt ?? parsed?.prompt;
			if (typeof prompt === 'string' && prompt.trim().length > 0) {
				return stripImagePromptPrefix(prompt);
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
