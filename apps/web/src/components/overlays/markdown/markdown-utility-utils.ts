import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

const NOTE_EDGE_OPTIONS = [
	{
		id: 'square',
		label: 'Square',
		roundness: null,
	},
	{
		id: 'rounded',
		label: 'Rounded',
		roundness: { type: 3, value: 18 } as const,
	},
	{
		id: 'pill',
		label: 'Pill',
		roundness: { type: 1 } as const,
	},
] as const;

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
