/**
 * Row-to-object transformers for converting database rows to domain objects.
 */

import type {
	AssistantArtifactRecord,
	AssistantMessage,
	AssistantRun,
	AssistantRunEvent,
	AssistantTask,
	AssistantThread,
} from '@ai-canvas/shared/types';
import {
	assistantArtifacts,
	assistantRunEvents,
	assistantRuns,
	assistantTasks,
	assistantThreads,
} from '../../db/schema';
import {
	parseContextSnapshot,
	parseEventData,
	parseMessage,
	parseMessageHistory,
	parsePrototypeContext,
	parseStringArray,
	parseTaskInput,
	parseTaskOutput,
} from './parsing';

export function summarizeAssistantThreadTitle(content: string): string {
	const normalized = content.trim().replace(/\s+/g, ' ');
	if (!normalized) {
		return 'New chat';
	}

	return normalized.slice(0, 40);
}

export function normalizeThreadTitle(title?: string): string {
	const normalized = title?.trim().replace(/\s+/g, ' ');
	return normalized && normalized.length > 0 ? normalized : 'New chat';
}

export function toAssistantThread(
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

export function toAssistantRun(row: typeof assistantRuns.$inferSelect): AssistantRun {
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

export function toUserMessage(run: AssistantRun): AssistantMessage {
	return {
		id: `${run.id}:user`,
		role: 'user',
		content: run.request.message,
		createdAt: run.createdAt,
	};
}

export function buildThreadMessages(runs: AssistantRun[]): AssistantMessage[] {
	return runs.flatMap((run) => {
		const messages = [toUserMessage(run)];
		if (run.resultMessage) {
			messages.push(run.resultMessage);
		}
		return messages;
	});
}

export function toAssistantRunEvent(row: typeof assistantRunEvents.$inferSelect): AssistantRunEvent {
	return {
		id: row.id,
		runId: row.runId,
		sequence: row.sequence,
		type: row.type,
		data: parseEventData(row.dataJson),
		createdAt: row.createdAt.toISOString(),
	};
}

export function toAssistantTask(row: typeof assistantTasks.$inferSelect): AssistantTask {
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

export function toAssistantArtifactRecord(
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
