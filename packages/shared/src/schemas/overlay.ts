import * as z from 'zod';
import { OVERLAY_TYPES } from '../constants';
import type { OverlayCustomData } from '../types';
import { kanbanOverlaySchema, normalizeKanbanOverlay } from './overlay-kanban';
import {
	markdownEditorModeSchema,
	markdownNoteSettingsSchema,
	markdownOverlaySchema,
	normalizeMarkdownOverlay,
} from './overlay-markdown';
import { newLexOverlaySchema, normalizeNewLexOverlay } from './overlay-newlex';
import { normalizeWebEmbedOverlay, webEmbedOverlaySchema } from './overlay-webembed';

// Re-export from overlay-prototype
export {
	prototypeCardMetricSchema,
	prototypeCardPreviewSchema,
	prototypeOverlayFileSchema,
	prototypeOverlaySchema,
	normalizePrototypeOverlay,
	prototypeTemplateSchema,
} from './overlay-prototype';

// Re-export from overlay-markdown
export {
	MARKDOWN_SYSTEM_FONT_STACK,
	DEFAULT_MARKDOWN_NOTE_SETTINGS,
	markdownEditorModeSchema,
	markdownNoteSettingsSchema,
	markdownOverlaySchema,
	normalizeMarkdownSettings,
	normalizeMarkdownOverlay,
} from './overlay-markdown';

// Re-export from overlay-newlex
export {
	newLexCommentReplySchema,
	newLexCommentThreadSchema,
	newLexOverlaySchema,
	normalizeNewLexOverlay,
} from './overlay-newlex';

// Re-export from overlay-kanban
export {
	kanbanChecklistItemSchema,
	kanbanCardSchema,
	kanbanColumnSchema,
	kanbanOverlaySchema,
	createStarterKanbanColumns,
	normalizeKanbanOverlay,
	summarizeKanbanOverlay,
} from './overlay-kanban';

// Re-export from overlay-webembed
export {
	webEmbedOverlaySchema,
	normalizeWebEmbedOverlay,
} from './overlay-webembed';

// Combined schema for discriminated union
export const overlayCustomDataSchema = z.discriminatedUnion('type', [
	markdownOverlaySchema,
	newLexOverlaySchema,
	kanbanOverlaySchema,
	webEmbedOverlaySchema,
]);

// Dispatcher function for normalizing overlay custom data
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

// Type guard for overlay custom data
export function isOverlayCustomData(value: unknown): value is OverlayCustomData {
	if (!value || typeof value !== 'object') return false;
	const type = (value as { type?: unknown }).type;
	return typeof type === 'string' && (OVERLAY_TYPES as readonly string[]).includes(type);
}

// Schema exports object
export const overlaySchemas = {
	markdown: markdownOverlaySchema,
	markdownSettings: markdownNoteSettingsSchema,
	markdownEditorMode: markdownEditorModeSchema,
	newLex: newLexOverlaySchema,
	kanban: kanbanOverlaySchema,
	webEmbed: webEmbedOverlaySchema,
	customData: overlayCustomDataSchema,
} as const;

// Type exports
export type MarkdownNoteSettingsInput = import('./overlay-markdown').MarkdownNoteSettingsInput;
export type MarkdownOverlayInput = import('./overlay-markdown').MarkdownOverlayInput;
