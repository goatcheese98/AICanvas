/**
 * Constants for assistant context building
 */

import type { AssistantSelectedContext } from '@ai-canvas/shared/types';

/** Priority map for context kinds (lower number = higher priority) */
export const SELECTION_CONTEXT_PRIORITY: Record<AssistantSelectedContext['kind'], number> = {
	markdown: 1,
	kanban: 2,
	prototype: 3,
	'web-embed': 4,
	'generated-diagram': 5,
	generic: 6,
};

/** Set of recognized overlay types */
export const OVERLAY_TYPES = new Set(['markdown', 'kanban', 'prototype', 'web-embed', 'newlex']);

/** Set of overlay types that are editable */
export const EDITABLE_OVERLAY_TYPES = new Set(['markdown', 'kanban', 'prototype']);

/** Maximum number of highlights to include in canvas summary */
export const CANVAS_HIGHLIGHT_LIMIT = 12;

/** Maximum number of element summaries to include in canvas summary */
export const CANVAS_ELEMENT_SUMMARY_LIMIT = 18;

/** Maximum number of nearby elements to include in selection environment */
export const SELECTION_ENVIRONMENT_LIMIT = 8;

/** Maximum number of elements to include in selection summary */
export const SELECTION_SUMMARY_LIMIT = 25;

/** Maximum length for text excerpts */
export const TEXT_EXCERPT_LIMIT = 320;
