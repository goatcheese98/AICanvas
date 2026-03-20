import * as Sentry from '@sentry/cloudflare';
import type { AssistantTask } from '@ai-canvas/shared/types';
import { generateAssistantResponse } from '../service';
import { createAssistantArtifactRecord, listAssistantArtifactsRecord, updateAssistantRunRecord, appendAssistantRunEventRecord } from '../store';
import { buildResponseArtifacts, buildResponseSummary, getArtifactTitle } from '../artifact-builders';
import { publishAssistantRunEvent } from '../runtime-store';
import type { TaskHandlerContext, TaskHandlerResult } from './index';

export async function executeAssistantResponseTask(
	task: AssistantTask,
	ctx: TaskHandlerContext,
): Promise<TaskHandlerResult> {
	if (task.input?.kind !== 'generate_response') {
		throw new Error('Response generation task is missing payload');
	}

	const taskInput = task.input;
	const result = await Sentry.startSpan(
		{
			name: 'assistant.generate_response',
			op: 'ai.generate',
			attributes: {
				'assistant.run.id': ctx.runId,
				'assistant.task.id': task.id,
				'assistant.generation_mode': taskInput.resolvedMode,
			},
		},
		() =>
			generateAssistantResponse({
				message: ctx.message,
				contextMode: ctx.contextMode,
				generationMode: taskInput.resolvedMode,
				history: ctx.history,
				contextSnapshot: ctx.contextSnapshot,
				prototypeContext: ctx.prototypeContext,
				bindings: ctx.bindings,
			}),
	);

	// Create artifacts from the response
	for (const artifact of result.message.artifacts ?? []) {
		if (
			artifact.type === 'mermaid' ||
			artifact.type === 'd2' ||
			artifact.type === 'kanban-ops' ||
			artifact.type === 'kanban-patch' ||
			artifact.type === 'prototype-files' ||
			artifact.type === 'markdown-patch'
		) {
			await createAssistantArtifactRecord(ctx.db, ctx.ownerId, {
				runId: ctx.runId,
				taskId: task.id,
				type: artifact.type,
				title: getArtifactTitle(artifact.type),
				content: artifact.content,
			});
		}
	}

	// Build final response message
	const taskArtifacts = await listAssistantArtifactsRecord(ctx.db, ctx.ownerId, ctx.runId);
	const selectedArtifacts = taskArtifacts.filter((artifact) =>
		taskInput.includeArtifactTypes.includes(artifact.type),
	);

	const nextMessage = {
		...result.message,
		content: [
			buildResponseSummary({
				mode: taskInput.resolvedMode,
				message: ctx.message,
				artifacts: selectedArtifacts,
				summary: taskInput.summary,
			}),
			'',
			result.message.content,
		].join('\n'),
		artifacts: buildResponseArtifacts(
			taskArtifacts,
			taskInput.includeArtifactTypes,
			result.message.artifacts ?? [],
		),
	};

	await updateAssistantRunRecord(ctx.db, ctx.ownerId, ctx.runId, {
		resultMessage: nextMessage,
		error: null,
	});

	// Publish message event
	const messageEvent = await appendAssistantRunEventRecord(
		ctx.db,
		ctx.ownerId,
		ctx.runId,
		'message.created',
		{
			message: nextMessage,
		},
	);
	publishAssistantRunEvent(ctx.ownerId, ctx.runId, messageEvent);

	return {
		output: {
			kind: 'response_ready',
			messageId: nextMessage.id,
			artifactTypes: (nextMessage.artifacts ?? []).map((artifact) => artifact.type),
		},
	};
}
