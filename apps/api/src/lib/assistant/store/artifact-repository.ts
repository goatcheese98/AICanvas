/**
 * Artifact CRUD operations for the assistant store.
 */

import type { AssistantArtifact, AssistantArtifactRecord } from '@ai-canvas/shared/types';
import { and, asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../../db/client';
import { assistantArtifacts, assistantRuns, assistantTasks } from '../../db/schema';
import { toAssistantArtifactRecord } from './transforms';

export async function createAssistantArtifactRecord(
	db: Database,
	userId: string,
	input: {
		runId: string;
		taskId: string;
		type: AssistantArtifact['type'];
		title: string;
		content: string;
	},
): Promise<AssistantArtifactRecord> {
	const rows = await db
		.select({
			runId: assistantRuns.id,
			taskId: assistantTasks.id,
		})
		.from(assistantTasks)
		.innerJoin(assistantRuns, eq(assistantTasks.runId, assistantRuns.id))
		.where(
			and(
				eq(assistantRuns.id, input.runId),
				eq(assistantTasks.id, input.taskId),
				eq(assistantRuns.userId, userId),
			),
		)
		.limit(1);

	if (!rows[0]) {
		throw new Error('Assistant task not found for artifact creation');
	}

	const createdAt = new Date();
	const id = nanoid();
	await db.insert(assistantArtifacts).values({
		id,
		runId: input.runId,
		taskId: input.taskId,
		type: input.type,
		title: input.title,
		content: input.content,
		createdAt,
	});

	return {
		id,
		runId: input.runId,
		taskId: input.taskId,
		type: input.type,
		title: input.title,
		content: input.content,
		createdAt: createdAt.toISOString(),
	};
}

export async function listAssistantArtifactsRecord(
	db: Database,
	userId: string,
	runId: string,
): Promise<AssistantArtifactRecord[]> {
	const rows = await db
		.select({
			id: assistantArtifacts.id,
			runId: assistantArtifacts.runId,
			taskId: assistantArtifacts.taskId,
			type: assistantArtifacts.type,
			title: assistantArtifacts.title,
			content: assistantArtifacts.content,
			createdAt: assistantArtifacts.createdAt,
		})
		.from(assistantArtifacts)
		.innerJoin(assistantRuns, eq(assistantArtifacts.runId, assistantRuns.id))
		.where(and(eq(assistantArtifacts.runId, runId), eq(assistantRuns.userId, userId)))
		.orderBy(asc(assistantArtifacts.createdAt));

	return rows.map((row) =>
		toAssistantArtifactRecord({
			id: row.id,
			runId: row.runId,
			taskId: row.taskId,
			type: row.type,
			title: row.title,
			content: row.content,
			createdAt: row.createdAt,
		}),
	);
}

export async function listAssistantArtifactsByTaskRecord(
	db: Database,
	userId: string,
	taskId: string,
): Promise<AssistantArtifactRecord[]> {
	const rows = await db
		.select({
			id: assistantArtifacts.id,
			runId: assistantArtifacts.runId,
			taskId: assistantArtifacts.taskId,
			type: assistantArtifacts.type,
			title: assistantArtifacts.title,
			content: assistantArtifacts.content,
			createdAt: assistantArtifacts.createdAt,
		})
		.from(assistantArtifacts)
		.innerJoin(assistantRuns, eq(assistantArtifacts.runId, assistantRuns.id))
		.where(and(eq(assistantArtifacts.taskId, taskId), eq(assistantRuns.userId, userId)))
		.orderBy(asc(assistantArtifacts.createdAt));

	return rows.map((row) =>
		toAssistantArtifactRecord({
			id: row.id,
			runId: row.runId,
			taskId: row.taskId,
			type: row.type,
			title: row.title,
			content: row.content,
			createdAt: row.createdAt,
		}),
	);
}
