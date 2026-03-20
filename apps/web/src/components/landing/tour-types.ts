import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';

export interface CameraTarget {
	x: number;
	y: number;
	zoom: number;
}

export interface CanvasSceneSnapshot {
	elements: ExcalidrawElement[];
	appState: Partial<AppState>;
	files: BinaryFiles;
}

export interface CanvasTourDefaultScene {
	elements: ExcalidrawElement[];
	files: BinaryFiles;
}

export type TourTool =
	| 'hand'
	| 'selection'
	| 'rectangle'
	| 'diamond'
	| 'ellipse'
	| 'arrow'
	| 'line'
	| 'freedraw'
	| 'text'
	| 'image'
	| 'eraser';

export interface ApplySceneSnapshotOptions {
	preserveSelection?: boolean;
	cameraOverride?: CameraTarget;
}

export function getTourTool(value: unknown): TourTool | null {
	return value === 'hand' ||
		value === 'selection' ||
		value === 'rectangle' ||
		value === 'diamond' ||
		value === 'ellipse' ||
		value === 'arrow' ||
		value === 'line' ||
		value === 'freedraw' ||
		value === 'text' ||
		value === 'image' ||
		value === 'eraser'
		? value
		: null;
}
