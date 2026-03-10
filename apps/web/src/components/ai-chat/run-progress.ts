import type {
	AssistantArtifactRecord,
	AssistantRunCreated,
	AssistantRunEvent,
	AssistantRunStatus,
	AssistantTask,
} from '@ai-canvas/shared/types';

export interface AssistantRunProgress {
	runId: string;
	status: AssistantRunStatus;
	error?: string;
	tasks: AssistantTask[];
	artifacts: AssistantArtifactRecord[];
}

function sortTasks(tasks: AssistantTask[]): AssistantTask[] {
	return [...tasks].sort((left, right) => {
		if (left.createdAt === right.createdAt) {
			return left.id.localeCompare(right.id);
		}

		return left.createdAt.localeCompare(right.createdAt);
	});
}

function upsertTask(tasks: AssistantTask[], nextTask: AssistantTask): AssistantTask[] {
	const existingIndex = tasks.findIndex((task) => task.id === nextTask.id);
	if (existingIndex === -1) {
		return sortTasks([...tasks, nextTask]);
	}

	const merged = [...tasks];
	merged[existingIndex] = {
		...merged[existingIndex],
		...nextTask,
	};
	return sortTasks(merged);
}

export function createAssistantRunProgress(run: AssistantRunCreated): AssistantRunProgress {
	return {
		runId: run.runId,
		status: run.status,
		tasks: [],
		artifacts: [],
	};
}

export function applyAssistantRunEvent(
	progress: AssistantRunProgress,
	event: AssistantRunEvent,
): AssistantRunProgress {
	switch (event.type) {
		case 'run.created':
		case 'run.started':
		case 'run.completed':
			return {
				...progress,
				status: event.data?.status ?? progress.status,
				error: undefined,
			};
		case 'run.failed':
			return {
				...progress,
				status: event.data?.status ?? 'failed',
				error: event.data?.error ?? progress.error,
			};
		case 'task.created':
		case 'task.started':
		case 'task.completed':
		case 'task.failed': {
			const taskId = event.data?.taskId;
			const taskType = event.data?.taskType;
			const taskTitle = event.data?.taskTitle;
			const taskStatus = event.data?.taskStatus;

			if (!taskId || !taskType || !taskTitle || !taskStatus) {
				return progress;
			}

			return {
				...progress,
				tasks: upsertTask(progress.tasks, {
					id: taskId,
					runId: progress.runId,
					type: taskType,
					title: taskTitle,
					status: taskStatus,
					error: event.type === 'task.failed' ? event.data?.error ?? progress.error : undefined,
					createdAt: event.createdAt,
					updatedAt: event.createdAt,
				}),
			};
		}
		case 'message.created':
			return progress;
	}
}

export function reconcileAssistantRunProgress(
	progress: AssistantRunProgress,
	input: {
		status: AssistantRunStatus;
		error?: string;
		tasks: AssistantTask[];
		artifacts: AssistantArtifactRecord[];
	},
): AssistantRunProgress {
	return {
		...progress,
		status: input.status,
		error: input.error,
		tasks: sortTasks(input.tasks),
		artifacts: [...input.artifacts].sort((left, right) => {
			if (left.createdAt === right.createdAt) {
				return left.id.localeCompare(right.id);
			}

			return left.createdAt.localeCompare(right.createdAt);
		}),
	};
}

export function getAssistantRunProgressLabel(progress: AssistantRunProgress): string {
	if (progress.status === 'failed') {
		return progress.error ?? 'Run failed';
	}

	const runningTask = progress.tasks.find((task) => task.status === 'running');
	if (runningTask) {
		return runningTask.title;
	}

	const queuedTask = progress.tasks.find((task) => task.status === 'queued');
	if (queuedTask) {
		return `Queued: ${queuedTask.title}`;
	}

	if (progress.status === 'completed') {
		return 'Run completed';
	}

	return 'Planning and running...';
}
