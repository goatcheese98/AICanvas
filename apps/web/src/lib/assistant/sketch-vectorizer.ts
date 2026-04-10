import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { DEFAULT_CONTROLS, MAX_ELEMENTS_BY_COMPLEXITY } from './vectorizer/config.js';
import { decodeImageData } from './vectorizer/preprocess.js';
import {
	buildBoundaryLoops,
	createPolygonSkeleton,
	selectLargestLoop,
} from './vectorizer/stages/polygonize.js';
import { quantize } from './vectorizer/stages/quantize.js';
import { processLabel } from './vectorizer/stages/segment.js';
import {
	chaikinSmoothClosed,
	simplifyClosedPolygon,
	sortByRenderOrder,
} from './vectorizer/stages/smooth.js';
import type {
	CompiledSketchVectorization,
	SketchVectorControls,
	SketchVectorizerOptions,
} from './vectorizer/types.js';

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Resolve partial controls to full controls with defaults */
function resolveControls(input?: Partial<SketchVectorControls>): SketchVectorControls {
	return {
		style: input?.style ?? DEFAULT_CONTROLS.style,
		complexity: input?.complexity ?? DEFAULT_CONTROLS.complexity,
		colorPalette: clamp(Math.round(input?.colorPalette ?? DEFAULT_CONTROLS.colorPalette), 2, 24),
		detailLevel: clamp(input?.detailLevel ?? DEFAULT_CONTROLS.detailLevel, 0.2, 1),
		edgeSensitivity: clamp(
			Math.round(input?.edgeSensitivity ?? DEFAULT_CONTROLS.edgeSensitivity),
			1,
			100,
		),
	};
}

// ============================================================================
// Excalidraw Integration
// ============================================================================

let convertToExcalidrawElementsLoader: Promise<
	typeof import('@excalidraw/excalidraw')['convertToExcalidrawElements']
> | null = null;

async function getConvertToExcalidrawElements() {
	if (!convertToExcalidrawElementsLoader) {
		convertToExcalidrawElementsLoader = import('@excalidraw/excalidraw').then(
			(module) => module.convertToExcalidrawElements,
		);
	}
	return convertToExcalidrawElementsLoader;
}

function getElementsBounds(elements: readonly ExcalidrawElement[]): {
	width: number;
	height: number;
} {
	const left = Math.min(...elements.map((element) => element.x));
	const top = Math.min(...elements.map((element) => element.y));
	const right = Math.max(...elements.map((element) => element.x + Math.abs(element.width ?? 0)));
	const bottom = Math.max(...elements.map((element) => element.y + Math.abs(element.height ?? 0)));
	return {
		width: right - left,
		height: bottom - top,
	};
}

// ============================================================================
// Pipeline Orchestration
// ============================================================================

/**
 * Main vectorization pipeline: converts a raster image blob to Excalidraw elements.
 *
 * Pipeline stages:
 * 1. Image decode and normalization (decodeImageData in preprocess.ts)
 * 2. Color quantization (quantize stage)
 * 3. Component segmentation (processLabel per color)
 * 4. Polygon extraction (buildBoundaryLoops, selectLargestLoop)
 * 5. Path smoothing (chaikinSmoothClosed, simplifyClosedPolygon)
 * 6. Skeleton creation and ordering (createPolygonSkeleton, sortByRenderOrder)
 * 7. Excalidraw element conversion
 */
async function runVectorizationPipeline(
	blob: Blob,
	options?: SketchVectorizerOptions,
): Promise<CompiledSketchVectorization> {
	const startedAt = performance.now();
	const controls = resolveControls(options?.controls);
	const decoded = await decodeImageData(blob, controls, options ?? {});
	const logs: string[] = [];
	const customData = {
		type: 'ai-generated-vector-elements',
		renderer: 'layered-sketch-vectorizer',
		...(options?.customData ?? {}),
	};
	const groupId = crypto.randomUUID();

	// Stage 1: Color quantization
	logs.push('Applying edge-preserving bilateral filter...');
	logs.push('Applying k-means color clustering...');
	const quantization = quantize(decoded, controls);

	// Compute processing parameters
	const epsilon = clamp(2.45 - controls.detailLevel * 1.35, 0.85, 2.25);
	const minArea = Math.max(18, Math.round(48 - controls.detailLevel * 32));
	const kernelSize = controls.detailLevel >= 0.85 ? 3 : 4;

	// Stage 2-5: Process each color label
	const candidates = [];
	let componentsFound = 0;
	let componentsFiltered = 0;

	for (let label = 0; label < quantization.centers.length; label += 1) {
		if (quantization.backgroundLabels.has(label)) {
			continue;
		}

		const { components, mask, filtered } = processLabel(
			label,
			quantization.centers[label],
			quantization.labels,
			decoded.width,
			decoded.height,
			kernelSize,
			minArea,
		);
		componentsFound += components.length + filtered;
		componentsFiltered += filtered;

		for (const component of components) {
			const loops = buildBoundaryLoops(component, mask, decoded.width, decoded.height);
			if (loops.length === 0) continue;

			const selected = selectLargestLoop(loops);
			if (!selected) continue;

			const smoothed = chaikinSmoothClosed(selected.loop, controls.detailLevel >= 0.8 ? 1 : 0);
			const simplified = simplifyClosedPolygon(smoothed, epsilon);
			if (simplified.length < 4) continue;

			const candidate = createPolygonSkeleton(
				simplified,
				quantization.centers[label],
				component.area,
				controls,
				customData,
				groupId,
				label,
				label,
			);
			if (candidate) {
				candidates.push(candidate);
			}
		}
	}

	// Stage 6: Sort by render order and limit
	const sorted = sortByRenderOrder(candidates);
	const maxElements = options?.maxElements ?? MAX_ELEMENTS_BY_COMPLEXITY[controls.complexity];
	const emittedSkeletons = sorted.slice(0, maxElements).map((c) => ({ ...c.skeleton }));

	if (emittedSkeletons.length === 0) {
		throw new Error('No vectorizable regions were detected in this image.');
	}

	// Stage 7: Convert to Excalidraw elements
	const convertToExcalidrawElements = await getConvertToExcalidrawElements();
	const elements = convertToExcalidrawElements(emittedSkeletons as never[]) as ExcalidrawElement[];
	const bounds = getElementsBounds(elements);

	return {
		elements,
		width: bounds.width,
		height: bounds.height,
		logs,
		metadata: {
			sourceWidth: decoded.sourceWidth,
			sourceHeight: decoded.sourceHeight,
			workingWidth: decoded.width,
			workingHeight: decoded.height,
			numColorsRequested: quantization.requestedColors,
			numColorsUsed: quantization.centers.length,
			backgroundLabel: quantization.backgroundLabel,
			morphologyKernelSize: kernelSize,
			epsilon,
			minArea,
			componentsFound,
			componentsFiltered,
			elementsCreated: candidates.length,
			elementsEmitted: elements.length,
			processingMs: Math.round(performance.now() - startedAt),
		},
	} satisfies CompiledSketchVectorization;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Convert a raster image (Blob) to vectorized Excalidraw sketch elements.
 *
 * @param imageData - The image as a Blob
 * @param options - Optional configuration for the vectorization process
 * @returns A promise resolving to the compiled vectorization with elements, metadata, and logs
 * @throws Error if the image cannot be processed or no vectorizable regions are found
 */
export async function vectorizeSketch(
	imageData: Blob,
	options?: SketchVectorizerOptions,
): Promise<CompiledSketchVectorization> {
	return runVectorizationPipeline(imageData, options);
}
