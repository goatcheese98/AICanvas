/**
 * Task CRUD operations for the assistant store.
 */

import type {
	AssistantTask,
	AssistantTaskInput,
	AssistantTaskOutput,
	AssistantTaskStatus,
	AssistantTaskType,
} from '@ai-canvas/shared/types';
import { and, asc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../../db/client';
import { assistantRuns, assistantTasks } from '../../db/schema';
import { toAssistantTask } from './transforms';

export async function createAssistantTaskRecord(
	db: Database,
	userId: string,
	input: {
		runId: string;
		type: AssistantTaskType;
		title: string;
		input?: AssistantTaskInput;
	},
): Promise<AssistantTask> {
	const run = await db.query.assistantRuns.findFirst({
		where: and(eq(assistantRuns.id, input.runId), eq(assistantRuns.userId, userId)),
	});

	if (!run) {
		throw new Error('Assistant run not found');
	}

	const now = new Date();
	const id = nanoid();

	await db.insert(assistantTasks).values({
		id,
		runId: input.runId,
		type: input.type,
		status: 'queued' as AssistantTaskStatus,
		title: input.title,
		inputJson: input.input ? JSON.stringify(input.input) : null,
		createdAt: now,
		updatedAt: now,
	});

	const [created] = await db
		.select()
		.from(assistantTasks)
		.where(and(eq(assistantTasks.id, id), eq(assistantTasks.runId, input.runId)))
		.limit(1);

	if (!created) {
		throw new Error('Failed to create assistant task');
	}

	return toAssistantTask(created);
}

export async function updateAssistantTaskRecord(
	db: Database,
	userId: string,
	taskId: string,
	patch: {
		status?: AssistantTaskStatus;
		output?: AssistantTaskOutput;
		error?: string | null;
	},
): Promise<AssistantTask | null> {
	await db
		.update(assistantTasks)
		.set({
			status: patch.status,
			outputJson: patch.output ? JSON.stringify(patch.output) : undefined,
			error: patch.error,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(assistantTasks.id, taskId),
				sql`exists (
					select 1 from ${assistantRuns}
					where ${assistantRuns.id} = ${assistantTasks.runId}
					and ${assistantRuns.userId} = ${userId}
				)`,
			),
		);

	return getAssistantTaskRecord(db, userId, taskId);
}

export async function getAssistantTaskRecord(
	db: Database,
	userId: string,
	taskId: string,
): Promise<AssistantTask | null> {
	const rows = await db
		.select({
			id: assistantTasks.id,
			runId: assistantTasks.runId,
			type: assistantTasks.type,
			status: assistantTasks.status,
			title: assistantTasks.title,
			inputJson: assistantTasks.inputJson,
			outputJson: assistantTasks.outputJson,
			error: assistantTasks.error,
			createdAt: assistantTasks.createdAt,
			updatedAt: assistantTasks.updatedAt,
		})
		.from(assistantTasks)
		.innerJoin(assistantRuns, eq(assistantTasks.runId, assistantRuns.id))
		.where(and(eq(assistantTasks.id, taskId), eq(assistantRuns.userId, userId)))
		.limit(1);

	const row = rows[0];
	return row
		? toAssistantTask({
				id: row.id,
				runId: row.runId,
				type: row.type,
				status: row.status,
				title: row.title,
				inputJson: row.inputJson,
				outputJson: row.outputJson,
				error: row.error,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			})
		: null;
}

export async function listAssistantTasksRecord(
	db: Database,
	userId: string,
	runId: string,
): Promise<AssistantTask[]> {
	const rows = await db
		.select({
			id: assistantTasks.id,
			runId: assistantTasks.runId,
			type: assistantTasks.type,
			status: assistantTasks.status,
			title: assistantTasks.title,
			inputJson: assistantTasks.inputJson,
			outputJson: assistantTasks.outputJson,
			error: assistantTasks.error,
			createdAt: assistantTasks.createdAt,
			updatedAt: assistantTasks.updatedAt,
		})
		.from(assistantTasks)
		.innerJoin(assistantRuns, eq(assistantTasks.runId, assistantRuns.id))
		.where(and(eq(assistantTasks.runId, runId), eq(assistantRuns.userId, userId)))
		.orderBy(asc(assistantTasks.createdAt));

	return rows.map((row) =>
		toAssistantTask({
			id: row.id,
			runId: row.runId,
			type: row.type,
			status: row.status,
			title: row.title,
			inputJson: row.inputJson,
			outputJson: row.outputJson,
			error: row.error,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}),
	);
}

export async function getNextQueuedAssistantTaskRecord(
	db: Database,
	userId: string,
	runId: string,
): Promise<AssistantTask | null> {
	const rows = await db
		.select({
			id: assistantTasks.id,
			runId: assistantTasks.runId,
			type: assistantTasks.type,
			status: assistantTasks.status,
			title: assistantTasks.title,
			inputJson: assistantTasks.inputJson,
			outputJson: assistantTasks.outputJson,
			error: assistantTasks.error,
			createdAt: assistantTasks.createdAt,
			updatedAt: assistantTasks.updatedAt,
		})
		.from(assistantTasks)
		.innerJoin(assistantRuns, eq(assistantTasks.runId, assistantRuns.id))
		.where(
			and(
				eq(assistantTasks.runId, runId),
				eq(assistantTasks.status, 'queued' as AssistantTaskStatus),
				eq(assistantRuns.userId, userId),
			),
		)
		.orderBy(asc(assistantTasks.createdAt))
		.limit(1);

	const row = rows[0];
	return row
		? toAssistantTask({
				id: row.id,
				runId: row.runId,
				type: row.type,
				status: row.status,
				title: row.title,
				inputJson: row.inputJson,
				outputJson: row.outputJson,
				error: row.error,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			})
		: null;
}
