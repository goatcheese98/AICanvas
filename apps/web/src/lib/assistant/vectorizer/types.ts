import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

/** Vector style preset for output appearance */
export type SketchVectorStyle = 'clean' | 'technical' | 'hand-drawn' | 'organic';

/** Complexity level affecting detail and element count */
export type SketchVectorComplexity = 'low' | 'medium' | 'high';

/** User-facing control parameters */
export interface SketchVectorControls {
	style: SketchVectorStyle;
	complexity: SketchVectorComplexity;
	colorPalette: number;
	detailLevel: number;
	edgeSensitivity: number;
}

/** Options for the vectorizeSketch function */
export interface SketchVectorizerOptions {
	maxWidth?: number;
	maxHeight?: number;
	maxElements?: number;
	customData?: Record<string, unknown>;
	controls?: Partial<SketchVectorControls>;
}

/** Processing metadata for debugging and analytics */
export interface SketchVectorizationMetadata {
	sourceWidth: number;
	sourceHeight: number;
	workingWidth: number;
	workingHeight: number;
	numColorsRequested: number;
	numColorsUsed: number;
	backgroundLabel: number;
	morphologyKernelSize: number;
	epsilon: number;
	minArea: number;
	componentsFound: number;
	componentsFiltered: number;
	elementsCreated: number;
	elementsEmitted: number;
	processingMs: number;
}

/** Final result of vectorization */
export interface CompiledSketchVectorization {
	elements: ExcalidrawElement[];
	width: number;
	height: number;
	metadata: SketchVectorizationMetadata;
	logs: string[];
}

// ============================================================================
// Internal types (not part of public API but used across stages)
// ============================================================================

/** 2D point coordinate */
export type Point = [number, number];

/** RGB color representation */
export interface RGB {
	r: number;
	g: number;
	b: number;
}

/** Connected component of pixels */
export interface Component {
	area: number;
	pixels: number[];
}

/** Edge between two points for boundary detection */
export interface BoundaryEdge {
	start: Point;
	end: Point;
}

/** Intermediate polygon element before conversion to Excalidraw format */
export interface PolygonElementCandidate {
	area: number;
	color: RGB;
	label: number;
	bbox: { minX: number; minY: number; maxX: number; maxY: number };
	polygon: Point[];
	skeleton: Record<string, unknown>;
}

/** Input data for pipeline stages */
export interface DecodedImageData {
	data: Uint8ClampedArray;
	width: number;
	height: number;
	sourceWidth: number;
	sourceHeight: number;
}

/** Output of color quantization stage */
export interface QuantizationResult {
	centers: RGB[];
	labels: Uint16Array;
	counts: Uint32Array;
	backgroundLabel: number;
	backgroundLabels: Set<number>;
	requestedColors: number;
}

/** Parameters computed from controls for processing stages */
export interface ProcessingParams {
	epsilon: number;
	minArea: number;
	kernelSize: number;
	maxElements: number;
}
