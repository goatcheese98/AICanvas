import type { AssistantContextMode, AssistantTask } from '@ai-canvas/shared/types';
import type { AppEnv } from '../../../types';
import type { createDb } from '../../db/client';
import { executeAssistantResponseTask } from './assistant-response';
import { executeImageGenerationTask } from './image-generation';
import { executeVectorizationTask } from './vectorization';

export type AssistantDb = ReturnType<typeof createDb>;

export interface TaskHandlerContext {
	db: AssistantDb;
	bindings: AppEnv['Bindings'];
	ownerId: string;
	runId: string;
	message: string;
	contextMode: AssistantContextMode;
	history: import('@ai-canvas/shared/types').AssistantMessage[] | undefined;
	contextSnapshot: import('@ai-canvas/shared/types').AssistantContextSnapshot | undefined;
	prototypeContext: import('@ai-canvas/shared/types').PrototypeOverlayCustomData | undefined;
}

export interface TaskHandlerResult {
	output: AssistantTask['output'];
}

export async function executeTask(
	task: AssistantTask,
	ctx: TaskHandlerContext,
): Promise<TaskHandlerResult> {
	switch (task.type) {
		case 'plan_run':
			return executePlanRunTask(task, ctx);
		case 'generate_image':
			return executeImageGenerationTask(task, ctx);
		case 'vectorize_asset':
			return executeVectorizationTask(task, ctx);
		case 'create_markdown_overlay':
			return executeMarkdownOverlayTask(task, ctx);
		case 'place_canvas_artifact':
			return executePlacementTask(task, ctx);
		case 'generate_response':
			return executeAssistantResponseTask(task, ctx);
		case 'verify_layout':
			return executeLayoutVerificationTask(task, ctx);
		case 'verify_run':
			return executeRunVerificationTask(task, ctx);
		default:
			throw new Error(`Unknown task type: ${(task as AssistantTask).type}`);
	}
}

import { buildMarkdownOverlayArtifact, buildPlacementPlanArtifact } from '../artifact-builders';
import { planAssistantRun } from '../planner';
import {
	createAssistantTaskRecord,
	listAssistantArtifactsRecord,
	listAssistantTasksRecord,
} from '../store';

async function executePlanRunTask(
	task: AssistantTask,
	ctx: TaskHandlerContext,
): Promise<TaskHandlerResult> {
	if (task.input?.kind !== 'plan_run') {
		throw new Error('Plan run task is missing payload');
	}

	const plan = planAssistantRun({
		message: ctx.message,
		contextMode: ctx.contextMode,
		modeHint: task.input.request.modeHint,
		history: ctx.history,
		contextSnapshot: ctx.contextSnapshot,
		prototypeContext: ctx.prototypeContext,
		vectorizationEnabled: Boolean(ctx.bindings.VECTORIZE_ASSET_URL),
	});

	for (const t of plan.tasks) {
		const queuedTask = await createAssistantTaskRecord(ctx.db, ctx.ownerId, {
			runId: ctx.runId,
			type: t.type,
			title: t.title,
			input: t.input,
		});
		const { publishTaskEvent } = await import('../run-executor');
		await publishTaskEvent(ctx.db, ctx.ownerId, queuedTask, 'task.created', 'queued');
	}

	return {
		output: {
			kind: 'plan_run',
			resolvedMode: plan.resolvedMode,
			enqueuedTaskTypes: plan.tasks.map((t) => t.type),
		},
	};
}

async function executeMarkdownOverlayTask(
	task: AssistantTask,
	ctx: TaskHandlerContext,
): Promise<TaskHandlerResult> {
	if (task.input?.kind !== 'create_markdown_overlay') {
		throw new Error('Markdown overlay task is missing payload');
	}

	const taskInput = task.input;
	const availableArtifacts = await listAssistantArtifactsRecord(ctx.db, ctx.ownerId, ctx.runId);
	const artifact = await buildMarkdownOverlayArtifact({
		message: ctx.message,
		contextMode: ctx.contextMode,
		mode: taskInput.resolvedMode,
		artifacts: availableArtifacts.filter((candidate) =>
			taskInput.sourceArtifactTypes.includes(candidate.type),
		),
	});

	const { createAssistantArtifactRecord } = await import('../store');
	const createdArtifact = await createAssistantArtifactRecord(ctx.db, ctx.ownerId, {
		runId: ctx.runId,
		taskId: task.id,
		type: 'markdown',
		title: artifact.title,
		content: artifact.content,
	});

	return {
		output: {
			kind: 'artifact_created',
			artifactIds: [createdArtifact.id],
		},
	};
}

