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
import { normalizePrototypeOverlay, prototypeOverlaySchema } from './overlay-prototype';
import { normalizeWebEmbedOverlay, webEmbedOverlaySchema } from './overlay-webembed';

// Re-export from overlay-markdown
export {
	MARKDOWN_SYSTEM_FONT_STACK,
	DEFAULT_MARKDOWN_NOTE_SETTINGS,
	normalizeMarkdownSettings,
	normalizeMarkdownOverlay,
} from './overlay-markdown';

// Re-export from overlay-newlex
export { normalizeNewLexOverlay } from './overlay-newlex';

// Re-export from overlay-kanban
export {
	createStarterKanbanColumns,
	normalizeKanbanOverlay,
	summarizeKanbanOverlay,
} from './overlay-kanban';

// Re-export from overlay-webembed
export { normalizeWebEmbedOverlay } from './overlay-webembed';

export { normalizePrototypeOverlay } from './overlay-prototype';

// Combined schema for discriminated union
const overlayCustomDataSchema = z.discriminatedUnion('type', [
	markdownOverlaySchema,
	newLexOverlaySchema,
	kanbanOverlaySchema,
	webEmbedOverlaySchema,
	prototypeOverlaySchema,
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
	if (type === 'prototype') return normalizePrototypeOverlay(input);
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
	prototype: prototypeOverlaySchema,
	customData: overlayCustomDataSchema,
} as const;
