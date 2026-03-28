import {
	normalizeKanbanOverlay,
	normalizeNewLexOverlay,
	normalizePrototypeOverlay,
} from '@ai-canvas/shared/schemas';
import type {
	BoardResourceRecord,
	DocumentResourceRecord,
	HeavyResourceRecord,
	HeavyResourceType,
	PrototypeResourceRecord,
} from '@ai-canvas/shared/types';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { canvases, heavyResources } from '../db/schema';

function toIsoString(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : value;
}

function normalizeHeavyResourceData(
	resourceType: HeavyResourceType,
	data: unknown,
): BoardResourceRecord['data'] | DocumentResourceRecord['data'] | PrototypeResourceRecord['data'] {
	switch (resourceType) {
		case 'board':
			return normalizeKanbanOverlay(data as Parameters<typeof normalizeKanbanOverlay>[0]) as BoardResourceRecord['data'];
		case 'document':
			return normalizeNewLexOverlay(data as Parameters<typeof normalizeNewLexOverlay>[0]) as DocumentResourceRecord['data'];
		case 'prototype':
			return normalizePrototypeOverlay(data as Parameters<typeof normalizePrototypeOverlay>[0]) as PrototypeResourceRecord['data'];
	}
}

function parseHeavyResourceData(
	resourceType: HeavyResourceType,
	dataJson: string,
): BoardResourceRecord['data'] | DocumentResourceRecord['data'] | PrototypeResourceRecord['data'] {
	const rawData = JSON.parse(dataJson) as unknown;
	return normalizeHeavyResourceData(resourceType, rawData);
}

function toHeavyResourceRecord(row: {
	id: string;
	canvasId: string;
	resourceType: HeavyResourceType;
	title: string;
	dataJson: string;
	createdAt: Date;
	updatedAt: Date;
}): HeavyResourceRecord {
	const data = parseHeavyResourceData(row.resourceType, row.dataJson);
	const base = {
		id: row.id,
		canvasId: row.canvasId,
		resourceType: row.resourceType,
		title: row.title,
		createdAt: toIsoString(row.createdAt),
		updatedAt: toIsoString(row.updatedAt),
	};

	if (row.resourceType === 'board') {
		const boardData = data as BoardResourceRecord['data'];
		return {
			...base,
			resourceType: 'board',
			data: boardData,
		};
	}

	if (row.resourceType === 'document') {
		const documentData = data as DocumentResourceRecord['data'];
		return {
			...base,
			resourceType: 'document',
			data: documentData,
		};
	}

	const prototypeData = data as PrototypeResourceRecord['data'];
	return {
		...base,
		resourceType: 'prototype',
		data: prototypeData,
	};
}

async function getOwnedCanvasId(db: Database, userId: string, canvasId: string): Promise<string | null> {
	const canvas = await db.query.canvases.findFirst({
		where: and(eq(canvases.id, canvasId), eq(canvases.userId, userId)),
		columns: { id: true },
	});

	return canvas?.id ?? null;
}

export async function getHeavyResourceRecord(
	db: Database,
	userId: string,
	canvasId: string,
	resourceType: HeavyResourceType,
	resourceId: string,
): Promise<HeavyResourceRecord | null> {
	const ownedCanvasId = await getOwnedCanvasId(db, userId, canvasId);
	if (!ownedCanvasId) {
		return null;
	}

	const row = await db.query.heavyResources.findFirst({
		where: and(
			eq(heavyResources.canvasId, ownedCanvasId),
			eq(heavyResources.resourceType, resourceType),
			eq(heavyResources.id, resourceId),
		),
	});

	return row
		? toHeavyResourceRecord({
				id: row.id,
				canvasId: row.canvasId,
				resourceType: row.resourceType as HeavyResourceType,
				title: row.title,
				dataJson: row.dataJson,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			})
		: null;
}

export async function saveHeavyResourceRecord(
	db: Database,
	userId: string,
	input: {
		canvasId: string;
		resourceType: HeavyResourceType;
		resourceId: string;
		title: string;
		data: unknown;
	},
): Promise<HeavyResourceRecord> {
	const ownedCanvasId = await getOwnedCanvasId(db, userId, input.canvasId);
	if (!ownedCanvasId) {
		throw new Error('Canvas not found');
	}

	const normalizedData = normalizeHeavyResourceData(input.resourceType, input.data);
	const existing = await db.query.heavyResources.findFirst({
		where: and(
			eq(heavyResources.canvasId, ownedCanvasId),
			eq(heavyResources.resourceType, input.resourceType),
			eq(heavyResources.id, input.resourceId),
		),
	});
	const now = new Date();
	const dataJson = JSON.stringify(normalizedData);

	if (existing) {
		await db
			.update(heavyResources)
			.set({
				title: input.title,
				dataJson,
				updatedAt: now,
			})
			.where(
				and(
					eq(heavyResources.canvasId, ownedCanvasId),
					eq(heavyResources.resourceType, input.resourceType),
					eq(heavyResources.id, input.resourceId),
				),
			);

		return toHeavyResourceRecord({
			id: existing.id,
			canvasId: existing.canvasId,
			resourceType: existing.resourceType as HeavyResourceType,
			title: input.title,
			dataJson,
			createdAt: existing.createdAt,
			updatedAt: now,
		});
	}

	await db.insert(heavyResources).values({
		id: input.resourceId,
		canvasId: ownedCanvasId,
		resourceType: input.resourceType,
		title: input.title,
		dataJson,
		createdAt: now,
		updatedAt: now,
	});

	return toHeavyResourceRecord({
		id: input.resourceId,
		canvasId: ownedCanvasId,
		resourceType: input.resourceType,
		title: input.title,
		dataJson,
		createdAt: now,
		updatedAt: now,
	});
}

export async function deleteHeavyResourceRecord(
	db: Database,
	userId: string,
	canvasId: string,
	resourceType: HeavyResourceType,
	resourceId: string,
): Promise<boolean> {
	const ownedCanvasId = await getOwnedCanvasId(db, userId, canvasId);
	if (!ownedCanvasId) {
		return false;
	}

	const existing = await db.query.heavyResources.findFirst({
		where: and(
			eq(heavyResources.canvasId, ownedCanvasId),
			eq(heavyResources.resourceType, resourceType),
			eq(heavyResources.id, resourceId),
		),
	});

	if (!existing) {
		return false;
	}

	await db.delete(heavyResources).where(
		and(
			eq(heavyResources.canvasId, ownedCanvasId),
			eq(heavyResources.resourceType, resourceType),
			eq(heavyResources.id, resourceId),
		),
	);

	return true;
}
