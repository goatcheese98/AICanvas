import * as z from 'zod';

const resourceSnapshotSchema = z.object({
	resourceType: z.enum(['board', 'document', 'prototype']),
	resourceId: z.string().min(1),
	title: z.string().trim().min(1).max(120),
	snapshotVersion: z.coerce.number().int().min(1),
	display: z
		.object({
			subtitle: z.string().trim().min(1).max(120).optional(),
			summary: z.string().trim().min(1).max(240).optional(),
			badge: z.string().trim().min(1).max(32).optional(),
		})
		.default({}),
});

export const newLexCommentReplySchema = z.object({
	id: z
		.string()
		.trim()
		.min(1)
		.default(() => crypto.randomUUID()),
	author: z.string().trim().min(1).default('You'),
	message: z.string().default(''),
	createdAt: z.coerce.number().default(() => Date.now()),
	deleted: z.boolean().optional(),
});

export const newLexCommentThreadSchema = z.object({
	id: z
		.string()
		.trim()
		.min(1)
		.default(() => crypto.randomUUID()),
	author: z.string().trim().min(1).default('You'),
	comment: z.string().default(''),
	commentDeleted: z.boolean().optional(),
	anchorText: z.string().default(''),
	createdAt: z.coerce.number().default(() => Date.now()),
	resolved: z.boolean().default(false),
	collapsed: z.boolean().default(false),
	replies: z.array(newLexCommentReplySchema).default([]),
});

export const newLexOverlaySchema = z.object({
	type: z.literal('newlex'),
	title: z.string().trim().min(1).max(32).default('Rich Text'),
	lexicalState: z.string().default(''),
	comments: z.array(newLexCommentThreadSchema).optional(),
	commentsPanelOpen: z.boolean().optional(),
	version: z.coerce.number().default(1),
	resourceSnapshot: resourceSnapshotSchema.optional(),
});

export function normalizeNewLexOverlay(
	input?: Partial<z.input<typeof newLexOverlaySchema>> | null,
) {
	const parsed = newLexOverlaySchema.parse({
		type: 'newlex',
		...(input ?? {}),
	});

	return {
		...parsed,
		comments: parsed.comments ?? [],
		commentsPanelOpen: parsed.commentsPanelOpen ?? false,
	};
}
