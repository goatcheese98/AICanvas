import type { AssistantMessage, AssistantRun } from '@ai-canvas/shared/types';
import { describe, expect, it } from 'vitest';
import {
	buildThreadMessages,
	normalizeThreadTitle,
	summarizeAssistantThreadTitle,
	toAssistantArtifactRecord,
	toAssistantRun,
	toAssistantRunEvent,
	toAssistantTask,
	toAssistantThread,
	toUserMessage,
} from './transforms';

describe('store/transforms', () => {
	describe('summarizeAssistantThreadTitle', () => {
		it('returns trimmed content up to 40 chars', () => {
			expect(summarizeAssistantThreadTitle('Hello world')).toBe('Hello world');
			expect(summarizeAssistantThreadTitle('  Hello   world  ')).toBe('Hello world');
		});

		it('returns "New chat" for empty content', () => {
			expect(summarizeAssistantThreadTitle('')).toBe('New chat');
			expect(summarizeAssistantThreadTitle('   ')).toBe('New chat');
		});

		it('truncates content to 40 chars', () => {
			const longContent = 'a'.repeat(50);
			expect(summarizeAssistantThreadTitle(longContent)).toBe('a'.repeat(40));
		});
	});

	describe('normalizeThreadTitle', () => {
		it('normalizes whitespace in title', () => {
			expect(normalizeThreadTitle('  Hello   world  ')).toBe('Hello world');
		});

		it('returns "New chat" for undefined title', () => {
			expect(normalizeThreadTitle(undefined)).toBe('New chat');
		});

		it('returns "New chat" for empty title', () => {
			expect(normalizeThreadTitle('')).toBe('New chat');
			expect(normalizeThreadTitle('   ')).toBe('New chat');
		});

		it('returns valid title as-is', () => {
			expect(normalizeThreadTitle('My Thread')).toBe('My Thread');
		});
	});

	describe('toAssistantThread', () => {
		it('converts database row to AssistantThread', () => {
			const now = new Date();
			const row = {
				id: 'thread-1',
				canvasId: 'canvas-1',
				title: 'Test Thread',
				userId: 'user-1',
				createdAt: now,
				updatedAt: now,
			} as const;
			const messages: AssistantMessage[] = [{ id: 'msg-1', role: 'user', content: 'hello', createdAt: now.toISOString() }];

			const result = toAssistantThread(row, messages);

			expect(result).toEqual({
				id: 'thread-1',
				canvasId: 'canvas-1',
				title: 'Test Thread',
				messages,
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
			});
		});
	});

	describe('toUserMessage', () => {
		it('converts AssistantRun to user message', () => {
			const run = {
				id: 'run-1',
				status: 'completed',
				request: {
					threadId: 'thread-1',
					canvasId: 'canvas-1',
					message: 'Hello assistant',
					contextMode: 'full',
				},
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
			} as unknown as AssistantRun;

			const result = toUserMessage(run);

			expect(result).toEqual({
				id: 'run-1:user',
				role: 'user',
				content: 'Hello assistant',
				createdAt: '2024-01-01T00:00:00.000Z',
			});
		});
	});

	describe('buildThreadMessages', () => {
		it('builds messages from runs with result messages', () => {
			const runs = [
				{
					id: 'run-1',
					status: 'completed',
					request: { threadId: 't1', canvasId: 'c1', message: 'Hello', contextMode: 'full' as const },
					resultMessage: { id: 'msg-2', role: 'assistant', content: 'Hi there', createdAt: '2024-01-01' },
					createdAt: '2024-01-01T00:00:00.000Z',
					updatedAt: '2024-01-01T00:00:00.000Z',
				},
			] as unknown as AssistantRun[];

			const result = buildThreadMessages(runs);

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({ role: 'user', content: 'Hello' });
			expect(result[1]).toMatchObject({ role: 'assistant', content: 'Hi there' });
		});

		it('handles runs without result messages', () => {
			const runs = [
				{
					id: 'run-1',
					status: 'running',
					request: { threadId: 't1', canvasId: 'c1', message: 'Hello', contextMode: 'full' as const },
					createdAt: '2024-01-01T00:00:00.000Z',
					updatedAt: '2024-01-01T00:00:00.000Z',
				},
			] as unknown as AssistantRun[];

			const result = buildThreadMessages(runs);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({ role: 'user', content: 'Hello' });
		});
	});

	describe('toAssistantRunEvent', () => {
		it('converts database row to AssistantRunEvent', () => {
			const now = new Date();
			const row = {
				id: 'evt-1',
				runId: 'run-1',
				sequence: 1,
				type: 'run.created' as const,
				dataJson: JSON.stringify({ status: 'running' }),
				createdAt: now,
			};

			const result = toAssistantRunEvent(row);

			expect(result).toEqual({
				id: 'evt-1',
				runId: 'run-1',
				sequence: 1,
				type: 'run.created',
				data: { status: 'running' },
				createdAt: now.toISOString(),
			});
		});
	});

	describe('toAssistantTask', () => {
		it('converts database row to AssistantTask', () => {
			const now = new Date();
			const row = {
				id: 'task-1',
				runId: 'run-1',
				type: 'generate_response' as const,
				status: 'completed' as const,
				title: 'Generate Code',
				inputJson: JSON.stringify({ prompt: 'test' }),
				outputJson: JSON.stringify({ result: 'done' }),
				error: null,
				createdAt: now,
				updatedAt: now,
			};

			const result = toAssistantTask(row);

			expect(result).toEqual({
				id: 'task-1',
				runId: 'run-1',
				type: 'generate_response',
				status: 'completed',
				title: 'Generate Code',
				input: { prompt: 'test' },
				output: { result: 'done' },
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
			});
		});
	});

	describe('toAssistantArtifactRecord', () => {
		it('converts database row to AssistantArtifactRecord', () => {
			const now = new Date();
			const row = {
				id: 'art-1',
				runId: 'run-1',
				taskId: 'task-1',
				type: 'image' as const,
				title: 'script.js',
				content: 'console.log("hello")',
				createdAt: now,
			};

			const result = toAssistantArtifactRecord(row);

			expect(result).toEqual({
				id: 'art-1',
				runId: 'run-1',
				taskId: 'task-1',
				type: 'image',
				title: 'script.js',
				content: 'console.log("hello")',
				createdAt: now.toISOString(),
			});
		});
	});

	describe('toAssistantRun', () => {
		it('converts database row to AssistantRun', () => {
			const now = new Date();
			const row = {
				id: 'run-1',
				userId: 'user-1',
				threadId: 'thread-1',
				requestCanvasId: 'canvas-1',
				status: 'completed' as const,
				requestMessage: 'Hello',
				contextMode: 'full' as const,
				modeHint: null,
				requestHistoryJson: JSON.stringify([{ id: '1', role: 'user', content: 'prev' }]),
				selectedElementIdsJson: JSON.stringify(['el-1', 'el-2']),
				prototypeContextJson: null,
				contextSnapshotJson: null,
				resultMessageJson: JSON.stringify({ id: '2', role: 'assistant', content: 'hi' }),
				error: null,
				createdAt: now,
				updatedAt: now,
			};

			// @ts-expect-error - simplified test data
			const result = toAssistantRun(row);

			expect(result.id).toBe('run-1');
			expect(result.status).toBe('completed');
			expect(result.request.message).toBe('Hello');
			expect(result.request.history).toEqual([{ id: '1', role: 'user', content: 'prev' }]);
			expect(result.request.selectedElementIds).toEqual(['el-1', 'el-2']);
			expect(result.resultMessage).toEqual({ id: '2', role: 'assistant', content: 'hi' });
		});
	});
});
