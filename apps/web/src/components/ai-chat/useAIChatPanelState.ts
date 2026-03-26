import type { CanvasElement } from '@ai-canvas/shared/types';
import { useCallback, useMemo, useState } from 'react';
import type { SelectionIndicator } from './ai-chat-types';
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

		// Derived
		selectionIndicator,
		isDisabled,
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
