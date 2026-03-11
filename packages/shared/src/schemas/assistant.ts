import * as z from 'zod';
import { overlaySchemas } from './overlay';

const generationModeSchema = z.enum(['chat', 'mermaid', 'd2', 'image', 'sketch', 'kanban', 'prototype']);
const threadTitleSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.transform((value) => value.replace(/\s+/g, ' '));
const assistantMessageSchema = z.object({
	id: z.string().min(1).max(200),
	role: z.enum(['user', 'assistant']),
	content: z.string().min(1).max(20000),
	generationMode: generationModeSchema.optional(),
	artifacts: z
		.array(
			z.object({
				type: z.enum([
					'mermaid',
					'd2',
					'image',
					'image-vector',
					'kanban-ops',
					'kanban-patch',
					'prototype-files',
					'markdown',
					'markdown-patch',
					'layout-plan',
				]),
				content: z.string(),
			}),
		)
		.optional(),
	createdAt: z.string().min(1).max(100),
});
const assistantContextSnapshotSchema = z.object({
	canvasId: z.string().min(1).max(200),
	totalElementCount: z.number().int().min(0),
	selectedElementIds: z.array(z.string().min(1).max(200)).max(500),
	selectedElementCount: z.number().int().min(0),
	selectedOverlayTypes: z.array(z.string().min(1).max(100)).max(50),
	selectionSummary: z
		.array(
			z.object({
				id: z.string().min(1).max(200),
				elementType: z.string().min(1).max(100),
				overlayType: z.string().min(1).max(100).optional(),
				label: z.string().min(1).max(200).optional(),
			}),
		)
		.max(25),
	selectedContexts: z
		.array(
			z.discriminatedUnion('kind', [
				z.object({
					kind: z.literal('markdown'),
					id: z.string().min(1).max(200),
					priority: z.number().int().min(0).max(100),
					elementType: z.string().min(1).max(100),
					overlayType: z.string().min(1).max(100).optional(),
					label: z.string().min(1).max(200).optional(),
					markdown: overlaySchemas.markdown,
				}),
				z.object({
					kind: z.literal('kanban'),
					id: z.string().min(1).max(200),
					priority: z.number().int().min(0).max(100),
					elementType: z.string().min(1).max(100),
					overlayType: z.string().min(1).max(100).optional(),
					label: z.string().min(1).max(200).optional(),
					kanban: overlaySchemas.kanban,
					kanbanSummary: z.object({
						title: z.string().min(1).max(240),
						columnCount: z.number().int().min(0),
						cardCount: z.number().int().min(0),
						emptyColumnCount: z.number().int().min(0),
						cardsWithDescriptions: z.number().int().min(0),
						overdueCardCount: z.number().int().min(0),
						completedChecklistItemCount: z.number().int().min(0),
						totalChecklistItemCount: z.number().int().min(0),
						priorityCounts: z.object({
							low: z.number().int().min(0),
							medium: z.number().int().min(0),
							high: z.number().int().min(0),
						}),
						labels: z.array(z.string().min(1).max(200)).max(500),
						columns: z.array(
							z.object({
								id: z.string().min(1).max(200),
								title: z.string().min(1).max(240),
								cardCount: z.number().int().min(0),
								cards: z.array(
									z.object({
										id: z.string().min(1).max(200),
										title: z.string().min(1).max(240),
										priority: z.enum(['low', 'medium', 'high']),
										labels: z.array(z.string().min(1).max(200)).max(100),
										hasDescription: z.boolean(),
										dueDate: z.string().min(1).max(100).optional(),
										isOverdue: z.boolean(),
										completedChecklistItemCount: z.number().int().min(0),
										totalChecklistItemCount: z.number().int().min(0),
									}),
								).max(2000),
							}),
						).max(200),
					}),
				}),
				z.object({
					kind: z.literal('web-embed'),
					id: z.string().min(1).max(200),
					priority: z.number().int().min(0).max(100),
					elementType: z.string().min(1).max(100),
					overlayType: z.string().min(1).max(100).optional(),
					label: z.string().min(1).max(200).optional(),
					webEmbed: overlaySchemas.webEmbed,
				}),
				z.object({
					kind: z.literal('prototype'),
					id: z.string().min(1).max(200),
					priority: z.number().int().min(0).max(100),
					elementType: z.string().min(1).max(100),
					overlayType: z.string().min(1).max(100).optional(),
					label: z.string().min(1).max(200).optional(),
					prototype: z.object({
						title: z.string().min(1).max(240),
						template: z.enum(['react', 'vanilla']),
						activeFile: z.string().min(1).max(400).optional(),
						filePaths: z.array(z.string().min(1).max(400)).max(200),
						dependencies: z.array(z.string().min(1).max(200)).max(200),
					}),
				}),
				z.object({
					kind: z.literal('generated-diagram'),
					id: z.string().min(1).max(200),
					priority: z.number().int().min(0).max(100),
					elementType: z.string().min(1).max(100),
					overlayType: z.string().min(1).max(100).optional(),
					label: z.string().min(1).max(200).optional(),
					diagram: z.object({
						language: z.enum(['mermaid', 'd2']),
						code: z.string().min(1),
					}),
				}),
				z.object({
					kind: z.literal('generic'),
					id: z.string().min(1).max(200),
					priority: z.number().int().min(0).max(100),
					elementType: z.string().min(1).max(100),
					overlayType: z.string().min(1).max(100).optional(),
					label: z.string().min(1).max(200).optional(),
				}),
			]),
		)
		.max(50),
});

export const sendMessageSchema = z.object({
	message: z.string().min(1).max(10000),
	contextMode: z.enum(['all', 'selected', 'none']).default('none'),
	generationMode: generationModeSchema.default('chat'),
	history: z.array(assistantMessageSchema).max(24).optional(),
	prototypeContext: overlaySchemas.prototype.optional(),
});

export const createRunSchema = z.object({
	threadId: z.string().min(1).max(200),
	canvasId: z.string().min(1).max(200),
	message: z.string().min(1).max(10000),
	contextMode: z.enum(['all', 'selected', 'none']).default('none'),
	modeHint: generationModeSchema.optional(),
	history: z.array(assistantMessageSchema).max(24).optional(),
	selectedElementIds: z.array(z.string().min(1).max(200)).max(500).optional(),
	prototypeContext: overlaySchemas.prototype.optional(),
	contextSnapshot: assistantContextSnapshotSchema.optional(),
});

export const listThreadsSchema = z.object({
	canvasId: z.string().min(1).max(200),
});

export const createThreadSchema = z.object({
	canvasId: z.string().min(1).max(200),
	title: threadTitleSchema.optional(),
});

export const threadIdSchema = z.object({
	threadId: z.string().min(1).max(200),
});

export const assistantSchemas = {
	sendMessage: sendMessageSchema,
	createRun: createRunSchema,
	listThreads: listThreadsSchema,
	createThread: createThreadSchema,
	threadId: threadIdSchema,
} as const;

export type SendMessage = z.infer<typeof sendMessageSchema>;
export type CreateRun = z.infer<typeof createRunSchema>;
export type ListThreads = z.infer<typeof listThreadsSchema>;
export type CreateThread = z.infer<typeof createThreadSchema>;
