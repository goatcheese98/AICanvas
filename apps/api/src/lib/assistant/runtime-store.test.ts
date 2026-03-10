import { describe, expect, it, vi } from 'vitest';
import { publishAssistantRunEvent, subscribeToAssistantRun } from './runtime-store';

describe('assistant runtime store', () => {
	it('notifies only subscribers for the matching user and run', () => {
		const listener = vi.fn();
		const unsubscribe = subscribeToAssistantRun('user-runtime-3', 'run-1', listener);

		publishAssistantRunEvent('user-runtime-3', 'run-1', {
			id: 'event-1',
			runId: 'run-1',
			sequence: 1,
			type: 'run.started',
			data: { status: 'running' },
			createdAt: new Date().toISOString(),
		});
		publishAssistantRunEvent('user-runtime-3', 'run-2', {
			id: 'event-2',
			runId: 'run-2',
			sequence: 1,
			type: 'run.started',
			data: { status: 'running' },
			createdAt: new Date().toISOString(),
		});
		publishAssistantRunEvent('user-runtime-4', 'run-1', {
			id: 'event-3',
			runId: 'run-1',
			sequence: 1,
			type: 'run.started',
			data: { status: 'running' },
			createdAt: new Date().toISOString(),
		});
		unsubscribe();

		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({
				runId: 'run-1',
				type: 'run.started',
			}),
		);
	});
});
