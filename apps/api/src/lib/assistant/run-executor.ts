import type {
	AssistantContextMode,
	AssistantContextSnapshot,
	AssistantMessage,
	AssistantTask,
	GenerationMode,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import * as Sentry from '@sentry/cloudflare';
import type { AppEnv } from '../../types';
import type { createDb } from '../db/client';
import { logApiEvent } from '../observability';
import { publishAssistantRunEvent } from './runtime-store';
import {
	appendAssistantRunEventRecord,
	getNextQueuedAssistantTaskRecord,
	listAssistantTasksRecord,
	updateAssistantRunRecord,
	updateAssistantTaskRecord,
} from './store';
import { executeTask } from './task-handlers';

type AssistantDb = ReturnType<typeof createDb>;

interface ExecuteAssistantRunInput {
	canvasId: string;
	message: string;
	contextMode: AssistantContextMode;
	modeHint?: GenerationMode;
	history?: AssistantMessage[];
	selectedElementIds?: string[];
	contextSnapshot?: AssistantContextSnapshot;
	prototypeContext?: PrototypeOverlayCustomData;
}

async function findRunningTaskOrQueuedTask(
	db: AssistantDb,
	ownerId: string,
	runId: string,
): Promise<AssistantTask | null> {
	const tasks = await listAssistantTasksRecord(db, ownerId, runId);
	return (
		tasks.find((task) => task.status === 'running') ??
		tasks.find((task) => task.status === 'queued') ??
		null
	);
}

export async function publishTaskEvent(
	db: AssistantDb,
	ownerId: string,
	task: AssistantTask,
	type: 'task.created' | 'task.started' | 'task.completed' | 'task.failed',
	taskStatus: AssistantTask['status'],
) {
	const event = await appendAssistantRunEventRecord(db, ownerId, task.runId, type, {
		taskId: task.id,
		taskType: task.type,
		taskTitle: task.title,
		taskStatus,
		error: type === 'task.failed' ? task.error : undefined,
	});
	publishAssistantRunEvent(ownerId, task.runId, event);
}

export async function executeAssistantRun(
	db: AssistantDb,
	bindings: AppEnv['Bindings'],
	ownerId: string,
	runId: string,
	input: ExecuteAssistantRunInput,
) {
	return Sentry.startSpan(
		{
			name: 'assistant.execute_run',
			op: 'ai.run',
			attributes: {
				'assistant.run.id': runId,
				'assistant.canvas.id': input.canvasId,
				'assistant.context_mode': input.contextMode,
			},
		},
		async () => {
			Sentry.setTag('assistant.run_id', runId);
			Sentry.setTag('assistant.canvas_id', input.canvasId);
			Sentry.setTag('assistant.context_mode', input.contextMode);

			await updateAssistantRunRecord(db, ownerId, runId, { status: 'running' });
			logApiEvent('info', 'assistant.run.started', {
				runId,
				canvasId: input.canvasId,
				userId: ownerId,
				contextMode: input.contextMode,
			});

			const startedEvent = await appendAssistantRunEventRecord(db, ownerId, runId, 'run.started', {
				status: 'running',
			});
			publishAssistantRunEvent(ownerId, runId, startedEvent);

			try {
				let nextTask = await getNextQueuedAssistantTaskRecord(db, ownerId, runId);

				while (nextTask) {
					const runningTask = await updateAssistantTaskRecord(db, ownerId, nextTask.id, {
						status: 'running',
						error: null,
					});

					if (!runningTask) {
						throw new Error('Assistant task disappeared during execution');
					}

					await publishTaskEvent(db, ownerId, runningTask, 'task.started', 'running');

					// Execute task via handler
					const result = await executeTask(runningTask, {
						db,
						bindings,
						ownerId,
						runId,
						message: input.message,
						contextMode: input.contextMode,
						history: input.history,
						contextSnapshot: input.contextSnapshot,
						prototypeContext: input.prototypeContext,
					});

					// Mark task as completed
					const completedTask = await updateAssistantTaskRecord(db, ownerId, runningTask.id, {
						status: 'completed',
						output: result.output,
						error: null,
					});

					if (!completedTask) {
						throw new Error(`Failed to complete ${runningTask.type} task`);
					}

					await publishTaskEvent(db, ownerId, completedTask, 'task.completed', 'completed');

					nextTask = await getNextQueuedAssistantTaskRecord(db, ownerId, runId);
				}

				logApiEvent('info', 'assistant.run.completed', {
					runId,
					canvasId: input.canvasId,
					userId: ownerId,
				});

				await updateAssistantRunRecord(db, ownerId, runId, {
					status: 'completed',
					error: null,
				});

				const completedEvent = await appendAssistantRunEventRecord(
					db,
					ownerId,
					runId,
					'run.completed',
					{
						status: 'completed',
					},
				);
				publishAssistantRunEvent(ownerId, runId, completedEvent);
			} catch (error) {
				await handleRunError(error, db, bindings, ownerId, runId, input);
			}
		},
	);
}

async function handleRunError(
	error: unknown,
	db: AssistantDb,
	_bindings: AppEnv['Bindings'],
	ownerId: string,
	runId: string,
	input: ExecuteAssistantRunInput,
) {
	const message = error instanceof Error ? error.message : 'Assistant run failed';
	const failingTask = await findRunningTaskOrQueuedTask(db, ownerId, runId);

	logApiEvent('error', 'assistant.run.failed', {
		runId,
		canvasId: input.canvasId,
		userId: ownerId,
		taskId: failingTask?.id,
		taskType: failingTask?.type,
		message,
	});

	Sentry.captureException(error, {
		tags: {
			assistant_run_id: runId,
			assistant_canvas_id: input.canvasId,
			assistant_task_id: failingTask?.id ?? 'unknown',
		},
		extra: {
			contextMode: input.contextMode,
			messageLength: input.message.length,
			failingTaskType: failingTask?.type,
		},
	});

	if (failingTask) {
		const failedTask = await updateAssistantTaskRecord(db, ownerId, failingTask.id, {
			status: 'failed',
			error: message,
		});
		if (failedTask) {
			await publishTaskEvent(db, ownerId, failedTask, 'task.failed', 'failed');
		}
	}

	await updateAssistantRunRecord(db, ownerId, runId, {
		status: 'failed',
		error: message,
	});

	const failedEvent = await appendAssistantRunEventRecord(db, ownerId, runId, 'run.failed', {
		error: message,
		status: 'failed',
	});
	publishAssistantRunEvent(ownerId, runId, failedEvent);
}
