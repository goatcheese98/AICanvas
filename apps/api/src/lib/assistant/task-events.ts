import type { AssistantTask } from '@ai-canvas/shared/types';
import type { createDb } from '../db/client';
import { publishAssistantRunEvent } from './runtime-store';
import { appendAssistantRunEventRecord } from './store';

type AssistantDb = ReturnType<typeof createDb>;

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
