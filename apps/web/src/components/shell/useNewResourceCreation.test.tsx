import { useAppStore } from '@/stores/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewResourceCreation } from './useNewResourceCreation';

const { fetchMock, canvasSaveMock, canvasCreateMock } = vi.hoisted(() => ({
	fetchMock: vi.fn(),
	canvasSaveMock: vi.fn(),
	canvasCreateMock: vi.fn(),
}));

vi.mock('@clerk/clerk-react', () => ({
	useAuth: () => ({
		getToken: vi.fn().mockResolvedValue('test-token'),
	}),
}));

vi.mock('@/lib/api', () => ({
	getRequiredAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test' }),
	toApiUrl: (path: string) => path,
	api: {
		api: {
			canvas: {
				':id': {
					$put: (...args: unknown[]) => canvasSaveMock(...args),
				},
				create: {
					$post: (...args: unknown[]) => canvasCreateMock(...args),
				},
			},
		},
	},
}));

describe('useNewResourceCreation', () => {
	beforeEach(() => {
		globalThis.fetch = fetchMock as typeof fetch;
		fetchMock.mockResolvedValue({
			ok: true,
			text: vi.fn().mockResolvedValue(''),
		});
		useAppStore.setState({
			elements: [],
			appState: {
				scrollX: 0,
				scrollY: 0,
				width: 1200,
				height: 800,
				zoom: { value: 1 as never },
				selectedElementIds: {},
			},
		});
		canvasSaveMock.mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ version: 2 }),
			text: vi.fn().mockResolvedValue(''),
		});
		canvasCreateMock.mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ id: 'canvas-created' }),
			text: vi.fn().mockResolvedValue(''),
		});
	});

	it('creates prototype resources with the native prototype overlay definition', async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(['canvas', 'canvas-1'], {
			canvas: { id: 'canvas-1', title: 'Canvas', version: 1 },
			data: { elements: [], appState: {}, files: {} },
		});
		const updateScene = vi.fn();
		const getSceneElements = vi.fn(() => []);

		useAppStore.setState({
			excalidrawApi: {
				getSceneElements,
				updateScene,
			} as never,
		});

		const { result } = renderHook(
			() =>
				useNewResourceCreation({
					canvasId: 'canvas-1',
				}),
			{
				wrapper: ({ children }) => (
					<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
				),
			},
		);

		let creationResult: Awaited<ReturnType<typeof result.current.createResource>> | undefined;
		await act(async () => {
			creationResult = await result.current.createResource({ type: 'prototype' });
		});

		expect(creationResult).toEqual(
			expect.objectContaining({
				success: true,
				elementId: expect.any(String),
			}),
		);
		const resourceCall = fetchMock.mock.calls[0];
		expect(resourceCall?.[0]).toBe(
			`/api/canvas/canvas-1/resources/prototype/${creationResult?.elementId}`,
		);
		expect(resourceCall?.[1]).toMatchObject({
			method: 'PUT',
			headers: {
				Authorization: 'Bearer test',
				'Content-Type': 'application/json',
			},
		});
		expect(JSON.parse(String(resourceCall?.[1]?.body))).toMatchObject({
			title: 'New Prototype',
			data: {
				title: 'New Prototype',
				template: 'react',
				resourceSnapshot: {
					resourceType: 'prototype',
					title: 'New Prototype',
					snapshotVersion: 1,
					display: {
						summary: '1 file',
					},
				},
			},
		});
		expect(updateScene).toHaveBeenCalledTimes(1);

		const sceneUpdate = updateScene.mock.calls[0]?.[0] as {
			elements: Array<{
				id: string;
				customData?: {
					type?: string;
					title?: string;
					resourceSnapshot?: {
						resourceType?: string;
						resourceId?: string;
						title?: string;
						snapshotVersion?: number;
						display?: {
							summary?: string;
						};
					};
				};
			}>;
		};
		const createdElement = sceneUpdate.elements.at(-1);

		expect(createdElement?.customData?.type).toBe('prototype');
		expect(createdElement?.customData?.title).toBe('New Prototype');
		expect(createdElement?.customData?.resourceSnapshot).toMatchObject({
			resourceType: 'prototype',
			resourceId: creationResult?.elementId,
			title: 'New Prototype',
			snapshotVersion: 1,
			display: {
				summary: '1 file',
			},
		});
		expect(useAppStore.getState().elements.at(-1)?.customData?.type).toBe('prototype');
		expect(canvasSaveMock).toHaveBeenCalledWith(
			{
				param: { id: 'canvas-1' },
				json: expect.objectContaining({
					expectedVersion: 1,
				}),
			},
			{
				headers: { Authorization: 'Bearer test' },
			},
		);
	});

	it('creates a new canvas instead of treating the canvas action as a redirect-only no-op', async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(['canvases'], {
			items: [{ title: 'Untitled Canvas' }],
		});

		const { result } = renderHook(
			() =>
				useNewResourceCreation({
					canvasId: 'canvas-1',
				}),
			{
				wrapper: ({ children }) => (
					<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
				),
			},
		);

		let creationResult: Awaited<ReturnType<typeof result.current.createResource>> | undefined;
		await act(async () => {
			creationResult = await result.current.createResource({ type: 'canvas' });
		});

		expect(creationResult).toEqual({
			success: true,
			elementId: 'canvas-created',
		});
		expect(canvasCreateMock).toHaveBeenCalledWith(
			{
				json: expect.objectContaining({
					title: 'Untitled Canvas 2',
					description: '',
					isPublic: false,
				}),
			},
			{
				headers: { Authorization: 'Bearer test' },
			},
		);
	});
});
