import * as z from 'zod';

const newLexCommentReplySchema = z.object({
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

const newLexCommentThreadSchema = z.object({
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
