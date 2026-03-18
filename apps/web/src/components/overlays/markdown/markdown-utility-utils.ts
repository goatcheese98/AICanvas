import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { NOTE_EDGE_OPTIONS } from './markdown-note-helpers';

export function getRoundnessOptionId(
	roundness: ExcalidrawElement['roundness'] | undefined,
): string {
	if (!roundness) return 'square';
	if (roundness.type === 1 || roundness.type === 2) return 'pill';
	return 'rounded';
}

export function getRoundnessByOptionId(optionId: string): ExcalidrawElement['roundness'] | null {
	const selected = NOTE_EDGE_OPTIONS.find((option) => option.id === optionId);
	return selected?.roundness ?? null;
}
