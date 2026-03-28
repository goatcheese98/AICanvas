import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useEffect, useMemo, useRef } from 'react';
import { isHeavyOverlayType } from './resource-type-utils';

interface UseDetailsPanelOnSelectionOptions {
	/** Called when a heavy resource is selected */
	onOpenDetails: () => void;
	/** Whether the details panel is already open */
	isDetailsPanelOpen: boolean;
}

interface UseDetailsPanelOnSelectionResult {
	/** The currently selected overlay element, if any */
	selectedElement: ExcalidrawElement | null;
	/** Whether the selected element is a heavy resource */
	isHeavyResource: boolean;
}

/**
 * Hook that monitors canvas selection and opens the Details panel
 * when a "heavy" resource (kanban, newlex) is selected.
 *
 * Heavy resources get the Details panel on single-click.
 * Light resources (markdown, web-embed) do not.
 *
 * Note: This hook intentionally does NOT track selection changes when
 * the user already has the Details panel open - it only opens it
 * automatically on initial selection.
 */
export function useDetailsPanelOnSelection({
	onOpenDetails,
	isDetailsPanelOpen,
}: UseDetailsPanelOnSelectionOptions): UseDetailsPanelOnSelectionResult {
	const elements = useAppStore((s) => s.elements);
	const selectedElementIds = useAppStore((s) => s.appState.selectedElementIds ?? {});

	// Track previous selection to avoid re-triggering when clicking same element
	const previousSelectionRef = useRef<string | null>(null);

	// Find the currently selected element
	const selectedElement = useMemo(() => {
		const selectedIds = Object.keys(selectedElementIds);
		if (selectedIds.length !== 1) {
			return null;
		}
		const selectedId = selectedIds[0];
		return elements.find((el) => el.id === selectedId) ?? null;
	}, [elements, selectedElementIds]);

	// Check if selected element is a heavy resource
	const isHeavyResource = useMemo(() => {
		if (!selectedElement) return false;
		const customData = selectedElement.customData as { type?: unknown } | undefined;
		return isHeavyOverlayType(customData?.type);
	}, [selectedElement]);

	// Open details panel when a heavy resource is selected
	useEffect(() => {
		const selectedId = selectedElement?.id ?? null;
		const previousId = previousSelectionRef.current;

		// Only trigger if:
		// 1. We have a selected element
		// 2. It's a heavy resource
		// 3. The selection changed (new element selected)
		// 4. The details panel is not already open
		if (selectedId && isHeavyResource && selectedId !== previousId && !isDetailsPanelOpen) {
			onOpenDetails();
		}

		// Update the ref after checking
		previousSelectionRef.current = selectedId;
	}, [selectedElement, isHeavyResource, onOpenDetails, isDetailsPanelOpen]);

	return {
		selectedElement,
		isHeavyResource,
	};
}
