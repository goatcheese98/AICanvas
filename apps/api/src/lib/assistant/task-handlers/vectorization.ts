import {
	parseStoredAssistantAssetContent,
	serializeStoredAssistantAssetContent,
} from '@ai-canvas/shared/schemas';
import type { AssistantTask } from '@ai-canvas/shared/types';
import {
	loadAssistantAssetFromR2,
	saveAssistantAssetToR2,
} from '../../storage/assistant-asset-storage';
import { vectorizeImageAsset } from '../media-adapters';
import {
	createAssistantArtifactRecord,
	listAssistantArtifactsRecord,
	listAssistantTasksRecord,
} from '../store';
import { resolveSourceArtifactForTask } from '../task-execution';
import type { TaskHandlerContext, TaskHandlerResult } from './index';

export async function executeVectorizationTask(
	task: AssistantTask,
	ctx: TaskHandlerContext,
): Promise<TaskHandlerResult> {
	if (task.input?.kind !== 'vectorize_asset') {
		throw new Error('Vectorization task is missing payload');
	}

	const taskInput = task.input;
	const [tasks, artifacts] = await Promise.all([
		listAssistantTasksRecord(ctx.db, ctx.ownerId, ctx.runId),
		listAssistantArtifactsRecord(ctx.db, ctx.ownerId, ctx.runId),
	]);

	const sourceImageArtifact = resolveSourceArtifactForTask({
		tasks,
		artifacts,
		currentTaskId: task.id,
		sourceArtifactType: taskInput.sourceArtifactType,
		sourceArtifactId: taskInput.sourceArtifactId,
		sourceTaskType: taskInput.sourceTaskType,
	});

	if (!sourceImageArtifact) {
		throw new Error('Vectorization failed: missing image artifact');
	}

	const sourceImage = parseStoredAssistantAssetContent(sourceImageArtifact.content);
	if (!sourceImage) {
		throw new Error('Vectorization failed: image artifact content is not a stored asset');
	}

	const sourceObject = await loadAssistantAssetFromR2(ctx.bindings.R2, sourceImage.r2Key);
	if (!sourceObject) {
		throw new Error('Vectorization failed: source image asset is missing from storage');
	}

	const vectorized = await vectorizeImageAsset(ctx.bindings, {
		bytes: await sourceObject.arrayBuffer(),
		mimeType: sourceImage.mimeType,
		prompt: sourceImage.prompt,
	});

	const storageKey = await saveAssistantAssetToR2(
		ctx.bindings.R2,
		ctx.runId,
		`${task.id}-${crypto.randomUUID()}`,
		{
			body: vectorized.content,
			mimeType: vectorized.mimeType,
		},
	);

	const createdArtifact = await createAssistantArtifactRecord(ctx.db, ctx.ownerId, {
		runId: ctx.runId,
		taskId: task.id,
		type: 'image-vector',
		title: taskInput.outputTitle,
		content: serializeStoredAssistantAssetContent({
			kind: 'stored_asset',
			r2Key: storageKey,
			mimeType: vectorized.mimeType,
			provider: vectorized.provider,
			model: vectorized.model,
			tool: vectorized.tool,
			sourceArtifactId: sourceImageArtifact.id,
		}),
	});

	return {
		output: {
			kind: 'artifact_created',
			artifactIds: [createdArtifact.id],
		},
	};
}
