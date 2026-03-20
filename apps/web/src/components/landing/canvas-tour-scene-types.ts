import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';

export interface DemoScene {
	elements: ExcalidrawElement[];
	files: BinaryFiles;
}

export interface TourBoundElement {
	id: string;
	type: 'arrow' | 'text';
}

export interface TourBindableNode {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	boundElements: TourBoundElement[];
	container: ExcalidrawElement;
	elements: ExcalidrawElement[];
}

export type TourNodeKey =
	| 'attention'
	| 'prompt'
	| 'hallucination'
	| 'ragPipeline'
	| 'question'
	| 'retriever'
	| 'generator'
	| 'studyNote'
	| 'checklistNote';

export type TourAnchorSide = 'left' | 'right' | 'top' | 'bottom';

export interface TourAnchorConfig {
	side: TourAnchorSide;
	focus?: number;
}

export interface TourTextConfig {
	x: number;
	y: number;
	text: string;
	strokeColor: string;
	fontSize: number;
	fontFamily: number;
	widthPadding?: number;
	heightPadding?: number;
}

export interface TourLooseShapeConfig {
	type: 'ellipse' | 'rectangle';
	x: number;
	y: number;
	width: number;
	height: number;
	strokeColor: string;
	backgroundColor: string;
	strokeWidth: number;
	roundness?: ExcalidrawElement['roundness'];
	roughness?: number;
	opacity?: number;
}

export interface TourCardConfig {
	x: number;
	y: number;
	label: string;
	backgroundColor: string;
	containerStrokeColor: string;
	width: number;
	height: number;
	fontSize?: number;
	fontFamily?: number;
}

export interface TourNoteConfig {
	left: number;
	top: number;
	width: number;
	height: number;
	backgroundColor: string;
	strokeColor: string;
	strokeWidth: number;
	roundness: ExcalidrawElement['roundness'];
	customData: Record<string, unknown>;
}

export interface TourArrowConfig {
	source: TourNodeKey;
	target: TourNodeKey;
	sourceAnchor: TourAnchorConfig;
	targetAnchor: TourAnchorConfig;
	strokeColor?: string;
}

export interface TourSceneState {
	textBlocks: TourTextConfig[];
	looseTextBlocks: TourTextConfig[];
	looseShapes: TourLooseShapeConfig[];
	cards: Record<Exclude<TourNodeKey, 'studyNote' | 'checklistNote'>, TourCardConfig>;
	notes: Record<'studyNote' | 'checklistNote', TourNoteConfig>;
	lectureClipLabel: TourTextConfig;
	lectureClipImage: { x: number; y: number; width: number; height: number; angle: number };
	ragFlowLabel: TourTextConfig;
	summaryLabel: TourTextConfig;
	arrows: TourArrowConfig[];
}
