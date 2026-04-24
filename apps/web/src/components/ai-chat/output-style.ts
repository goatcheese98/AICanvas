import type { GenerationMode } from '@ai-canvas/shared/types';

type AssistantOutputStyle = 'auto' | 'raster' | 'vector-sketch' | 'svg';

export function outputStyleToModeHint(
	outputStyle: AssistantOutputStyle,
): Extract<GenerationMode, 'image' | 'sketch' | 'svg'> | undefined {
	switch (outputStyle) {
		case 'raster':
			return 'image';
		case 'vector-sketch':
			return 'sketch';
		case 'svg':
			return 'svg';
		default:
			return undefined;
	}
}
