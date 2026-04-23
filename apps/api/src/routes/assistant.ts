import { assistantSchemas, parseStoredAssistantAssetContent } from '@ai-canvas/shared/schemas';
import type { AssistantContextSnapshot } from '@ai-canvas/shared/types';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { buildAssistantContextSnapshot } from '../lib/assistant/context';
import { executeAssistantRun } from '../lib/assistant/run-executor';
import { publishAssistantRunEvent } from '../lib/assistant/runtime-store';
import { generateAssistantResponse } from '../lib/assistant/service';
import {
	appendAssistantRunEventRecord,
	createAssistantRunRecord,
	createAssistantTaskRecord,
	createAssistantThreadRecord,
	deleteAssistantThreadRecord,
	getAssistantRunRecord,
	getAssistantThreadRecord,
	listAssistantArtifactsRecord,
	listAssistantRunEventsRecord,
	listAssistantTasksRecord,
	listAssistantThreadsRecord,
} from '../lib/assistant/store';
import { publishTaskEvent } from '../lib/assistant/task-events';
import { createDb } from '../lib/db/client';
import { canvases } from '../lib/db/schema';
import { logApiEvent } from '../lib/observability';
import { loadAssistantAssetFromR2 } from '../lib/storage/assistant-asset-storage';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

function serializeSseEvent(event: unknown, eventName?: string): string {
	const parts: string[] = [];
	if (eventName) parts.push(`event: ${eventName}`);
	parts.push(`data: ${JSON.stringify(event)}`);
	return `${parts.join('\n')}\n\n`;
}