async function executePlacementTask(
	task: AssistantTask,
	ctx: TaskHandlerContext,
): Promise<TaskHandlerResult> {
	if (task.input?.kind !== 'place_canvas_artifact') {
		throw new Error('Placement task is missing payload');
	}

	const taskInput = task.input;
	const targetArtifacts = await listAssistantArtifactsRecord(ctx.db, ctx.ownerId, ctx.runId);
	const filteredArtifacts = targetArtifacts.filter((artifact) =>
		taskInput.targetArtifactTypes.includes(artifact.type),
	);

	if (filteredArtifacts.length === 0) {
		throw new Error('Placement planning failed: missing target artifacts');
	}

	const placementPlan = buildPlacementPlanArtifact({
		title: task.input.title,
		artifacts: filteredArtifacts,
	});

	const { createAssistantArtifactRecord } = await import('../store');
	const createdArtifact = await createAssistantArtifactRecord(ctx.db, ctx.ownerId, {
		runId: ctx.runId,
		taskId: task.id,
		type: 'layout-plan',
		title: placementPlan.title,
		content: placementPlan.content,
	});

	return {
		output: {
			kind: 'placement_ready',
			artifactIds: [createdArtifact.id],
			strategy: task.input.strategy,
		},
	};
}

async function executeLayoutVerificationTask(
	task: AssistantTask,
	ctx: TaskHandlerContext,
): Promise<TaskHandlerResult> {
	if (task.input?.kind !== 'verify_layout') {
		throw new Error('Layout verification task is missing payload');
	}

	const artifacts = await listAssistantArtifactsRecord(ctx.db, ctx.ownerId, ctx.runId);
	const missingTypes = task.input.requiredArtifactTypes.filter(
		(type) => !artifacts.some((artifact) => artifact.type === type),
	);

	if (missingTypes.length > 0) {
		throw new Error(`Layout verification failed: missing ${missingTypes.join(', ')}`);
	}

	return {
		output: {
			kind: 'verification',
			verified: true,
			details: 'Required artifacts are available for canvas placement.',
		},
	};
}

async function executeRunVerificationTask(
	task: AssistantTask,
	ctx: TaskHandlerContext,
): Promise<TaskHandlerResult> {
	if (task.input?.kind !== 'verify_run') {
		throw new Error('Run verification task is missing payload');
	}

	const { getAssistantRunRecord } = await import('../store');
	const currentRun = await getAssistantRunRecord(ctx.db, ctx.ownerId, ctx.runId);

	if (task.input.requireResultMessage && !currentRun?.resultMessage) {
		throw new Error('Run verification failed: missing result message');
	}

	const artifacts = await listAssistantArtifactsRecord(ctx.db, ctx.ownerId, ctx.runId);
	const missingArtifacts = task.input.requiredArtifactTypes.filter(
		(type) => !artifacts.some((artifact) => artifact.type === type),
	);
	if (missingArtifacts.length > 0) {
		throw new Error(`Run verification failed: missing ${missingArtifacts.join(', ')}`);
	}

	const tasks = await listAssistantTasksRecord(ctx.db, ctx.ownerId, ctx.runId);
	const missingTaskTypes = task.input.requiredTaskTypes.filter(
		(type) => !tasks.some((t) => t.type === type && t.status === 'completed'),
	);
	if (missingTaskTypes.length > 0) {
		throw new Error(`Run verification failed: missing ${missingTaskTypes.join(', ')}`);
	}

	return {
		output: {
			kind: 'verification',
			verified: true,
			details: 'Run contains the required result message, tasks, and artifacts.',
		},
	};
}

export { executeImageGenerationTask } from './image-generation';
export { executeVectorizationTask } from './vectorization';
export { executeAssistantResponseTask } from './assistant-response';
