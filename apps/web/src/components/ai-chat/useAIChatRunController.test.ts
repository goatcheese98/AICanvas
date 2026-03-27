import * as apiModule from '@/lib/api';
import type { AssistantThread } from '@ai-canvas/shared/types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAIChatRunController } from './useAIChatRunController';

const { postRunMock } = vi.hoisted(() => ({
	postRunMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
	api: {
		api: {
			assistant: {
				runs: {
					$post: postRunMock,
				},
			},
		},
	},
	fetchAssistantRun: vi.fn(),
	fetchAssistantRunArtifacts: vi.fn(),
	fetchAssistantRunTasks: vi.fn(),
	getRequiredAuthHeaders: vi.fn(),
	streamAssistantRunEvents: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
	captureBrowserException: vi.fn(),
}));

function createController(input: string, selectedElementIds: Record<string, boolean>) {
	const currentThread: AssistantThread = {
		id: 'thread-1',
		canvasId: 'canvas-1',
		title: 'Thread',
		messages: [],
		createdAt: '2026-03-19T10:00:00.000Z',
		updatedAt: '2026-03-19T10:00:00.000Z',
	};

	return renderHook(() =>
		useAIChatRunController({
			canvasId: 'canvas-1',
			getToken: vi.fn().mockResolvedValue('token'),
			isSignedIn: true,
			selectedElementIds,
			input,
			setInput: vi.fn(),
			isChatLoading: false,
			setIsChatLoading: vi.fn(),
			setChatError: vi.fn(),
			currentThread,
			messages: [],
			createThread: vi.fn(),
			appendMessageToThread: vi.fn(),
			latestPendingPatchArtifacts: [],
			assistantPatchStates: {},
			applyAssistantPatch: vi.fn(),
			appendLocalAssistantMessage: vi.fn(),
		}),
	);
}

describe('useAIChatRunController', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		postRunMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				runId: 'run-1',
				status: 'queued',
			}),
		});
		vi.mocked(apiModule.getRequiredAuthHeaders).mockResolvedValue({
			Authorization: 'Bearer token',
		});
		vi.mocked(apiModule.streamAssistantRunEvents).mockResolvedValue();
		vi.mocked(apiModule.fetchAssistantRun).mockResolvedValue({
			id: 'run-1',
			request: {
				threadId: 'thread-1',
				canvasId: 'canvas-1',
				message: 'Diagram the whole canvas auth flow',
				contextMode: 'all',
				history: [],
				selectedElementIds: ['card-1'],
			},
			status: 'completed',
			error: undefined,
			createdAt: '2026-03-19T10:00:01.000Z',
			updatedAt: '2026-03-19T10:00:02.000Z',
		});
		vi.mocked(apiModule.fetchAssistantRunTasks).mockResolvedValue([]);
		vi.mocked(apiModule.fetchAssistantRunArtifacts).mockResolvedValue([]);
	});

	it('uses the current selection automatically for selection-oriented prompts', async () => {
		const { result } = createController('Turn this into kanban tasks', { 'card-1': true });

		await act(async () => {
			await result.current.sendMessage();
		});

		expect(postRunMock).toHaveBeenCalledWith(
			expect.objectContaining({
				json: expect.objectContaining({
					contextMode: 'selected',
					message: 'Turn this into kanban tasks',
					selectedElementIds: ['card-1'],
				}),
			}),
			expect.anything(),
		);
	});

	it('keeps the whole canvas context when the prompt asks for the whole canvas', async () => {
		const { result } = createController('Diagram the whole canvas auth flow', { 'card-1': true });

		await act(async () => {
			await result.current.sendMessage();
		});

		expect(postRunMock).toHaveBeenCalledWith(
			expect.objectContaining({
				json: expect.objectContaining({
					contextMode: 'all',
					message: 'Diagram the whole canvas auth flow',
					selectedElementIds: ['card-1'],
				}),
			}),
			expect.anything(),
		);
	});

	it('strips stacked slash commands and sends their overrides', async () => {
		const { result } = createController('/select /svg make this a badge', { 'card-1': true });

		await act(async () => {
			await result.current.sendMessage();
		});

		expect(postRunMock).toHaveBeenCalledWith(
			expect.objectContaining({
				json: expect.objectContaining({
					contextMode: 'selected',
					modeHint: 'svg',
					message: 'make this a badge',
					selectedElementIds: ['card-1'],
				}),
			}),
			expect.anything(),
		);
	});

	it('fails loudly when /select is used without a selection', async () => {
		const setChatError = vi.fn();
		const currentThread: AssistantThread = {
			id: 'thread-1',
			canvasId: 'canvas-1',
			title: 'Thread',
			messages: [],
			createdAt: '2026-03-19T10:00:00.000Z',
			updatedAt: '2026-03-19T10:00:00.000Z',
		};

		const { result } = renderHook(() =>
			useAIChatRunController({
				canvasId: 'canvas-1',
				getToken: vi.fn().mockResolvedValue('token'),
				isSignedIn: true,
				selectedElementIds: {},
				input: '/select tighten this copy',
				setInput: vi.fn(),
				isChatLoading: false,
				setIsChatLoading: vi.fn(),
				setChatError,
				currentThread,
				messages: [],
				createThread: vi.fn(),
				appendMessageToThread: vi.fn(),
				latestPendingPatchArtifacts: [],
				assistantPatchStates: {},
				applyAssistantPatch: vi.fn(),
				appendLocalAssistantMessage: vi.fn(),
			}),
		);

		await act(async () => {
			await result.current.sendMessage();
		});

		expect(setChatError).toHaveBeenCalledWith(
			'There is no current selection to use. Select an item or use /selectall.',
		);
		expect(postRunMock).not.toHaveBeenCalled();
	});
});