function isTerminalAssistantRunStatus(status: string): boolean {
	return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export const assistantRoutes = new Hono<AppEnv>()
	.use(requireAuth)

	.get('/capabilities', async (c) => {
		return c.json({
			vectorizationEnabled: Boolean(c.env.VECTORIZE_ASSET_URL),
			svgGenerationEnabled: Boolean(c.env.ANTHROPIC_API_KEY),
		});
	})

	.get('/threads', zValidator('query', assistantSchemas.listThreads), async (c) => {
		const ownerId = c.get('user').id;
		const { canvasId } = c.req.valid('query');
		const db = createDb(c.env.DB);
		const threads = await listAssistantThreadsRecord(db, ownerId, canvasId);
		return c.json(threads);
	})

	.post('/threads', zValidator('json', assistantSchemas.createThread), async (c) => {
		const ownerId = c.get('user').id;
		const { canvasId, title } = c.req.valid('json');
		const db = createDb(c.env.DB);

		try {
			const thread = await createAssistantThreadRecord(db, ownerId, { canvasId, title });
			logApiEvent('info', 'assistant.thread.created', {
				userId: ownerId,
				canvasId,
				threadId: thread.id,
			});
			return c.json(thread, 201);
		} catch (error) {
			if (error instanceof Error && error.message === 'Canvas not found') {
				return c.json({ error: 'Canvas not found' }, 404);
			}
			logApiEvent('error', 'assistant.thread_create_failed', {
				userId: ownerId,
				canvasId,
				message: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	})

	.get('/threads/:threadId', zValidator('param', assistantSchemas.threadId), async (c) => {
		const ownerId = c.get('user').id;
		const { threadId } = c.req.valid('param');
		const db = createDb(c.env.DB);
		const thread = await getAssistantThreadRecord(db, ownerId, threadId);

		if (!thread) {
			return c.json({ error: 'Thread not found' }, 404);
		}

		return c.json(thread);
	})

	.delete('/threads/:threadId', zValidator('param', assistantSchemas.threadId), async (c) => {
		const ownerId = c.get('user').id;
		const { threadId } = c.req.valid('param');
		const db = createDb(c.env.DB);
		const deleted = await deleteAssistantThreadRecord(db, ownerId, threadId);

		if (!deleted) {
			return c.json({ error: 'Thread not found' }, 404);
		}

		return c.json({ ok: true });
	})

	// Legacy synchronous endpoint kept during the run-based migration.
	.post('/chat', zValidator('json', assistantSchemas.sendMessage), async (c) => {
		const { message, contextMode, generationMode, history, prototypeContext } = c.req.valid('json');
		const result = await generateAssistantResponse({
			message,
			contextMode,
			generationMode,
			history,
			prototypeContext,
			bindings: c.env,
		});

		return c.json(result.message);
	})

	.post('/runs', zValidator('json', assistantSchemas.createRun), async (c) => {
		const ownerId = c.get('user').id;
		const {
			threadId,
			canvasId,
			message,
			contextMode,
			modeHint,
			history,
			selectedElementIds,
			prototypeContext,
		} = c.req.valid('json');
		const db = createDb(c.env.DB);
		let contextSnapshot: AssistantContextSnapshot | undefined;
		if (contextMode !== 'none') {
			const canvas = await db.query.canvases.findFirst({
				columns: {
					id: true,
					title: true,
					description: true,
				},
				where: and(eq(canvases.id, canvasId), eq(canvases.userId, ownerId)),
			});
			if (!canvas) {
				return c.json({ error: 'Canvas not found' }, 404);
			}
			try {
				contextSnapshot = await buildAssistantContextSnapshot(c.env, ownerId, {
					canvasId,
					contextMode,
					selectedElementIds: selectedElementIds ?? [],
					canvasMeta: {
						title: canvas.title,
						description: canvas.description ?? undefined,
					},
				});
			} catch (error) {
				if (error instanceof Error && error.message === 'Canvas context not found') {
					return c.json({ error: 'Canvas not found' }, 404);
				}
				logApiEvent('error', 'assistant.context_snapshot_failed', {
					userId: ownerId,
					canvasId,
					contextMode,
					message: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		}
		let run: Awaited<ReturnType<typeof createAssistantRunRecord>>;
		try {
			run = await createAssistantRunRecord(db, ownerId, {
				threadId,
				canvasId,
				message,
				contextMode,
				modeHint,
				history,
				selectedElementIds,
				prototypeContext,
				contextSnapshot,
			});
		} catch (error) {
			if (error instanceof Error && error.message === 'Assistant thread not found') {
				return c.json({ error: 'Thread not found' }, 404);
			}
			if (
				error instanceof Error &&
				error.message === 'Assistant thread does not belong to canvas'
			) {
				return c.json({ error: 'Thread does not belong to canvas' }, 409);
			}
			logApiEvent('error', 'assistant.run_create_failed', {
				userId: ownerId,
				canvasId,
				threadId,
				message: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
		const planningTask = await createAssistantTaskRecord(db, ownerId, {
			runId: run.id,
			type: 'plan_run',
			title: 'Plan assistant run',
			input: {
				kind: 'plan_run',
				request: {
					threadId,
					canvasId,
					message,
					contextMode,
					modeHint,
					history,
					selectedElementIds,
					prototypeContext,
					contextSnapshot,
				},
			},
		});
		const createdEvent = await appendAssistantRunEventRecord(db, ownerId, run.id, 'run.created', {
			status: run.status,
		});
		publishAssistantRunEvent(ownerId, run.id, createdEvent);
		await publishTaskEvent(db, ownerId, planningTask, 'task.created', 'queued');

		c.executionCtx.waitUntil(
			executeAssistantRun(db, c.env, ownerId, run.id, {
				canvasId,
				message,
				contextMode,
				modeHint,
				history,
				selectedElementIds,
				contextSnapshot,
				prototypeContext,
			}),
		);
		logApiEvent('info', 'assistant.run.queued', {
			userId: ownerId,
			canvasId,
			threadId,
			runId: run.id,
		});
		return c.json(
			{
				runId: run.id,
				status: run.status,
			},
			202,
		);
	})

	.get('/runs/:runId', async (c) => {
		const ownerId = c.get('user').id;
		const db = createDb(c.env.DB);
		const run = await getAssistantRunRecord(db, ownerId, c.req.param('runId'));

		if (!run) {
			return c.json({ error: 'Run not found' }, 404);
		}

		return c.json(run);
	})

	.get('/runs/:runId/tasks', async (c) => {
		const ownerId = c.get('user').id;
		const runId = c.req.param('runId');
		const db = createDb(c.env.DB);
		const run = await getAssistantRunRecord(db, ownerId, runId);

		if (!run) {
			return c.json({ error: 'Run not found' }, 404);
		}

		const tasks = await listAssistantTasksRecord(db, ownerId, runId);
		return c.json(tasks);
	})

	.get('/runs/:runId/artifacts', async (c) => {
		const ownerId = c.get('user').id;
		const runId = c.req.param('runId');
		const db = createDb(c.env.DB);
		const run = await getAssistantRunRecord(db, ownerId, runId);

		if (!run) {
			return c.json({ error: 'Run not found' }, 404);
		}

		const artifacts = await listAssistantArtifactsRecord(db, ownerId, runId);
		return c.json(artifacts);
	})

	.get('/runs/:runId/artifacts/:artifactId/asset', async (c) => {
		const ownerId = c.get('user').id;
		const runId = c.req.param('runId');
		const artifactId = c.req.param('artifactId');
		const db = createDb(c.env.DB);
		const run = await getAssistantRunRecord(db, ownerId, runId);

		if (!run) {
			return c.json({ error: 'Run not found' }, 404);
		}

		const artifact = (await listAssistantArtifactsRecord(db, ownerId, runId)).find(
			(candidate) => candidate.id === artifactId,
		);
		if (!artifact) {
			return c.json({ error: 'Artifact not found' }, 404);
		}

		const storedAsset = parseStoredAssistantAssetContent(artifact.content);
		if (!storedAsset) {
			return c.json({ error: 'Artifact has no stored asset' }, 400);
		}

		const object = await loadAssistantAssetFromR2(c.env.R2, storedAsset.r2Key);
		if (!object) {
			return c.json({ error: 'Stored asset not found' }, 404);
		}

		return new Response(object.body, {
			headers: {
				'Content-Type': storedAsset.mimeType,
				'Cache-Control': 'private, max-age=3600',
			},
		});
	})

	.get('/runs/:runId/events', async (c) => {
		const ownerId = c.get('user').id;
		const runId = c.req.param('runId');
		const db = createDb(c.env.DB);
		const run = await getAssistantRunRecord(db, ownerId, runId);

		if (!run) {
			return c.json({ error: 'Run not found' }, 404);
		}

		const encoder = new TextEncoder();
		let closed = false;
		let pollInterval: ReturnType<typeof setInterval> | undefined;
		let lastSeenSequence = 0;

		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				const writeChunk = (chunk: string) => {
					if (closed) return;
					controller.enqueue(encoder.encode(chunk));
				};

				const closeStream = () => {
					if (closed) return;
					closed = true;
					if (pollInterval) clearInterval(pollInterval);
					controller.close();
				};

				writeChunk(': connected\n\n');

				// Replay all existing events
				for (const event of await listAssistantRunEventsRecord(db, ownerId, runId)) {
					writeChunk(serializeSseEvent(event, event.type));
					lastSeenSequence = Math.max(lastSeenSequence, event.sequence);
				}

				const current = await getAssistantRunRecord(db, ownerId, runId);
				if (!current || isTerminalAssistantRunStatus(current.status)) {
					closeStream();
					return;
				}

				// Poll DB for new events every 500ms - avoids race conditions with in-memory pub/sub
				pollInterval = setInterval(async () => {
					if (closed) return;
					const allEvents = await listAssistantRunEventsRecord(db, ownerId, runId);
					for (const event of allEvents) {
						if (event.sequence > lastSeenSequence) {
							writeChunk(serializeSseEvent(event, event.type));
							lastSeenSequence = event.sequence;
						}
					}
					const polledRun = await getAssistantRunRecord(db, ownerId, runId);
					if (!polledRun || isTerminalAssistantRunStatus(polledRun.status)) {
						closeStream();
					}
				}, 500);
			},
			cancel() {
				closed = true;
				if (pollInterval) clearInterval(pollInterval);
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache, no-transform',
				Connection: 'keep-alive',
			},
		});
	});
