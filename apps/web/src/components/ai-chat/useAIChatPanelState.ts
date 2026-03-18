import type { CanvasElement } from '@ai-canvas/shared/types';
import { useCallback, useMemo, useState } from 'react';
import type { PendingSelectionConfirmation, SelectionIndicator } from './ai-chat-types';
import type { AssistantOutputStyle } from './output-style';
import { buildSelectionIndicator } from './selection-context';

/**
 * Hook for managing AIChatPanel UI state.
 * Separates transient UI state from persisted chat data.
 */
export function useAIChatPanelState({
	elements,
	selectedElementIds,
}: {
	elements: readonly CanvasElement[];
	selectedElementIds: Record<string, boolean>;
}) {
	// Input state
	const [input, setInput] = useState('');

	// UI state
	const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
	const [outputStyle, setOutputStyle] = useState<AssistantOutputStyle>('auto');

	// Derived selection indicator
	const selectionIndicator: SelectionIndicator = useMemo(
		() => buildSelectionIndicator(elements as unknown as CanvasElement[], selectedElementIds),
		[elements, selectedElementIds],
	);

	// Computed disabled state
	const isDisabled = useCallback(
		({ isChatLoading, isThreadsLoading }: { isChatLoading: boolean; isThreadsLoading: boolean }) =>
			!input.trim() || isChatLoading || isThreadsLoading,
		[input],
	);

	return {
		// Input state
		input,
		setInput,

		// UI state
		isHistoryCollapsed,
		setIsHistoryCollapsed,
		outputStyle,
		setOutputStyle,

		// Derived
		selectionIndicator,
		isDisabled,
	};
}

/**
 * Hook for managing pending selection confirmation state.
 * Uses event-driven pattern instead of useEffect for reset logic.
 */
export function useSelectionConfirmation({
	selectionIndicator,
}: {
	selectionIndicator: SelectionIndicator;
}) {
	const [pendingSelectionConfirmation, setPendingSelectionConfirmation] =
		useState<PendingSelectionConfirmation>(null);

	/**
	 * Clears pending selection confirmation when selection is lost.
	 * Call this when selection changes.
	 */
	const clearSelectionConfirmationIfNeeded = useCallback(() => {
		if (!selectionIndicator && pendingSelectionConfirmation) {
			setPendingSelectionConfirmation(null);
		}
	}, [selectionIndicator, pendingSelectionConfirmation]);

	/**
	 * Sets pending selection confirmation.
	 */
	const requestSelectionConfirmation = useCallback(
		(prompt: string) => {
			if (selectionIndicator) {
				setPendingSelectionConfirmation({
					prompt,
					createdAt: new Date().toISOString(),
				});
				return true;
			}
			return false;
		},
		[selectionIndicator],
	);

	return {
		pendingSelectionConfirmation,
		setPendingSelectionConfirmation,
		clearSelectionConfirmationIfNeeded,
		requestSelectionConfirmation,
	};
}

/**
 * Hook for handling suggestion clicks in empty state.
 */
export function useSuggestionHandler({
	setInput,
}: {
	setInput: (value: string) => void;
}) {
	return useCallback(
		(suggestion: string) => {
			setInput(suggestion);
		},
		[setInput],
	);
}
