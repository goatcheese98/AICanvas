import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	findFirstMock,
	insertMock,
	insertValuesMock,
	insertReturningMock,
	updateMock,
	updateSetMock,
	updateWhereMock,
	updateReturningMock,
	deleteMock,
	deleteWhereMock,
	createDbMock,
	saveCanvasToR2Mock,
	loadCanvasFromR2Mock,
	loadThumbnailFromR2Mock,
	saveThumbnailToR2Mock,
	deleteCanvasFromR2Mock,
	deleteCanvasDataFromR2Mock,
	deleteThumbnailFromR2Mock,
	getCanvasR2KeyMock,
} = vi.hoisted(() => {
	const findFirstMock = vi.fn();
	const insertReturningMock = vi.fn();
	const insertValuesMock = vi.fn(() => ({ returning: insertReturningMock }));
	const insertMock = vi.fn(() => ({ values: insertValuesMock }));
	const updateWhereMock = vi.fn();
	const updateReturningMock = vi.fn();
	const updateSetMock = vi.fn(() => ({
		where: vi.fn((...args: unknown[]) => {
			updateWhereMock(...args);
			return { returning: updateReturningMock };
		}),
	}));
	const updateMock = vi.fn(() => ({ set: updateSetMock }));
	const deleteWhereMock = vi.fn();
	const deleteMock = vi.fn(() => ({ where: deleteWhereMock }));
	const createDbMock = vi.fn(() => ({
		query: {
			canvases: {
				findFirst: findFirstMock,
			},
		},
		insert: insertMock,
		update: updateMock,
		delete: deleteMock,
	}));
	const saveCanvasToR2Mock = vi.fn();
	const loadCanvasFromR2Mock = vi.fn();
	const loadThumbnailFromR2Mock = vi.fn();
	const saveThumbnailToR2Mock = vi.fn();
	const deleteCanvasFromR2Mock = vi.fn();
	const deleteCanvasDataFromR2Mock = vi.fn();
	const deleteThumbnailFromR2Mock = vi.fn();
	const getCanvasR2KeyMock = vi.fn(
		(userId: string, canvasId: string) => `canvases/${userId}/${canvasId}/canvas.json`,
	);

	return {
		findFirstMock,
		insertMock,
		insertValuesMock,
		insertReturningMock,
		updateMock,
		updateSetMock,
		updateWhereMock,
		updateReturningMock,
		deleteMock,
		deleteWhereMock,
		createDbMock,
		saveCanvasToR2Mock,
		loadCanvasFromR2Mock,
		loadThumbnailFromR2Mock,
		saveThumbnailToR2Mock,
		deleteCanvasFromR2Mock,
		deleteCanvasDataFromR2Mock,
		deleteThumbnailFromR2Mock,
		getCanvasR2KeyMock,
	};
});

vi.mock('nanoid', () => ({ nanoid: () => 'canvas-1' }));

vi.mock('../middleware/auth', () => ({
	requireAuth: async (
		c: {
			set: (key: 'user', value: { id: string; email: string; name: string }) => void;
		},
		next: () => Promise<void>,
	) => {
		c.set('user', { id: 'user-1', email: 'user@example.com', name: 'User One' });
		await next();
	},
}));

vi.mock('../lib/db/client', () => ({
	createDb: createDbMock,
}));

vi.mock('../lib/observability', () => ({
	logApiEvent: vi.fn(),
}));

vi.mock('../lib/storage/canvas-storage', () => ({
	CanvasPayloadTooLargeError: class CanvasPayloadTooLargeError extends Error {},
	deleteCanvasFromR2: deleteCanvasFromR2Mock,
	deleteCanvasDataFromR2: deleteCanvasDataFromR2Mock,
	deleteThumbnailFromR2: deleteThumbnailFromR2Mock,
	getCanvasR2Key: getCanvasR2KeyMock,
	loadCanvasFromR2: loadCanvasFromR2Mock,
	loadThumbnailFromR2: loadThumbnailFromR2Mock,
	saveCanvasToR2: saveCanvasToR2Mock,
	saveThumbnailToR2: saveThumbnailToR2Mock,
}));

