import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	deleteHeavyResourceRecord,
	getHeavyResourceRecord,
	saveHeavyResourceRecord,
} from './heavy-resource-storage';

const {
	canvasFindFirstMock,
	heavyFindFirstMock,
	insertMock,
	insertValuesMock,
	updateMock,
	updateSetMock,
	updateWhereMock,
	deleteMock,
	deleteWhereMock,
} = vi.hoisted(() => {
	const canvasFindFirstMock = vi.fn();
	const heavyFindFirstMock = vi.fn();
	const insertValuesMock = vi.fn((_: unknown) => undefined);
	const insertMock = vi.fn(() => ({ values: insertValuesMock }));
	const updateWhereMock = vi.fn((..._args: unknown[]) => undefined);
	const updateSetMock = vi.fn((_: unknown) => ({
		where: vi.fn((...args: unknown[]) => {
			updateWhereMock(...args);
			return undefined;
		}),
	}));
	const updateMock = vi.fn(() => ({ set: updateSetMock }));
	const deleteWhereMock = vi.fn((..._args: unknown[]) => undefined);
	const deleteMock = vi.fn(() => ({ where: deleteWhereMock }));

	return {
		canvasFindFirstMock,
		heavyFindFirstMock,
		insertMock,
		insertValuesMock,
		updateMock,
		updateSetMock,
		updateWhereMock,
		deleteMock,
		deleteWhereMock,
	};
});

function createDbMock() {
	return {
		query: {
			canvases: {
				findFirst: canvasFindFirstMock,
			},
			heavyResources: {
				findFirst: heavyFindFirstMock,
			},
		},
		insert: insertMock,
		update: updateMock,
		delete: deleteMock,
	};
}

describe('heavy-resource-storage', () => {
	beforeEach(() => {
		canvasFindFirstMock.mockReset();
		heavyFindFirstMock.mockReset();
		insertMock.mockClear();
		insertValuesMock.mockClear();
		updateMock.mockClear();
		updateSetMock.mockClear();
		updateWhereMock.mockReset();
		deleteMock.mockClear();
		deleteWhereMock.mockReset();
	});

	it('loads a resource only when the canvas is owned by the current user', async () => {
		canvasFindFirstMock.mockResolvedValue({ id: 'canvas-1' });
		heavyFindFirstMock.mockResolvedValue({
			id: 'prototype-1',
			canvasId: 'canvas-1',
			resourceType: 'prototype',
			title: 'Prototype',
			dataJson: JSON.stringify({
				type: 'prototype',
				title: 'Prototype',
				template: 'react',
				files: {},
				dependencies: {},
			}),
			createdAt: new Date('2026-03-27T12:00:00.000Z'),
			updatedAt: new Date('2026-03-27T12:30:00.000Z'),
		});

		const record = await getHeavyResourceRecord(
			createDbMock() as never,
			'user-1',
			'canvas-1',
			'prototype',
			'prototype-1',
		);

		expect(record).toMatchObject({
			id: 'prototype-1',
			canvasId: 'canvas-1',
			resourceType: 'prototype',
			title: 'Prototype',
			createdAt: '2026-03-27T12:00:00.000Z',
			updatedAt: '2026-03-27T12:30:00.000Z',
			data: {
				type: 'prototype',
				title: 'Prototype',
			},
		});
	});

	it('creates a board resource record when one does not already exist', async () => {
		canvasFindFirstMock.mockResolvedValue({ id: 'canvas-1' });
		heavyFindFirstMock.mockResolvedValue(undefined);

		const record = await saveHeavyResourceRecord(
			createDbMock() as never,
			'user-1',
			{
				canvasId: 'canvas-1',
				resourceType: 'board',
				resourceId: 'board-1',
				title: 'Launch Board',
				data: {
					type: 'kanban',
					title: 'Launch Board',
					columns: [],
				},
			},
		);

		const insertValuesCall = insertValuesMock.mock.calls[0];
		const insertValues = insertValuesCall?.[0] as
			| { dataJson?: string; resourceType?: string }
			| undefined;

		expect(insertValues?.resourceType).toBe('board');
		expect(JSON.parse(insertValues?.dataJson ?? '{}')).toMatchObject({
			type: 'kanban',
			title: 'Launch Board',
		});
		expect(record).toMatchObject({
			id: 'board-1',
			canvasId: 'canvas-1',
			resourceType: 'board',
			title: 'Launch Board',
			data: {
				type: 'kanban',
				title: 'Launch Board',
			},
		});
	});

	it('updates an existing document resource without changing the created timestamp', async () => {
		const createdAt = new Date('2026-03-27T10:00:00.000Z');
		canvasFindFirstMock.mockResolvedValue({ id: 'canvas-1' });
		heavyFindFirstMock.mockResolvedValue({
			id: 'document-1',
			canvasId: 'canvas-1',
			resourceType: 'document',
			title: 'Draft',
			dataJson: JSON.stringify({
				type: 'newlex',
				title: 'Draft',
				lexicalState: '',
				comments: [],
				commentsPanelOpen: false,
				version: 1,
			}),
			createdAt,
			updatedAt: new Date('2026-03-27T11:00:00.000Z'),
		});

		const record = await saveHeavyResourceRecord(
			createDbMock() as never,
			'user-1',
			{
				canvasId: 'canvas-1',
				resourceType: 'document',
				resourceId: 'document-1',
				title: 'Updated Draft',
				data: {
					type: 'newlex',
					title: 'Updated Draft',
					lexicalState: '{"root":{}}',
				},
			},
		);

		const updateValuesCall = updateSetMock.mock.calls[0];
		const updateValues = updateValuesCall?.[0] as
			| { title?: string; dataJson?: string; updatedAt?: Date }
			| undefined;

		expect(updateValues?.title).toBe('Updated Draft');
		expect(updateValues?.updatedAt).toBeInstanceOf(Date);
		expect(JSON.parse(updateValues?.dataJson ?? '{}')).toMatchObject({
			type: 'newlex',
			title: 'Updated Draft',
			lexicalState: '{"root":{}}',
		});
		expect(record).toMatchObject({
			id: 'document-1',
			canvasId: 'canvas-1',
			resourceType: 'document',
			title: 'Updated Draft',
			createdAt: '2026-03-27T10:00:00.000Z',
			data: {
				type: 'newlex',
				title: 'Updated Draft',
			},
		});
	});

	it('deletes an owned resource record', async () => {
		canvasFindFirstMock.mockResolvedValue({ id: 'canvas-1' });
		heavyFindFirstMock.mockResolvedValue({
			id: 'board-1',
			canvasId: 'canvas-1',
			resourceType: 'board',
			title: 'Launch Board',
			dataJson: JSON.stringify({
				type: 'kanban',
				title: 'Launch Board',
				columns: [],
			}),
			createdAt: new Date('2026-03-27T10:00:00.000Z'),
			updatedAt: new Date('2026-03-27T11:00:00.000Z'),
		});

		const deleted = await deleteHeavyResourceRecord(
			createDbMock() as never,
			'user-1',
			'canvas-1',
			'board',
			'board-1',
		);

		expect(deleted).toBe(true);
		expect(deleteWhereMock).toHaveBeenCalledTimes(1);
	});
});
