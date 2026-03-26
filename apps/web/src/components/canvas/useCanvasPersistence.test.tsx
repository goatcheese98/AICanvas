import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { addToastMock, putMock, setPersistenceStateMock } = vi.hoisted(() => ({
	addToastMock: vi.fn(),
	putMock: vi.fn(),
	setPersistenceStateMock: vi.fn(),
}));

vi.mock('@clerk/clerk-react', () => ({
	useAuth: () => ({
		getToken: vi.fn().mockResolvedValue('mock-token'),
	}),
}));

vi.mock('@/lib/api', () => ({
	api: {
		api: {
			canvas: {
				':id': {
					$put: putMock,
				},
			},
		},
	},
	createObservedResponseError: vi.fn(),
	getRequiredAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer mock-token' }),
	observedFetch: vi.fn(),
	toApiUrl: vi.fn((path: string) => path),
}));

vi.mock('@/lib/observability', () => ({
	captureBrowserException: vi.fn(),
}));

vi.mock('@/stores/store', () => ({
	useAppStore: vi.fn((selector) =>
		selector({
			addToast: addToastMock,
			setPersistenceState: setPersistenceStateMock,
		}),
	),
}));

vi.mock('./canvas-container-utils', () => ({
	getExportToBlob: vi.fn(),
	getThumbnailSignature: vi.fn().mockReturnValue('thumbnail-signature'),
}));

import { useCanvasPersistence } from './useCanvasPersistence';

const emptyCanvasData = {
	elements: [],
	appState: {},
	files: null,
};

describe('useCanvasPersistence', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	function wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client: queryClient }, children);
	}

	it('sends the last known canvas version with save requests', async () => {
		putMock.mockResolvedValue(
			new Response(JSON.stringify({ success: true, version: 4 }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const { result } = renderHook(() => useCanvasPersistence({ canvasId: 'canvas-1' }), {
			wrapper,
		});
		result.current.canvasVersionRef.current = 3;

		await act(async () => {
			await result.current.forceServerSave(emptyCanvasData);
		});

		expect(putMock).toHaveBeenCalledWith(
			{
				param: { id: 'canvas-1' },
				json: {
					elements: [],
					appState: {},
					files: null,
					expectedVersion: 3,
				},
			},
			{ headers: { Authorization: 'Bearer mock-token' } },
		);
		expect(result.current.canvasVersionRef.current).toBe(4);
	});

	it('blocks further saves after a version conflict until the user refreshes', async () => {
		putMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					error: 'Canvas has changed since your last sync. Refresh before saving again.',
					currentVersion: 6,
				}),
				{
					status: 409,
					headers: { 'Content-Type': 'application/json' },
				},
			),
		);

		const { result } = renderHook(() => useCanvasPersistence({ canvasId: 'canvas-1' }), {
			wrapper,
		});
		result.current.canvasVersionRef.current = 5;

		await act(async () => {
			await result.current.forceServerSave(emptyCanvasData);
		});

		expect(result.current.hasVersionConflictRef.current).toBe(true);
		expect(addToastMock).toHaveBeenCalledWith({
			message: 'Canvas changed in another session. Refresh before saving again.',
			type: 'error',
		});
	});
});
