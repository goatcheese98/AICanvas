import { z } from 'zod';

export const DEFAULT_MARKDOWN_NOTE_SETTINGS = {
	font: 'Excalifont, Xiaolai, "Segoe UI Emoji", sans-serif',
	fontSize: 15,
	background: '#fffefc',
	lineHeight: 1.65,
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
});

export const markdownOverlaySchema = z.object({
	type: z.literal('markdown'),
	content: z.string().default(''),
	images: z.record(z.string(), z.string()).optional(),
	settings: markdownNoteSettingsSchema.optional(),
	editorMode: markdownEditorModeSchema.optional(),
});

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

export const overlaySchemas = {
	markdown: markdownOverlaySchema,
	markdownSettings: markdownNoteSettingsSchema,
	markdownEditorMode: markdownEditorModeSchema,
} as const;

export type MarkdownNoteSettingsInput = z.input<typeof markdownNoteSettingsSchema>;
export type MarkdownOverlayInput = z.input<typeof markdownOverlaySchema>;
