import { z } from 'zod';
import { OVERLAY_TYPES } from '../constants';
import type { OverlayCustomData } from '../types';

export const DEFAULT_MARKDOWN_NOTE_SETTINGS = {
	font: 'Nunito, "Segoe UI Emoji", sans-serif',
	fontSize: 15,
	background: '#fffefc',
	lineHeight: 1.65,
	showEmptyLines: true,
	autoHideToolbar: false,
} as const;

export const markdownEditorModeSchema = z.enum(['raw', 'hybrid']);

export const markdownNoteSettingsSchema = z.object({
	font: z.string().trim().min(1).max(160).default(DEFAULT_MARKDOWN_NOTE_SETTINGS.font),
	fontSize: z
		.coerce
		.number()
		.transform((value) => Math.min(28, Math.max(12, value)))
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.fontSize),
	background: z
		.string()
		.trim()
		.min(1)
		.max(32)
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.background),
	lineHeight: z
		.coerce
		.number()
		.transform((value) => Math.min(2.2, Math.max(1.2, value)))
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.lineHeight),
	showEmptyLines: z.coerce.boolean().default(DEFAULT_MARKDOWN_NOTE_SETTINGS.showEmptyLines),
	autoHideToolbar: z.coerce.boolean().default(DEFAULT_MARKDOWN_NOTE_SETTINGS.autoHideToolbar),
});

export const markdownOverlaySchema = z.object({
	type: z.literal('markdown'),
	title: z.string().trim().min(1).max(8).default('Markdown'),
	content: z.string().default(''),
	images: z.record(z.string(), z.string()).optional(),
	settings: markdownNoteSettingsSchema.optional(),
	editorMode: markdownEditorModeSchema.optional(),
});

export const newLexCommentReplySchema = z.object({
	id: z.string().trim().min(1).default(() => crypto.randomUUID()),
	author: z.string().trim().min(1).default('You'),
	message: z.string().default(''),
	createdAt: z.coerce.number().default(() => Date.now()),
	deleted: z.boolean().optional(),
});

export const newLexCommentThreadSchema = z.object({
	id: z.string().trim().min(1).default(() => crypto.randomUUID()),
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
	lexicalState: z.string().default(''),
	comments: z.array(newLexCommentThreadSchema).optional(),
	commentsPanelOpen: z.boolean().optional(),
	version: z.coerce.number().default(1),
});

export const kanbanChecklistItemSchema = z.object({
	text: z.string().default(''),
	done: z.boolean().default(false),
});

export const kanbanCardSchema = z.object({
	id: z.string().trim().min(1).default(() => crypto.randomUUID()),
	title: z.string().trim().min(1).default('Untitled card'),
	description: z.string().default(''),
	priority: z.enum(['low', 'medium', 'high']).default('medium'),
	labels: z.array(z.string()).default([]),
	dueDate: z.string().optional(),
	checklist: z.array(kanbanChecklistItemSchema).default([]),
});

export const kanbanColumnSchema = z.object({
	id: z.string().trim().min(1).default(() => crypto.randomUUID()),
	title: z.string().trim().min(1).default('Column'),
	color: z.string().optional(),
	wipLimit: z.coerce.number().optional(),
	cards: z.array(kanbanCardSchema).default([]),
});

export const kanbanOverlaySchema = z.object({
	type: z.literal('kanban'),
	title: z.string().trim().min(1).default('Kanban Board'),
	columns: z.array(kanbanColumnSchema).default([]),
	theme: z.enum(['sketch', 'clean']).optional(),
	bgTheme: z.string().default('parchment'),
	fontId: z.string().default('excalifont'),
	fontSize: z.coerce.number().default(13),
});

export const webEmbedOverlaySchema = z.object({
	type: z.literal('web-embed'),
	url: z.string().default(''),
});

export const overlayCustomDataSchema = z.discriminatedUnion('type', [
	markdownOverlaySchema,
	newLexOverlaySchema,
	kanbanOverlaySchema,
	webEmbedOverlaySchema,
]);

export function normalizeMarkdownSettings(
	settings?: Partial<z.input<typeof markdownNoteSettingsSchema>> | null,
) {
	return markdownNoteSettingsSchema.parse(settings ?? {});
}

export function normalizeMarkdownOverlay(
	input?: Partial<z.input<typeof markdownOverlaySchema>> | null,
) {
	const parsed = markdownOverlaySchema.parse({
		type: 'markdown',
		...(input ?? {}),
	});

	return {
		...parsed,
		settings: normalizeMarkdownSettings(parsed.settings),
		editorMode: parsed.editorMode ?? 'raw',
	};
}

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

export function normalizeKanbanOverlay(
	input?: Partial<z.input<typeof kanbanOverlaySchema>> | null,
) {
	const parsed = kanbanOverlaySchema.parse({
		type: 'kanban',
		...(input ?? {}),
	});

	return {
		...parsed,
		columns:
			parsed.columns.length > 0
				? parsed.columns
				: [
						{ id: crypto.randomUUID(), title: 'To Do', cards: [] },
						{ id: crypto.randomUUID(), title: 'In Progress', cards: [] },
						{ id: crypto.randomUUID(), title: 'Done', cards: [] },
					],
	};
}

export function normalizeWebEmbedOverlay(
	input?: Partial<z.input<typeof webEmbedOverlaySchema>> | null,
) {
	return webEmbedOverlaySchema.parse({
		type: 'web-embed',
		...(input ?? {}),
	});
}

export function normalizeOverlayCustomData(
	input?: Partial<OverlayCustomData> | Record<string, unknown> | null,
): OverlayCustomData {
	const type = input?.type;
	if (type === 'markdown') return normalizeMarkdownOverlay(input);
	if (type === 'newlex') return normalizeNewLexOverlay(input);
	if (type === 'kanban') return normalizeKanbanOverlay(input);
	if (type === 'web-embed') return normalizeWebEmbedOverlay(input);
	return normalizeMarkdownOverlay();
}

export function isOverlayCustomData(value: unknown): value is OverlayCustomData {
	if (!value || typeof value !== 'object') return false;
	const type = (value as { type?: unknown }).type;
	return typeof type === 'string' && (OVERLAY_TYPES as readonly string[]).includes(type);
}

export const overlaySchemas = {
	markdown: markdownOverlaySchema,
	markdownSettings: markdownNoteSettingsSchema,
	markdownEditorMode: markdownEditorModeSchema,
	newLex: newLexOverlaySchema,
	kanban: kanbanOverlaySchema,
	webEmbed: webEmbedOverlaySchema,
	customData: overlayCustomDataSchema,
} as const;

export type MarkdownNoteSettingsInput = z.input<typeof markdownNoteSettingsSchema>;
export type MarkdownOverlayInput = z.input<typeof markdownOverlaySchema>;
