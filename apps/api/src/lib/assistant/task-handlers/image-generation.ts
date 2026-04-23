import { serializeStoredAssistantAssetContent } from '@ai-canvas/shared/schemas';
import type { AssistantTask } from '@ai-canvas/shared/types';
import { saveAssistantAssetToR2 } from '../../storage/assistant-asset-storage';
import { generateImageAsset } from '../media-adapters';
import { createAssistantArtifactRecord } from '../store';
import type { TaskHandlerContext, TaskHandlerResult } from './task-handler-types';

export async function executeImageGenerationTask(
	task: AssistantTask,
	ctx: TaskHandlerContext,
): Promise<TaskHandlerResult> {
	if (task.input?.kind !== 'generate_image') {
		throw new Error('Image generation task is missing payload');
	}

	const generated = await generateImageAsset(ctx.bindings, {
		prompt: task.input.prompt,
		style: task.input.style,
	});

	const storageKey = await saveAssistantAssetToR2(
		ctx.bindings.R2,
		ctx.runId,
		`${task.id}-${crypto.randomUUID()}`,
		{
			body: generated.bytes,
			mimeType: generated.mimeType,
		},
	);

	const createdArtifact = await createAssistantArtifactRecord(ctx.db, ctx.ownerId, {
		runId: ctx.runId,
		taskId: task.id,
		type: 'image',
		title: task.input.outputTitle,
		content: serializeStoredAssistantAssetContent({
			kind: 'stored_asset',
			r2Key: storageKey,
			mimeType: generated.mimeType,
			provider: generated.provider,
			model: generated.model,
			prompt: generated.prompt,
			revisedPrompt: generated.revisedPrompt,
			byteSize: generated.bytes.byteLength,
		}),
	});

	return {
		output: {
			kind: 'artifact_created',
			artifactIds: [createdArtifact.id],
		},
	};
}
