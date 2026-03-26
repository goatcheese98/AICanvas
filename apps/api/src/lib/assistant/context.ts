/**
 * Assistant context building module
 *
 * This module provides utilities for building context snapshots for the AI assistant,
 * including element parsing, geometry calculations, summary building, and text formatting.
 */

// Re-export from constants
export {
	SELECTION_CONTEXT_PRIORITY,
	OVERLAY_TYPES,
	EDITABLE_OVERLAY_TYPES,
	CANVAS_HIGHLIGHT_LIMIT,
	CANVAS_ELEMENT_SUMMARY_LIMIT,
	SELECTION_ENVIRONMENT_LIMIT,
	SELECTION_SUMMARY_LIMIT,
	TEXT_EXCERPT_LIMIT,
} from './context/constants';

// Re-export from element-parsers
export {
	toObjectRecord,
	toElementId,
	normalizeText,
	getOverlayType,
	getOverlayLikeType,
	parseGeneratedDiagramMetadata,
	getElementType,
	buildElementLabel,
	buildElementTextExcerpt,
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizePrototypeOverlay,
	normalizeWebEmbedOverlay,
	type GeneratedDiagramMetadata,
} from './context/element-parsers';

// Re-export from geometry
export {
	buildBounds,
	stringifyRoundness,
	buildStyleHints,
	getSelectionBounds,
	rectDistance,
	buildSelectionEnvironment,
} from './context/geometry';

// Re-export from context-builders
export {
	getContextKind,
	buildSelectedContext,
	buildGenericContextPayload,
	buildElementSummary,
	compareByPriorityAndLabel,
	buildSelectionSummary,
} from './context/context-builders';

// Re-export from summary-builders
export {
	buildCanvasSummary,
	buildCanvasElementSummaries,
	incrementCount,
	compareCanvasSummaryCandidates,
} from './context/summary-builders';

// Re-export from snapshot
export {
	buildAssistantContextSnapshot,
	type BuildAssistantContextSnapshotInput,
} from './context/snapshot';

// Re-export from formatters
export {
	formatCountMap,
	summarizeAssistantContextSnapshot,
} from './context/formatters';
