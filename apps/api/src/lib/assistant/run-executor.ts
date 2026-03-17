import {
	parseStoredAssistantAssetContent,
	serializeStoredAssistantAssetContent,
} from '@ai-canvas/shared/schemas';
import type {
	AssistantContextMode,
	AssistantContextSnapshot,
	AssistantMessage,
	AssistantTask,
	GenerationMode,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import * as Sentry from '@sentry/cloudflare';
import type { AppEnv } from '../../types';
import { createDb } from '../db/client';
import { logApiEvent } from '../observability';
import {
	loadAssistantAssetFromR2,
	saveAssistantAssetToR2,
} from '../storage/assistant-asset-storage';
import { generateImageAsset, vectorizeImageAsset } from './media-adapters';
import { planAssistantRun } from './planner';
import { publishAssistantRunEvent } from './runtime-store';
import { generateAssistantResponse } from './service';
import {
	appendAssistantRunEventRecord,
	createAssistantArtifactRecord,
	createAssistantTaskRecord,
	getAssistantRunRecord,
	getNextQueuedAssistantTaskRecord,
	listAssistantArtifactsRecord,
	listAssistantTasksRecord,
	updateAssistantRunRecord,
	updateAssistantTaskRecord,
} from './store';
import {
	buildMarkdownOverlayArtifact,
	buildPlacementPlanArtifact,
	buildResponseArtifacts,
	buildResponseSummary,
	resolveSourceArtifactForTask,
} from './task-execution';

type AssistantDb = ReturnType<typeof createDb>;

export interface ExecuteAssistantRunInput {
	canvasId: string;
	message: string;
	contextMode: AssistantContextMode;
	modeHint?: GenerationMode;
	history?: AssistantMessage[];
	selectedElementIds?: string[];
	contextSnapshot?: AssistantContextSnapshot;
	prototypeContext?: PrototypeOverlayCustomData;
}

function getArtifactTitle(
	type: 'mermaid' | 'd2' | 'kanban-ops' | 'kanban-patch' | 'prototype-files' | 'markdown-patch',
): string {
	switch (type) {
		case 'mermaid':
			return 'Generated Mermaid draft';
		case 'd2':
			return 'Generated D2 draft';
		case 'kanban-ops':
			return 'Generated Kanban operations';
		case 'kanban-patch':
			return 'Generated Kanban patch';
		case 'prototype-files':
			return 'Generated prototype files';
		case 'markdown-patch':
			return 'Generated Markdown patch';
	}
}

async function listArtifactsByTypes(
	db: AssistantDb,
	ownerId: string,
	runId: string,
	types: string[],
) {
	const artifacts = await listAssistantArtifactsRecord(db, ownerId, runId);
	return artifacts.filter((artifact) => types.includes(artifact.type));
}

async function findRunningTaskOrQueuedTask(
	db: AssistantDb,
	ownerId: string,
	runId: string,
): Promise<AssistantTask | null> {
	const tasks = await listAssistantTasksRecord(db, ownerId, runId);
	return (
		tasks.find((task) => task.status === 'running') ??
		tasks.find((task) => task.status === 'queued') ??
		null
	);
}

export async function publishTaskEvent(
	db: AssistantDb,
	ownerId: string,
	task: AssistantTask,
	type: 'task.created' | 'task.started' | 'task.completed' | 'task.failed',
	taskStatus: AssistantTask['status'],
) {
	const event = await appendAssistantRunEventRecord(db, ownerId, task.runId, type, {
		taskId: task.id,
		taskType: task.type,
		taskTitle: task.title,
		taskStatus,
		error: type === 'task.failed' ? task.error : undefined,
	});
	publishAssistantRunEvent(ownerId, task.runId, event);
}

export async function executeAssistantRun(
	db: AssistantDb,
	bindings: AppEnv['Bindings'],
	ownerId: string,
	runId: string,
	input: ExecuteAssistantRunInput,
) {
	return Sentry.startSpan(
		{
			name: 'assistant.execute_run',
			op: 'ai.run',
			attributes: {
				'assistant.run.id': runId,
				'assistant.canvas.id': input.canvasId,
				'assistant.context_mode': input.contextMode,
			},
		},
		async () => {
			Sentry.setTag('assistant.run_id', runId);
			Sentry.setTag('assistant.canvas_id', input.canvasId);
			Sentry.setTag('assistant.context_mode', input.contextMode);

			await updateAssistantRunRecord(db, ownerId, runId, { status: 'running' });
			logApiEvent('info', 'assistant.run.started', {
				runId,
				canvasId: input.canvasId,
				userId: ownerId,
				contextMode: input.contextMode,
			});
			const startedEvent = await appendAssistantRunEventRecord(db, ownerId, runId, 'run.started', {
				status: 'running',
			});
			publishAssistantRunEvent(ownerId, runId, startedEvent);

			try {
				let nextTask = await getNextQueuedAssistantTaskRecord(db, ownerId, runId);

				while (nextTask) {
					const runningTask = await updateAssistantTaskRecord(db, ownerId, nextTask.id, {
						status: 'running',
						error: null,
					});

					if (!runningTask) {
						throw new Error('Assistant task disappeared during execution');
					}

					await publishTaskEvent(db, ownerId, runningTask, 'task.started', 'running');

					if (runningTask.type === 'plan_run') {
						const plan = planAssistantRun({
							message: input.message,
							contextMode: input.contextMode,
							modeHint: input.modeHint,
							history: input.history,
							contextSnapshot: input.contextSnapshot,
							prototypeContext: input.prototypeContext,
							vectorizationEnabled: Boolean(bindings.VECTORIZE_ASSET_URL),
						});

						for (const task of plan.tasks) {
							const queuedTask = await createAssistantTaskRecord(db, ownerId, {
								runId,
								type: task.type,
								title: task.title,
								input: task.input,
							});
							await publishTaskEvent(db, ownerId, queuedTask, 'task.created', 'queued');
						}

						const completedPlanningTask = await updateAssistantTaskRecord(
							db,
							ownerId,
							runningTask.id,
							{
								status: 'completed',
								output: {
									kind: 'plan_run',
									resolvedMode: plan.resolvedMode,
									enqueuedTaskTypes: plan.tasks.map((task) => task.type),
								},
								error: null,
							},
						);
						if (!completedPlanningTask) {
							throw new Error('Failed to complete planning task');
						}
						await publishTaskEvent(
							db,
							ownerId,
							completedPlanningTask,
							'task.completed',
							'completed',
						);
					} else if (runningTask.type === 'generate_image') {
						if (runningTask.input?.kind !== 'generate_image') {
							throw new Error('Image generation task is missing payload');
						}
						const generated = await generateImageAsset(bindings, {
							prompt: runningTask.input.prompt,
							style: runningTask.input.style,
						});
						const storageKey = await saveAssistantAssetToR2(
							bindings.R2,
							runId,
							`${runningTask.id}-${crypto.randomUUID()}`,
							{
								body: generated.bytes,
								mimeType: generated.mimeType,
							},
						);
						const createdArtifact = await createAssistantArtifactRecord(db, ownerId, {
							runId,
							taskId: runningTask.id,
							type: 'image',
							title: runningTask.input.outputTitle,
							content: serializeStoredAssistantAssetContent({
								kind: 'stored_asset',
								r2Key: storageKey,
								mimeType: generated.mimeType,
								provider: generated.provider,
								model: generated.model,
								prompt: generated.prompt,
								revisedPrompt: generated.revisedPrompt,
								byteSize: generated.bytes.byteLength,
							}),
						});
						const completedTask = await updateAssistantTaskRecord(db, ownerId, runningTask.id, {
							status: 'completed',
							output: {
								kind: 'artifact_created',
								artifactIds: [createdArtifact.id],
							},
							error: null,
						});
						if (!completedTask) {
							throw new Error('Failed to complete image generation task');
						}
						await publishTaskEvent(db, ownerId, completedTask, 'task.completed', 'completed');
					} else if (runningTask.type === 'vectorize_asset') {
						if (runningTask.input?.kind !== 'vectorize_asset') {
							throw new Error('Vectorization task is missing payload');
						}
						const taskInput = runningTask.input;
						const [tasks, artifacts] = await Promise.all([
							listAssistantTasksRecord(db, ownerId, runId),
							listAssistantArtifactsRecord(db, ownerId, runId),
						]);
						const sourceImageArtifact = resolveSourceArtifactForTask({
							tasks,
							artifacts,
							currentTaskId: runningTask.id,
							sourceArtifactType: taskInput.sourceArtifactType,
							sourceArtifactId: taskInput.sourceArtifactId,
							sourceTaskType: taskInput.sourceTaskType,
						});
						if (!sourceImageArtifact) {
							throw new Error('Vectorization failed: missing image artifact');
						}
						const sourceImage = parseStoredAssistantAssetContent(sourceImageArtifact.content);
						if (!sourceImage) {
							throw new Error('Vectorization failed: image artifact content is not a stored asset');
						}
						const sourceObject = await loadAssistantAssetFromR2(bindings.R2, sourceImage.r2Key);
						if (!sourceObject) {
							throw new Error('Vectorization failed: source image asset is missing from storage');
						}
						const vectorized = await vectorizeImageAsset(bindings, {
							bytes: await sourceObject.arrayBuffer(),
							mimeType: sourceImage.mimeType,
							prompt: sourceImage.prompt,
						});
						const storageKey = await saveAssistantAssetToR2(
							bindings.R2,
							runId,
							`${runningTask.id}-${crypto.randomUUID()}`,
							{
								body: vectorized.content,
								mimeType: vectorized.mimeType,
							},
						);
						const createdArtifact = await createAssistantArtifactRecord(db, ownerId, {
							runId,
							taskId: runningTask.id,
							type: 'image-vector',
							title: taskInput.outputTitle,
							content: serializeStoredAssistantAssetContent({
								kind: 'stored_asset',
								r2Key: storageKey,
								mimeType: vectorized.mimeType,
								provider: vectorized.provider,
								model: vectorized.model,
								tool: vectorized.tool,
								sourceArtifactId: sourceImageArtifact.id,
							}),
						});
						const completedTask = await updateAssistantTaskRecord(db, ownerId, runningTask.id, {
							status: 'completed',
							output: {
								kind: 'artifact_created',
								artifactIds: [createdArtifact.id],
							},
							error: null,
						});
						if (!completedTask) {
							throw new Error('Failed to complete vectorization task');
						}
						await publishTaskEvent(db, ownerId, completedTask, 'task.completed', 'completed');
					} else if (runningTask.type === 'create_markdown_overlay') {
						if (runningTask.input?.kind !== 'create_markdown_overlay') {
							throw new Error('Markdown overlay task is missing payload');
						}
						const taskInput = runningTask.input;
						const availableArtifacts = await listAssistantArtifactsRecord(db, ownerId, runId);
						const artifact = await buildMarkdownOverlayArtifact({
							message: input.message,
							contextMode: input.contextMode,
							mode: taskInput.resolvedMode,
							artifacts: availableArtifacts.filter((candidate) =>
								taskInput.sourceArtifactTypes.includes(candidate.type),
							),
						});
						const createdArtifact = await createAssistantArtifactRecord(db, ownerId, {
							runId,
							taskId: runningTask.id,
							type: 'markdown',
							title: artifact.title,
							content: artifact.content,
						});
						const completedTask = await updateAssistantTaskRecord(db, ownerId, runningTask.id, {
							status: 'completed',
							output: {
								kind: 'artifact_created',
								artifactIds: [createdArtifact.id],
							},
							error: null,
						});
						if (!completedTask) {
							throw new Error('Failed to complete markdown overlay task');
						}
						await publishTaskEvent(db, ownerId, completedTask, 'task.completed', 'completed');
					} else if (runningTask.type === 'place_canvas_artifact') {
						if (runningTask.input?.kind !== 'place_canvas_artifact') {
							throw new Error('Placement task is missing payload');
						}
						const taskInput = runningTask.input;
						const targetArtifacts = await listArtifactsByTypes(
							db,
							ownerId,
							runId,
							taskInput.targetArtifactTypes,
						);
						if (targetArtifacts.length === 0) {
							throw new Error('Placement planning failed: missing target artifacts');
						}
						const placementPlan = buildPlacementPlanArtifact({
							title: taskInput.title,
							artifacts: targetArtifacts,
						});
						const createdArtifact = await createAssistantArtifactRecord(db, ownerId, {
							runId,
							taskId: runningTask.id,
							type: 'layout-plan',
							title: placementPlan.title,
							content: placementPlan.content,
						});
						const completedTask = await updateAssistantTaskRecord(db, ownerId, runningTask.id, {
							status: 'completed',
							output: {
								kind: 'placement_ready',
								artifactIds: [createdArtifact.id],
								strategy: taskInput.strategy,
							},
							error: null,
						});
						if (!completedTask) {
							throw new Error('Failed to complete placement task');
						}
						await publishTaskEvent(db, ownerId, completedTask, 'task.completed', 'completed');
					} else if (runningTask.type === 'generate_response') {
						if (runningTask.input?.kind !== 'generate_response') {
							throw new Error('Response generation task is missing payload');
						}
						const taskInput = runningTask.input;
						const result = await Sentry.startSpan(
							{
								name: 'assistant.generate_response',
								op: 'ai.generate',
								attributes: {
									'assistant.run.id': runId,
									'assistant.task.id': runningTask.id,
									'assistant.generation_mode': taskInput.resolvedMode,
								},
							},
							() =>
								generateAssistantResponse({
									message: input.message,
									contextMode: input.contextMode,
									generationMode: taskInput.resolvedMode,
									history: input.history,
									contextSnapshot: input.contextSnapshot,
									prototypeContext: input.prototypeContext,
									bindings,
								}),
						);

						for (const artifact of result.message.artifacts ?? []) {
							if (
								artifact.type === 'mermaid' ||
								artifact.type === 'd2' ||
								artifact.type === 'kanban-ops' ||
								artifact.type === 'kanban-patch' ||
								artifact.type === 'prototype-files' ||
								artifact.type === 'markdown-patch'
							) {
								await createAssistantArtifactRecord(db, ownerId, {
									runId,
									taskId: runningTask.id,
									type: artifact.type,
									title: getArtifactTitle(artifact.type),
									content: artifact.content,
								});
							}
						}

						const taskArtifacts = await listAssistantArtifactsRecord(db, ownerId, runId);
						const selectedArtifacts = taskArtifacts.filter((artifact) =>
							taskInput.includeArtifactTypes.includes(artifact.type),
						);
						const nextMessage = {
							...result.message,
							content: [
								buildResponseSummary({
									mode: taskInput.resolvedMode,
									message: input.message,
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

						await updateAssistantRunRecord(db, ownerId, runId, {
							resultMessage: nextMessage,
							error: null,
						});
						const completedTask = await updateAssistantTaskRecord(db, ownerId, runningTask.id, {
							status: 'completed',
							output: {
								kind: 'response_ready',
								messageId: nextMessage.id,
								artifactTypes: (nextMessage.artifacts ?? []).map((artifact) => artifact.type),
							},
							error: null,
						});
						if (!completedTask) {
							throw new Error('Failed to complete response task');
						}
						await publishTaskEvent(db, ownerId, completedTask, 'task.completed', 'completed');
						const messageEvent = await appendAssistantRunEventRecord(
							db,
							ownerId,
							runId,
							'message.created',
							{
								message: nextMessage,
							},
						);
						publishAssistantRunEvent(ownerId, runId, messageEvent);
					} else if (runningTask.type === 'verify_layout') {
						if (runningTask.input?.kind !== 'verify_layout') {
							throw new Error('Layout verification task is missing payload');
						}
						const artifacts = await listArtifactsByTypes(
							db,
							ownerId,
							runId,
							runningTask.input.requiredArtifactTypes,
						);
						const missingTypes = runningTask.input.requiredArtifactTypes.filter(
							(type) => !artifacts.some((artifact) => artifact.type === type),
						);

						if (missingTypes.length > 0) {
							throw new Error(`Layout verification failed: missing ${missingTypes.join(', ')}`);
						}

						const completedTask = await updateAssistantTaskRecord(db, ownerId, runningTask.id, {
							status: 'completed',
							output: {
								kind: 'verification',
								verified: true,
								details: 'Required artifacts are available for canvas placement.',
							},
							error: null,
						});
						if (!completedTask) {
							throw new Error('Failed to complete layout verification task');
						}
						await publishTaskEvent(db, ownerId, completedTask, 'task.completed', 'completed');
					} else if (runningTask.type === 'verify_run') {
						if (runningTask.input?.kind !== 'verify_run') {
							throw new Error('Run verification task is missing payload');
						}
						const currentRun = await getAssistantRunRecord(db, ownerId, runId);
						if (runningTask.input.requireResultMessage && !currentRun?.resultMessage) {
							throw new Error('Run verification failed: missing result message');
						}
						const artifacts = await listAssistantArtifactsRecord(db, ownerId, runId);
						const missingArtifacts = runningTask.input.requiredArtifactTypes.filter(
							(type) => !artifacts.some((artifact) => artifact.type === type),
						);
						if (missingArtifacts.length > 0) {
							throw new Error(`Run verification failed: missing ${missingArtifacts.join(', ')}`);
						}
						const tasks = await listAssistantTasksRecord(db, ownerId, runId);
						const missingTaskTypes = runningTask.input.requiredTaskTypes.filter(
							(type) => !tasks.some((task) => task.type === type && task.status === 'completed'),
						);
						if (missingTaskTypes.length > 0) {
							throw new Error(`Run verification failed: missing ${missingTaskTypes.join(', ')}`);
						}

						const completedTask = await updateAssistantTaskRecord(db, ownerId, runningTask.id, {
							status: 'completed',
							output: {
								kind: 'verification',
								verified: true,
								details: 'Run contains the required result message, tasks, and artifacts.',
							},
							error: null,
						});
						if (!completedTask) {
							throw new Error('Failed to complete verification task');
						}
						await publishTaskEvent(db, ownerId, completedTask, 'task.completed', 'completed');
					}

					nextTask = await getNextQueuedAssistantTaskRecord(db, ownerId, runId);
				}

				logApiEvent('info', 'assistant.run.completed', {
					runId,
					canvasId: input.canvasId,
					userId: ownerId,
				});
				await updateAssistantRunRecord(db, ownerId, runId, {
					status: 'completed',
					error: null,
				});
				const completedEvent = await appendAssistantRunEventRecord(
					db,
					ownerId,
					runId,
					'run.completed',
					{
						status: 'completed',
					},
				);
				publishAssistantRunEvent(ownerId, runId, completedEvent);
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Assistant run failed';
				const failingTask = await findRunningTaskOrQueuedTask(db, ownerId, runId);

				logApiEvent('error', 'assistant.run.failed', {
					runId,
					canvasId: input.canvasId,
					userId: ownerId,
					taskId: failingTask?.id,
					taskType: failingTask?.type,
					message,
				});
				Sentry.captureException(error, {
					tags: {
						assistant_run_id: runId,
						assistant_canvas_id: input.canvasId,
						assistant_task_id: failingTask?.id ?? 'unknown',
					},
					extra: {
						contextMode: input.contextMode,
						messageLength: input.message.length,
						failingTaskType: failingTask?.type,
					},
				});

				if (failingTask) {
					const failedTask = await updateAssistantTaskRecord(db, ownerId, failingTask.id, {
						status: 'failed',
						error: message,
					});
					if (failedTask) {
						await publishTaskEvent(db, ownerId, failedTask, 'task.failed', 'failed');
					}
				}
				await updateAssistantRunRecord(db, ownerId, runId, {
					status: 'failed',
					error: message,
				});
				const failedEvent = await appendAssistantRunEventRecord(db, ownerId, runId, 'run.failed', {
					error: message,
					status: 'failed',
				});
				publishAssistantRunEvent(ownerId, runId, failedEvent);
			}
		},
	);
}
