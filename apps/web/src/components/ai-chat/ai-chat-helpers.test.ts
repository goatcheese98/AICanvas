import type { AssistantMessage } from '@ai-canvas/shared/types';
import { describe, expect, it } from 'vitest';
import {
	buildArtifactKey,
	getLatestPendingPatchArtifacts,
	getThreadDisplayTitle,
	getThreadMonogram,
	getThreadPreview,
} from './ai-chat-helpers';

describe('ai chat helpers', () => {
	it('builds stable artifact keys', () => {
		expect(buildArtifactKey('message-1', { type: 'markdown', content: '# Hello' }, 2)).toBe(
			'message-1-markdown-2',
		);
	});

	it('finds the latest pending patch artifacts only', () => {
		const messages: AssistantMessage[] = [
			{
				id: 'm1',
				role: 'assistant',
				content: 'first',
				createdAt: '2026-03-13T10:00:00.000Z',
				artifacts: [
					{
						type: 'markdown-patch',
						content: JSON.stringify({
							summary: 'Patch one',
							targetId: 'note-1',
							base: {
								title: 'Old',
								content: 'before',
								images: [],
								settings: {},
								editorMode: 'split',
							},
							next: {
								title: 'New',
								content: 'after',
								images: [],
								settings: {},
								editorMode: 'split',
							},
						}),
					},
				],
			},
			{
				id: 'm2',
				role: 'assistant',
				content: 'second',
				createdAt: '2026-03-13T10:01:00.000Z',
				artifacts: [
					{
						type: 'kanban-patch',
						content: JSON.stringify({
							summary: 'Patch two',
							targetId: 'board-1',
							base: { title: 'Board', columns: [] },
							next: { title: 'Board', columns: [{ id: 'col-1', title: 'Todo', cards: [] }] },
						}),
					},
				],
			},
		];

		expect(
			getLatestPendingPatchArtifacts(messages, {
				'm2-kanban-patch-0': {
					status: 'applied',
					targetId: 'board-1',
					targetType: 'kanban',
					previousCustomData: {},
				},
			}),
		).toEqual([
			{
				artifact: messages[0].artifacts?.[0],
				artifactKey: 'm1-markdown-patch-0',
			},
		]);
	});

	it('derives thread title and preview from user messages', () => {
		const thread = {
			title: 'Launch planning',
			messages: [
				{
					id: 'msg-1',
					role: 'assistant' as const,
					content: 'How can I help?',
					createdAt: '2026-03-13T10:00:00.000Z',
				},
				{
					id: 'msg-2',
					role: 'user' as const,
					content: 'Turn this into kanban tasks',
					createdAt: '2026-03-13T10:01:00.000Z',
				},
			],
		};

		expect(getThreadDisplayTitle(thread)).toBe('Launch planning');
		expect(getThreadPreview(thread)).toBe('Turn this into kanban tasks');
	});

	it('falls back to a default monogram when a title is blank', () => {
		expect(getThreadMonogram('')).toBe('AI');
		expect(getThreadMonogram('Launch Planning')).toBe('LP');
	});
});
