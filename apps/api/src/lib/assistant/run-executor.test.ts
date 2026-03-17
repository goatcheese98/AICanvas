import type { AssistantTask } from '@ai-canvas/shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { appendAssistantRunEventRecord, publishAssistantRunEvent } = vi.hoisted(() => ({
	appendAssistantRunEventRecord: vi.fn(),
	publishAssistantRunEvent: vi.fn(),
}));

vi.mock('./store', () => ({
	appendAssistantRunEventRecord,
}));

vi.mock('./runtime-store', () => ({
	publishAssistantRunEvent,
}));

import { publishTaskEvent } from './run-executor';

function createTask(overrides?: Partial<AssistantTask>): AssistantTask {
	return {
		id: 'task-1',
		runId: 'run-1',
		title: 'Generate response',
		type: 'generate_response',
		status: 'running',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	} as unknown as AssistantTask;
}

describe('publishTaskEvent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		appendAssistantRunEventRecord.mockResolvedValue({ id: 'event-1' });
	});

	it('appends and publishes task lifecycle events', async () => {
		const task = createTask();

		await publishTaskEvent({} as never, 'user-1', task, 'task.completed', 'completed');

		expect(appendAssistantRunEventRecord).toHaveBeenCalledWith(
			{},
			'user-1',
			'run-1',
			'task.completed',
			{
				taskId: 'task-1',
				taskType: 'generate_response',
				taskTitle: 'Generate response',
				taskStatus: 'completed',
				error: undefined,
			},
		);
		expect(publishAssistantRunEvent).toHaveBeenCalledWith('user-1', 'run-1', { id: 'event-1' });
	});

	it('includes task errors for failed events', async () => {
		const task = createTask({ error: 'Generation failed' });

		await publishTaskEvent({} as never, 'user-1', task, 'task.failed', 'failed');

		expect(appendAssistantRunEventRecord).toHaveBeenCalledWith(
			{},
			'user-1',
			'run-1',
			'task.failed',
			{
				taskId: 'task-1',
				taskType: 'generate_response',
				taskTitle: 'Generate response',
				taskStatus: 'failed',
				error: 'Generation failed',
			},
		);
	});
});
