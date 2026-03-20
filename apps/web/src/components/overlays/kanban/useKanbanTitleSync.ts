import { useEffect, useRef } from 'react';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';

interface UseKanbanTitleSyncOptions {
	board: KanbanOverlayCustomData;
	setBoardTitleDraft: React.Dispatch<React.SetStateAction<string>>;
}

interface UseKanbanTitleSyncResult {
	syncedTitle: string;
}

export function useKanbanTitleSync({
	board,
	setBoardTitleDraft,
}: UseKanbanTitleSyncOptions): UseKanbanTitleSyncResult {
	const lastBoardTitleRef = useRef(board.title);

	// Single useEffect for title -> titleDraft sync
	useEffect(() => {
		// No change in board title - nothing to do
		if (board.title === lastBoardTitleRef.current) {
			return;
		}

		// Update tracking and sync draft
		lastBoardTitleRef.current = board.title;
		setBoardTitleDraft(board.title);
	}, [board.title, setBoardTitleDraft]);

	return { syncedTitle: board.title };
}
