import { updateSceneAndSyncAppStore } from '@/components/canvas/excalidraw-store-sync';
import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseCanvasSelectionOptions {
	/** Called when the selection changes */
	onSelectionChange?: (selectedElements: ExcalidrawElement[]) => void;
	/** Called when a single element is selected */
	onSingleSelect?: (element: ExcalidrawElement) => void;
	/** Called when multiple elements are selected */
	onMultiSelect?: (elements: ExcalidrawElement[]) => void;
	/** Called when selection is cleared */
	onClearSelection?: () => void;
}

export interface UseCanvasSelectionResult {
	/** Currently selected elements */
	selectedElements: ExcalidrawElement[];
	/** The single selected element, or null if none or multiple selected */
	selectedElement: ExcalidrawElement | null;
	/** IDs of selected elements */
	selectedElementIds: string[];
	/** Number of selected elements */
	selectionCount: number;
	/** Whether any element is selected */
	hasSelection: boolean;
	/** Whether exactly one element is selected */
	hasSingleSelection: boolean;
	/** Clear the current selection */
	clearSelection: () => void;
}

/**
 * Hook to monitor and respond to canvas selection changes.
 *
 * This hook provides access to the currently selected elements on the canvas,
 * along with utilities for working with selections.
 *
 * @example
 * ```tsx
 * function SelectionInfo() {
 *   const { selectedElement, hasSelection } = useCanvasSelection({
 *     onSingleSelect: (el) => console.log('Selected:', el.id),
 *   });
 *
 *   if (!hasSelection) return <div>No selection</div>;
 *   return <div>Selected: {selectedElement?.id}</div>;
 * }
 * ```
 */
export function useCanvasSelection(
	options: UseCanvasSelectionOptions = {},
): UseCanvasSelectionResult {
	const { onSelectionChange, onSingleSelect, onMultiSelect, onClearSelection } = options;

	// Get state from store
	const elements = useAppStore((s) => s.elements);
	const selectedElementIdsMap = useAppStore((s) => s.appState.selectedElementIds ?? {});

	// Track previous selection to detect changes
	const prevSelectionRef = useRef<string>('');

	// Local state for triggering updates when selection actually changes
	const [selectionVersion, setSelectionVersion] = useState(0);

	// Get array of selected element IDs
	const selectedElementIds = useMemo(() => {
		return Object.keys(selectedElementIdsMap);
	}, [selectedElementIdsMap]);

	// Get the actual selected elements
	const selectedElements = useMemo(() => {
		if (selectedElementIds.length === 0) return [];
		return elements.filter((el) => selectedElementIdsMap[el.id]);
	}, [elements, selectedElementIds, selectedElementIdsMap]);

	// Get single selected element (null if none or multiple)
	const selectedElement = useMemo(() => {
		return selectedElements.length === 1 ? selectedElements[0] : null;
	}, [selectedElements]);

	// Derived state
	const selectionCount = selectedElements.length;
	const hasSelection = selectionCount > 0;
	const hasSingleSelection = selectionCount === 1;

	// Clear selection callback
	const clearSelection = useCallback(() => {
		const excalidrawApi = useAppStore.getState().excalidrawApi;
		if (excalidrawApi) {
			updateSceneAndSyncAppStore(
				excalidrawApi,
				{
					appState: { selectedElementIds: {} },
				},
				{
					appState: {
						...excalidrawApi.getAppState(),
						selectedElementIds: {},
					},
				},
			);
		}
	}, []);

	// Detect selection changes and trigger callbacks
	useEffect(() => {
		const currentSelectionKey = selectedElementIds.sort().join(',');
		const prevSelection = prevSelectionRef.current;

		// Only process if selection actually changed
		if (currentSelectionKey !== prevSelection) {
			prevSelectionRef.current = currentSelectionKey;
			setSelectionVersion((v) => v + 1);

			// Trigger callbacks
			onSelectionChange?.(selectedElements);

			if (selectedElements.length === 0) {
				onClearSelection?.();
			} else if (selectedElements.length === 1 && selectedElements[0]) {
				onSingleSelect?.(selectedElements[0]);
			} else {
				onMultiSelect?.(selectedElements);
			}
		}
	}, [
		selectedElementIds,
		selectedElements,
		onSelectionChange,
		onSingleSelect,
		onMultiSelect,
		onClearSelection,
	]);

	// Return stable reference
	return useMemo(
		() => ({
			selectedElements,
			selectedElement,
			selectedElementIds,
			selectionCount,
			hasSelection,
			hasSingleSelection,
			clearSelection,
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			selectedElements,
			selectedElement,
			selectedElementIds,
			selectionCount,
			hasSelection,
			hasSingleSelection,
			clearSelection,
			selectionVersion,
		],
	);
}
