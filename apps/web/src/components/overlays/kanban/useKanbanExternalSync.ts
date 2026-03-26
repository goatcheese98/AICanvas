import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeKanbanBoard, serializeKanbanBoard } from './kanban-utils';

interface UseKanbanExternalSyncOptions {
	element: { customData: Partial<KanbanOverlayCustomData> | null | undefined };
	boardRef: React.MutableRefObject<KanbanOverlayCustomData>;
	setBoard: React.Dispatch<React.SetStateAction<KanbanOverlayCustomData>>;
	setBoardTitleDraft: React.Dispatch<React.SetStateAction<string>>;
}

interface UseKanbanExternalSyncResult {
	isSyncing: boolean;
	lastExternalUpdate: number | null;
}

export function useKanbanExternalSync({
	element,
	boardRef,
	setBoard,
	setBoardTitleDraft,
}: UseKanbanExternalSyncOptions): UseKanbanExternalSyncResult {
	// Compute external board from element.customData
	const nextExternalBoard = useMemo(
		() => normalizeKanbanBoard(element.customData),
		[element.customData],
	);

	const nextExternalSignature = useMemo(
		() => serializeKanbanBoard(nextExternalBoard),
		[nextExternalBoard],
	);

	// Track sync state for consumers
	const [lastExternalUpdate, setLastExternalUpdate] = useState<number | null>(null);
	const externalBoardSignatureRef = useRef(nextExternalSignature);

	// Single useEffect for external data sync
	useEffect(() => {
		// No change in external signature - nothing to do
		if (nextExternalSignature === externalBoardSignatureRef.current) {
			return;
		}

		// Update signature tracking
		externalBoardSignatureRef.current = nextExternalSignature;

		// Check if local state already matches (avoid unnecessary updates)
		if (serializeKanbanBoard(boardRef.current) === nextExternalSignature) {
			return;
		}

		// Propagate external changes to local state
		boardRef.current = nextExternalBoard;
		setBoard(nextExternalBoard);
		setBoardTitleDraft((current) =>
			current === nextExternalBoard.title ? current : nextExternalBoard.title,
		);
		setLastExternalUpdate(Date.now());
	}, [nextExternalBoard, nextExternalSignature, boardRef, setBoard, setBoardTitleDraft]);

	const isSyncing = lastExternalUpdate !== null;

	return { isSyncing, lastExternalUpdate };
}
