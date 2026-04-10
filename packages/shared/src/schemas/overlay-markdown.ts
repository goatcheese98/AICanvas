import * as z from 'zod';

export const MARKDOWN_SYSTEM_FONT_STACK =
	'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const DEFAULT_MARKDOWN_NOTE_SETTINGS = {
	font: 'Nunito, "Segoe UI Emoji", sans-serif',
	fontSize: 8,
	background: '#ffffff',
	lineHeight: 1.65,
	inlineCodeColor: '#334155',
	showEmptyLines: true,
	autoHideToolbar: false,
} as const;

export const markdownEditorModeSchema = z.enum(['raw', 'hybrid']);

export const markdownNoteSettingsSchema = z.object({
	font: z.string().trim().min(1).max(160).default(DEFAULT_MARKDOWN_NOTE_SETTINGS.font),
	fontSize: z.coerce
		.number()
		.transform((value) => Math.min(28, Math.max(8, value)))
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.fontSize),
	background: z.string().trim().min(1).max(32).default(DEFAULT_MARKDOWN_NOTE_SETTINGS.background),
	lineHeight: z.coerce
		.number()
		.transform((value) => Math.min(2.2, Math.max(1.2, value)))
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.lineHeight),
	inlineCodeColor: z
		.string()
		.trim()
		.regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)
		.default(DEFAULT_MARKDOWN_NOTE_SETTINGS.inlineCodeColor),
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

export function normalizeMarkdownSettings(
	settings?: Partial<z.input<typeof markdownNoteSettingsSchema>> | null,
) {
	const parsed = markdownNoteSettingsSchema.parse(settings ?? {});
	return {
		...parsed,
		font: parsed.font === 'inherit' ? MARKDOWN_SYSTEM_FONT_STACK : parsed.font,
	};
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
