import type { AssistantRunEvent } from '@ai-canvas/shared/types';
import { describe, expect, it } from 'vitest';
import {
	applyAssistantRunEvent,
	createAssistantRunProgress,
	getAssistantRunProgressLabel,
	reconcileAssistantRunProgress,
} from './run-progress';

describe('run-progress', () => {
	it('tracks task lifecycle events into ordered progress state', () => {
		const initial = createAssistantRunProgress({
			runId: 'run-1',
			status: 'queued',
		});

		const createdEvent: AssistantRunEvent = {
			id: 'event-1',
			runId: 'run-1',
			sequence: 1,
			type: 'task.created',
			data: {
				taskId: 'task-1',
				taskType: 'plan_run',
				taskTitle: 'Plan assistant run',
				taskStatus: 'queued',
			},
			createdAt: '2026-03-07T10:00:00.000Z',
		};

		const startedEvent: AssistantRunEvent = {
			...createdEvent,
			id: 'event-2',
			sequence: 2,
			type: 'task.started',
			data: {
				...createdEvent.data,
				taskStatus: 'running',
			},
			createdAt: '2026-03-07T10:00:05.000Z',
		};

		const completedEvent: AssistantRunEvent = {
			...createdEvent,
			id: 'event-3',
			sequence: 3,
			type: 'task.completed',
			data: {
				...createdEvent.data,
				taskStatus: 'completed',
			},
			createdAt: '2026-03-07T10:00:10.000Z',
		};

		const afterCreate = applyAssistantRunEvent(initial, createdEvent);
		const afterStart = applyAssistantRunEvent(afterCreate, startedEvent);
		const afterComplete = applyAssistantRunEvent(afterStart, completedEvent);

		expect(afterComplete.tasks).toHaveLength(1);
		expect(afterComplete.tasks[0]).toMatchObject({
			id: 'task-1',
			type: 'plan_run',
			status: 'completed',
			title: 'Plan assistant run',
		});
	});

	it('reconciles persisted tasks and artifacts after streaming', () => {
		const progress = createAssistantRunProgress({
			runId: 'run-2',
			status: 'running',
		});

		const reconciled = reconcileAssistantRunProgress(progress, {
			status: 'completed',
			tasks: [
				{
					id: 'task-1',
					runId: 'run-2',
					type: 'generate_image',
					title: 'Generate source image',
					status: 'completed',
					createdAt: '2026-03-07T10:01:00.000Z',
					updatedAt: '2026-03-07T10:01:05.000Z',
				},
			],
			artifacts: [
				{
					id: 'artifact-1',
					runId: 'run-2',
					taskId: 'task-1',
					type: 'image',
					title: 'Generated source image',
					content: 'Generated image concept for: poster',
					createdAt: '2026-03-07T10:01:04.000Z',
				},
			],
		});

		expect(reconciled.status).toBe('completed');
		expect(reconciled.tasks[0]?.type).toBe('generate_image');
		expect(reconciled.artifacts[0]?.title).toBe('Generated source image');
		expect(getAssistantRunProgressLabel(reconciled)).toBe('Run completed');
	});
});
