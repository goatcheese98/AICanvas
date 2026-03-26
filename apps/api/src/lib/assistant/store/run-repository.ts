/**
 * Run CRUD operations for the assistant store.
 */

import type {
	AssistantMessage,
	AssistantRun,
	AssistantRunEvent,
	AssistantRunEventType,
	AssistantRunRequest,
	AssistantRunStatus,
} from '@ai-canvas/shared/types';
import { and, asc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../../db/client';
import { assistantRunEvents, assistantRuns, assistantThreads } from '../../db/schema';
import { updateAssistantThreadRecord } from './thread-repository';
import { summarizeAssistantThreadTitle } from './transforms';
import { toAssistantRun, toAssistantRunEvent } from './transforms';

export async function createAssistantRunRecord(
	db: Database,
	userId: string,
	request: AssistantRunRequest,
): Promise<AssistantRun> {
	const thread = await db.query.assistantThreads.findFirst({
		where: and(eq(assistantThreads.id, request.threadId), eq(assistantThreads.userId, userId)),
	});

	if (!thread) {
		throw new Error('Assistant thread not found');
	}
	if (thread.canvasId !== request.canvasId) {
		throw new Error('Assistant thread does not belong to canvas');
	}

	const now = new Date();
	const id = nanoid();

	await db.insert(assistantRuns).values({
		id,
		userId,
		threadId: request.threadId,
		requestCanvasId: request.canvasId,
		status: 'queued' as AssistantRunStatus,
		requestMessage: request.message,
		contextMode: request.contextMode,
		modeHint: request.modeHint,
		requestHistoryJson: request.history ? JSON.stringify(request.history) : null,
		selectedElementIdsJson: request.selectedElementIds
			? JSON.stringify(request.selectedElementIds)
			: null,
		prototypeContextJson: request.prototypeContext
			? JSON.stringify(request.prototypeContext)
			: null,
		contextSnapshotJson: request.contextSnapshot ? JSON.stringify(request.contextSnapshot) : null,
		createdAt: now,
		updatedAt: now,
	});

	await db
		.update(assistantThreads)
		.set({
			title:
				thread.title === 'New chat' ? summarizeAssistantThreadTitle(request.message) : undefined,
			updatedAt: now,
		})
		.where(and(eq(assistantThreads.id, request.threadId), eq(assistantThreads.userId, userId)));

	const [created] = await db
		.select()
		.from(assistantRuns)
		.where(and(eq(assistantRuns.id, id), eq(assistantRuns.userId, userId)))
		.limit(1);

	if (!created) {
		throw new Error('Failed to create assistant run');
	}

	return toAssistantRun(created);
}

export async function listAssistantRunsByThreadRecord(
	db: Database,
	userId: string,
	threadId: string,
): Promise<AssistantRun[]> {
	const rows = await db
		.select()
		.from(assistantRuns)
		.where(and(eq(assistantRuns.userId, userId), eq(assistantRuns.threadId, threadId)))
		.orderBy(asc(assistantRuns.createdAt));

	return rows.map((row) => toAssistantRun(row));
}

export async function getAssistantRunRecord(
	db: Database,
	userId: string,
	runId: string,
): Promise<AssistantRun | null> {
	const row = await db.query.assistantRuns.findFirst({
		where: and(eq(assistantRuns.id, runId), eq(assistantRuns.userId, userId)),
	});

	return row ? toAssistantRun(row) : null;
}

export async function updateAssistantRunRecord(
	db: Database,
	userId: string,
	runId: string,
	patch: {
		status?: AssistantRunStatus;
		resultMessage?: AssistantMessage;
		error?: string | null;
	},
): Promise<AssistantRun | null> {
	await db
		.update(assistantRuns)
		.set({
			status: patch.status,
			resultMessageJson: patch.resultMessage ? JSON.stringify(patch.resultMessage) : undefined,
			error: patch.error,
			updatedAt: new Date(),
		})
		.where(and(eq(assistantRuns.id, runId), eq(assistantRuns.userId, userId)));

	const run = await getAssistantRunRecord(db, userId, runId);
	if (run?.request.threadId) {
		await updateAssistantThreadRecord(db, userId, run.request.threadId, {
			touchUpdatedAt: true,
		});
	}

	return run;
}

export async function listAssistantRunEventsRecord(
	db: Database,
	userId: string,
	runId: string,
): Promise<AssistantRunEvent[]> {
	const rows = await db
		.select({
			id: assistantRunEvents.id,
			runId: assistantRunEvents.runId,
			sequence: assistantRunEvents.sequence,
			type: assistantRunEvents.type,
			dataJson: assistantRunEvents.dataJson,
			createdAt: assistantRunEvents.createdAt,
		})
		.from(assistantRunEvents)
		.innerJoin(assistantRuns, eq(assistantRunEvents.runId, assistantRuns.id))
		.where(and(eq(assistantRunEvents.runId, runId), eq(assistantRuns.userId, userId)))
		.orderBy(asc(assistantRunEvents.sequence));

	return rows.map((row) =>
		toAssistantRunEvent({
			id: row.id,
			runId: row.runId,
			sequence: row.sequence,
			type: row.type,
			dataJson: row.dataJson,
			createdAt: row.createdAt,
		}),
	);
}

export async function appendAssistantRunEventRecord(
	db: Database,
	userId: string,
	runId: string,
	type: AssistantRunEventType,
	data?: AssistantRunEvent['data'],
): Promise<AssistantRunEvent> {
	const run = await db.query.assistantRuns.findFirst({
		where: and(eq(assistantRuns.id, runId), eq(assistantRuns.userId, userId)),
	});

	if (!run) {
		throw new Error('Assistant run not found');
	}

	const sequenceResult = await db
		.select({
			nextSequence: sql<number>`coalesce(max(${assistantRunEvents.sequence}), 0) + 1`,
		})
		.from(assistantRunEvents)
		.where(eq(assistantRunEvents.runId, runId));

	const nextSequence = sequenceResult[0]?.nextSequence ?? 1;
	const createdAt = new Date();
	const id = nanoid();

	await db.insert(assistantRunEvents).values({
		id,
		runId,
		sequence: nextSequence,
		type,
		dataJson: data ? JSON.stringify(data) : null,
		createdAt,
	});

	return {
		id,
		runId,
		sequence: nextSequence,
		type,
		data,
		createdAt: createdAt.toISOString(),
	};
}
