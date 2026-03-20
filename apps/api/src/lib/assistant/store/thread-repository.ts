/**
 * Thread CRUD operations for the assistant store.
 */

import type { AssistantThread } from '@ai-canvas/shared/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../../db/client';
import {
	assistantArtifacts,
	assistantRunEvents,
	assistantRuns,
	assistantTasks,
	assistantThreads,
	canvases,
} from '../../db/schema';
import { buildThreadMessages, normalizeThreadTitle, summarizeAssistantThreadTitle, toAssistantThread } from './transforms';
import { listAssistantRunsByThreadRecord } from './run-repository';

export async function createAssistantThreadRecord(
	db: Database,
	userId: string,
	input: {
		canvasId: string;
		title?: string;
	},
): Promise<AssistantThread> {
	const canvas = await db.query.canvases.findFirst({
		where: and(eq(canvases.id, input.canvasId), eq(canvases.userId, userId)),
		columns: { id: true },
	});

	if (!canvas) {
		throw new Error('Canvas not found');
	}

	const now = new Date();
	const id = nanoid();
	await db.insert(assistantThreads).values({
		id,
		userId,
		canvasId: input.canvasId,
		title: normalizeThreadTitle(input.title),
		createdAt: now,
		updatedAt: now,
	});

	const created = await db.query.assistantThreads.findFirst({
		where: and(eq(assistantThreads.id, id), eq(assistantThreads.userId, userId)),
	});

	if (!created) {
		throw new Error('Failed to create assistant thread');
	}

	return toAssistantThread(created, []);
}

export async function getAssistantThreadRecord(
	db: Database,
	userId: string,
	threadId: string,
): Promise<AssistantThread | null> {
	const row = await db.query.assistantThreads.findFirst({
		where: and(eq(assistantThreads.id, threadId), eq(assistantThreads.userId, userId)),
	});

	if (!row) {
		return null;
	}

	const runs = await listAssistantRunsByThreadRecord(db, userId, threadId);
	return toAssistantThread(row, buildThreadMessages(runs));
}

export async function listAssistantThreadsRecord(
	db: Database,
	userId: string,
	canvasId: string,
): Promise<AssistantThread[]> {
	const rows = await db
		.select()
		.from(assistantThreads)
		.where(and(eq(assistantThreads.userId, userId), eq(assistantThreads.canvasId, canvasId)))
		.orderBy(desc(assistantThreads.updatedAt), desc(assistantThreads.createdAt));

	const threads = await Promise.all(
		rows.map(async (row) => {
			const runs = await listAssistantRunsByThreadRecord(db, userId, row.id);
			return toAssistantThread(row, buildThreadMessages(runs));
		}),
	);

	return threads;
}

export async function updateAssistantThreadRecord(
	db: Database,
	userId: string,
	threadId: string,
	patch: {
		title?: string;
		touchUpdatedAt?: boolean;
	},
): Promise<AssistantThread | null> {
	const nextTitle = patch.title !== undefined ? normalizeThreadTitle(patch.title) : undefined;

	await db
		.update(assistantThreads)
		.set({
			title: nextTitle,
			updatedAt: patch.touchUpdatedAt || nextTitle !== undefined ? new Date() : undefined,
		})
		.where(and(eq(assistantThreads.id, threadId), eq(assistantThreads.userId, userId)));

	return getAssistantThreadRecord(db, userId, threadId);
}

export async function deleteAssistantThreadRecord(
	db: Database,
	userId: string,
	threadId: string,
): Promise<boolean> {
	const thread = await db.query.assistantThreads.findFirst({
		where: and(eq(assistantThreads.id, threadId), eq(assistantThreads.userId, userId)),
		columns: { id: true },
	});

	if (!thread) {
		return false;
	}

	await db.delete(assistantArtifacts).where(
		sql`${assistantArtifacts.taskId} in (
			select ${assistantTasks.id}
			from ${assistantTasks}
			inner join ${assistantRuns} on ${assistantTasks.runId} = ${assistantRuns.id}
			where ${assistantRuns.threadId} = ${threadId}
		)`,
	);
	await db.delete(assistantTasks).where(
		sql`${assistantTasks.runId} in (
			select ${assistantRuns.id}
			from ${assistantRuns}
			where ${assistantRuns.threadId} = ${threadId}
		)`,
	);
	await db.delete(assistantRunEvents).where(
		sql`${assistantRunEvents.runId} in (
			select ${assistantRuns.id}
			from ${assistantRuns}
			where ${assistantRuns.threadId} = ${threadId}
		)`,
	);
	await db
		.delete(assistantRuns)
		.where(and(eq(assistantRuns.threadId, threadId), eq(assistantRuns.userId, userId)));
	await db
		.delete(assistantThreads)
		.where(and(eq(assistantThreads.id, threadId), eq(assistantThreads.userId, userId)));

	return true;
}
