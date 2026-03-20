import { normalizeMarkdownOverlay } from '@ai-canvas/shared/schemas';
import type { MarkdownEditorMode, MarkdownNoteSettings } from '@ai-canvas/shared/types';
import { useMemo, useRef } from 'react';
import { serializeOverlayState } from './markdown-note-helpers';
import type { MarkdownNoteProps } from './markdown-note-types';

interface MarkdownSyncState {
	content: string;
	images: Record<string, string>;
	title: string;
	settings: MarkdownNoteSettings;
	editorMode: MarkdownEditorMode;
}

interface UseMarkdownSyncProps {
	element: MarkdownNoteProps['element'];
	normalizedElement?: ReturnType<typeof normalizeMarkdownOverlay>;
	sourceSignature?: string;
}

interface UseMarkdownSyncReturn {
	resolvedNormalizedElement: ReturnType<typeof normalizeMarkdownOverlay>;
	resolvedSourceSignature: string;
	hasExternalChanges: boolean;
	lastExternalUpdate: number;
}

/**
 * Hook for synchronizing local state with external data changes.
 * Tracks external data signatures and provides conflict detection.
 */
export function useMarkdownSync({
	element,
	normalizedElement,
	sourceSignature,
}: UseMarkdownSyncProps): UseMarkdownSyncReturn {
	// Resolve normalized element from props or compute from element.customData
	const resolvedNormalizedElement = useMemo(
		() => normalizedElement ?? normalizeMarkdownOverlay(element.customData),
		[element.customData, normalizedElement],
	);

	// Compute source signature for external change detection
	const resolvedSourceSignature = useMemo(
		() => sourceSignature ?? serializeOverlayState(resolvedNormalizedElement),
		[resolvedNormalizedElement, sourceSignature],
	);

	// Track the last external signature we've seen
	const lastExternalSignatureRef = useRef(resolvedSourceSignature);

	// Track when external data last changed (timestamp)
	const lastExternalUpdateRef = useRef(Date.now());

	// Detect if external data has changed since we last saw it
	const hasExternalChanges = resolvedSourceSignature !== lastExternalSignatureRef.current;

	// Update tracking refs when external signature changes
	if (hasExternalChanges) {
		lastExternalSignatureRef.current = resolvedSourceSignature;
		lastExternalUpdateRef.current = Date.now();
	}

	return {
		resolvedNormalizedElement,
		resolvedSourceSignature,
		hasExternalChanges,
		lastExternalUpdate: lastExternalUpdateRef.current,
	};
}

/**
 * Check if local state has unsaved changes compared to external data.
 * Used by components to show "unsaved changes" indicators.
 */
export function hasLocalEdits(
	localState: MarkdownSyncState,
	externalNormalizedElement: ReturnType<typeof normalizeMarkdownOverlay>,
): boolean {
	return (
		localState.content !== externalNormalizedElement.content ||
		localState.title !== externalNormalizedElement.title ||
		JSON.stringify(localState.images) !==
			JSON.stringify(externalNormalizedElement.images ?? {}) ||
		JSON.stringify(localState.settings) !==
			JSON.stringify(externalNormalizedElement.settings) ||
		localState.editorMode !== (externalNormalizedElement.editorMode ?? 'raw')
	);
}