import { canvasRoutes } from './canvas';

function createJsonRequest(url: string, method: 'POST' | 'PUT', body: Record<string, unknown>) {
	return new Request(url, {
		method,
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
}

describe('canvasRoutes', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		findFirstMock.mockReset();
		insertMock.mockClear();
		insertValuesMock.mockClear();
		insertReturningMock.mockReset();
		updateMock.mockClear();
		updateSetMock.mockClear();
		updateWhereMock.mockReset();
		updateReturningMock.mockReset();
		deleteMock.mockClear();
		deleteWhereMock.mockReset();
		createDbMock.mockClear();
		saveCanvasToR2Mock.mockReset();
		loadCanvasFromR2Mock.mockReset();
		loadThumbnailFromR2Mock.mockReset();
		saveThumbnailToR2Mock.mockReset();
		deleteCanvasFromR2Mock.mockReset();
		deleteCanvasDataFromR2Mock.mockReset();
		deleteThumbnailFromR2Mock.mockReset();
		getCanvasR2KeyMock.mockClear();
	});

	it('removes the inserted canvas row when initial blob creation fails', async () => {
		findFirstMock.mockResolvedValue(undefined);
		insertReturningMock.mockResolvedValue([
			{
				id: 'canvas-1',
				userId: 'user-1',
				title: 'New canvas',
				description: undefined,
				r2Key: 'canvases/user-1/canvas-1/canvas.json',
				thumbnailUrl: null,
				isPublic: false,
				isFavorite: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		]);
		saveCanvasToR2Mock.mockRejectedValue(new Error('r2 unavailable'));
		deleteWhereMock.mockResolvedValue(undefined);

		const response = await canvasRoutes.fetch(
			createJsonRequest('http://localhost/create', 'POST', { title: 'New canvas' }),
			{ DB: {} as D1Database, R2: {} as R2Bucket } as never,
			{} as ExecutionContext,
		);

		expect(response.status).toBe(500);
		expect(deleteMock).toHaveBeenCalled();
		expect(deleteWhereMock).toHaveBeenCalledTimes(1);
	});

	it('restores the previous blob when metadata update fails after a save', async () => {
		findFirstMock.mockResolvedValue({ id: 'canvas-1', userId: 'user-1', version: 3 });
		loadCanvasFromR2Mock.mockResolvedValue({
			elements: [{ id: 'before' }],
			appState: {},
			files: {},
		});
		saveCanvasToR2Mock.mockResolvedValue('canvases/user-1/canvas-1/canvas.json');
		updateReturningMock.mockRejectedValue(new Error('db unavailable'));

		const response = await canvasRoutes.fetch(
			createJsonRequest('http://localhost/canvas-1', 'PUT', {
				elements: [{ id: 'after' }],
				appState: {},
				files: {},
				expectedVersion: 3,
			}),
			{ DB: {} as D1Database, R2: {} as R2Bucket } as never,
			{} as ExecutionContext,
		);

		expect(response.status).toBe(500);
		expect(saveCanvasToR2Mock).toHaveBeenCalledTimes(2);
		expect(saveCanvasToR2Mock).toHaveBeenNthCalledWith(2, {} as R2Bucket, 'user-1', 'canvas-1', {
			elements: [{ id: 'before' }],
			appState: {},
			files: {},
		});
		expect(deleteCanvasDataFromR2Mock).not.toHaveBeenCalled();
	});

	it('rejects stale save requests before writing to storage', async () => {
		findFirstMock.mockResolvedValue({ id: 'canvas-1', userId: 'user-1', version: 7 });

		const response = await canvasRoutes.fetch(
			createJsonRequest('http://localhost/canvas-1', 'PUT', {
				elements: [{ id: 'after' }],
				appState: {},
				files: {},
				expectedVersion: 6,
			}),
			{ DB: {} as D1Database, R2: {} as R2Bucket } as never,
			{} as ExecutionContext,
		);

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toEqual({
			error: 'Canvas has changed since your last sync. Refresh before saving again.',
			currentVersion: 7,
		});
		expect(saveCanvasToR2Mock).not.toHaveBeenCalled();
	});
});
