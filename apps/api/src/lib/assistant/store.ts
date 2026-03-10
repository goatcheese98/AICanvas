import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type {
	AssistantArtifact,
	AssistantArtifactRecord,
	AssistantContextSnapshot,
	AssistantMessage,
	AssistantRun,
	AssistantRunEvent,
	AssistantRunEventType,
	AssistantRunRequest,
	AssistantRunStatus,
	AssistantTask,
	AssistantTaskInput,
	AssistantTaskOutput,
	AssistantTaskStatus,
	AssistantTaskType,
	AssistantThread,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import type { Database } from '../db/client';
import {
	assistantArtifacts,
	assistantRunEvents,
	assistantRuns,
	assistantTasks,
	assistantThreads,
	canvases,
} from '../db/schema';

export function summarizeAssistantThreadTitle(content: string): string {
	const normalized = content.trim().replace(/\s+/g, ' ');
	if (!normalized) {
		return 'New chat';
	}

	return normalized.slice(0, 40);
}

function normalizeThreadTitle(title?: string): string {
	const normalized = title?.trim().replace(/\s+/g, ' ');
	return normalized && normalized.length > 0 ? normalized : 'New chat';
}

function parseMessage(value: string | null): AssistantMessage | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantMessage;
	} catch {
		return undefined;
	}
}

function parseMessageHistory(value: string | null): AssistantMessage[] | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantMessage[];
	} catch {
		return undefined;
	}
}

function parsePrototypeContext(value: string | null): PrototypeOverlayCustomData | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as PrototypeOverlayCustomData;
	} catch {
		return undefined;
	}
}

function parseStringArray(value: string | null): string[] | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as string[];
	} catch {
		return undefined;
	}
}

function parseContextSnapshot(value: string | null): AssistantContextSnapshot | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantContextSnapshot;
	} catch {
		return undefined;
	}
}

function parseEventData(value: string | null): AssistantRunEvent['data'] | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantRunEvent['data'];
	} catch {
		return undefined;
	}
}

function parseTaskInput(value: string | null): AssistantTaskInput | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantTaskInput;
	} catch {
		return undefined;
	}
}

function parseTaskOutput(value: string | null): AssistantTaskOutput | undefined {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value) as AssistantTaskOutput;
	} catch {
		return undefined;
	}
}

function toAssistantThread(
	row: typeof assistantThreads.$inferSelect,
	messages: AssistantMessage[],
): AssistantThread {
	return {
		id: row.id,
		canvasId: row.canvasId,
		title: row.title,
		messages,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toAssistantRun(row: typeof assistantRuns.$inferSelect): AssistantRun {
	return {
		id: row.id,
		status: row.status,
		request: {
			threadId: row.threadId ?? '',
			canvasId: row.requestCanvasId ?? '',
			message: row.requestMessage,
			contextMode: row.contextMode,
			modeHint: row.modeHint ?? undefined,
			history: parseMessageHistory(row.requestHistoryJson),
			selectedElementIds: parseStringArray(row.selectedElementIdsJson),
			prototypeContext: parsePrototypeContext(row.prototypeContextJson),
			contextSnapshot: parseContextSnapshot(row.contextSnapshotJson),
		},
		resultMessage: parseMessage(row.resultMessageJson),
		error: row.error ?? undefined,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toUserMessage(run: AssistantRun): AssistantMessage {
	return {
		id: `${run.id}:user`,
		role: 'user',
		content: run.request.message,
		createdAt: run.createdAt,
	};
}

function buildThreadMessages(runs: AssistantRun[]): AssistantMessage[] {
	return runs.flatMap((run) => {
		const messages = [toUserMessage(run)];
		if (run.resultMessage) {
			messages.push(run.resultMessage);
		}
		return messages;
	});
}

function toAssistantRunEvent(row: typeof assistantRunEvents.$inferSelect): AssistantRunEvent {
	return {
		id: row.id,
		runId: row.runId,
		sequence: row.sequence,
		type: row.type,
		data: parseEventData(row.dataJson),
		createdAt: row.createdAt.toISOString(),
	};
}

function toAssistantTask(row: typeof assistantTasks.$inferSelect): AssistantTask {
	return {
		id: row.id,
		runId: row.runId,
		type: row.type,
		status: row.status,
		title: row.title,
		input: parseTaskInput(row.inputJson),
		output: parseTaskOutput(row.outputJson),
		error: row.error ?? undefined,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toAssistantArtifactRecord(
	row: typeof assistantArtifacts.$inferSelect,
): AssistantArtifactRecord {
	return {
		id: row.id,
		runId: row.runId,
		taskId: row.taskId,
		type: row.type,
		title: row.title,
		content: row.content,
		createdAt: row.createdAt.toISOString(),
	};
}

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
		status: 'queued',
		requestMessage: request.message,
		contextMode: request.contextMode,
		modeHint: request.modeHint,
		requestHistoryJson: request.history ? JSON.stringify(request.history) : null,
		selectedElementIdsJson: request.selectedElementIds ? JSON.stringify(request.selectedElementIds) : null,
		prototypeContextJson: request.prototypeContext ? JSON.stringify(request.prototypeContext) : null,
		contextSnapshotJson: request.contextSnapshot ? JSON.stringify(request.contextSnapshot) : null,
		createdAt: now,
		updatedAt: now,
	});

	await db
		.update(assistantThreads)
		.set({
			title:
				thread.title === 'New chat'
					? summarizeAssistantThreadTitle(request.message)
					: undefined,
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
		status: 'queued',
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
				eq(assistantTasks.status, 'queued'),
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
