import { useAppStore } from '@/stores/store';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewResourceCreation } from './useNewResourceCreation';

const { fetchMock } = vi.hoisted(() => ({
	fetchMock: vi.fn(),
}));

vi.mock('@clerk/clerk-react', () => ({
	useAuth: () => ({
		getToken: vi.fn().mockResolvedValue('test-token'),
	}),
}));

vi.mock('@/lib/api', () => ({
	getRequiredAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test' }),
	toApiUrl: (path: string) => path,
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
	});

	it('creates prototype resources with the native prototype overlay definition', async () => {
		const updateScene = vi.fn();
		const getSceneElements = vi.fn(() => []);

		useAppStore.setState({
			excalidrawApi: {
				getSceneElements,
				updateScene,
			} as never,
		});

		const { result } = renderHook(() =>
			useNewResourceCreation({
				canvasId: 'canvas-1',
			}),
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
	});
});
