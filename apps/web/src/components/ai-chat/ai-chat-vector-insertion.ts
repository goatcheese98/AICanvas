import { syncAppStoreFromExcalidraw } from '@/components/canvas/excalidraw-store-sync';
import { rasterBlobToSvg } from '@/lib/assistant/raster-to-svg';
import { vectorizeSketch } from '@/lib/assistant/sketch-vectorizer';
import { compileSvgToExcalidraw } from '@/lib/assistant/svg-to-excalidraw';
import { addObservabilityBreadcrumb } from '@/lib/observability';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
	resolveInsertionSceneCenter,
	restoreCanvasSelectionState,
} from './ai-chat-canvas-mutations';
import type { AssistantInsertionState } from './ai-chat-types';

type NativeVectorCompileStrategy = 'sketch-vectorizer' | 'svg-trace' | 'svg-compile';

interface NativeVectorCompileResult {
	elements: ExcalidrawElement[];
	width: number;
	height: number;
	strategy: NativeVectorCompileStrategy;
}

interface NativeVectorCompileFailure {
	strategy: NativeVectorCompileStrategy;
	message: string;
}

class NativeVectorPipelineError extends Error {
	readonly failures: NativeVectorCompileFailure[];

	constructor(message: string, failures: NativeVectorCompileFailure[]) {
		super(message);
		this.name = 'NativeVectorPipelineError';
		this.failures = failures;
	}
}

function getElementsBounds(elements: readonly ExcalidrawElement[]) {
	const left = Math.min(...elements.map((element) => element.x));
	const top = Math.min(...elements.map((element) => element.y));
	const right = Math.max(...elements.map((element) => element.x + Math.abs(element.width ?? 0)));
	const bottom = Math.max(...elements.map((element) => element.y + Math.abs(element.height ?? 0)));
	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function offsetInsertedElements(
	elements: readonly ExcalidrawElement[],
	offset: { x: number; y: number },
): ExcalidrawElement[] {
	return elements.map((element) => ({
		...element,
		x: element.x + offset.x,
		y: element.y + offset.y,
		updated: Date.now(),
	}));
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unknown vectorization failure';
}

function recordStrategyFailure(
	source: string,
	strategy: NativeVectorCompileStrategy,
	error: unknown,
) {
	addObservabilityBreadcrumb(
		'assistant.vectorization.strategy_failed',
		{
			source,
			strategy,
			message: toErrorMessage(error),
		},
		'warning',
		'assistant',
	);
}

function recordStrategySuccess(source: string, strategy: NativeVectorCompileStrategy) {
	addObservabilityBreadcrumb(
		'assistant.vectorization.strategy_selected',
		{
			source,
			strategy,
		},
		'info',
		'assistant',
	);
}

function createPipelineError(
	message: string,
	failures: NativeVectorCompileFailure[],
): NativeVectorPipelineError {
	return new NativeVectorPipelineError(message, failures);
}

export function describeNativeVectorPipelineError(error: unknown, fallbackMessage: string): string {
	if (!(error instanceof NativeVectorPipelineError)) {
		return error instanceof Error ? error.message : fallbackMessage;
	}

	if (error.failures.length === 0) {
		return error.message;
	}

	return `${error.message} Tried ${error.failures
		.map((failure) => `${failure.strategy}: ${failure.message}`)
		.join('; ')}`;
}

export async function compileRasterBlobToNativeVector(
	blob: Blob,
	input: {
		customData: Record<string, unknown>;
		source: 'artifact-raster' | 'source-raster';
	},
): Promise<NativeVectorCompileResult> {
	const failures: NativeVectorCompileFailure[] = [];

	try {
		const compiled = await vectorizeSketch(blob, {
			controls: { colorPalette: 10 },
			customData: input.customData,
		});
		recordStrategySuccess(input.source, 'sketch-vectorizer');
		return {
			...compiled,
			strategy: 'sketch-vectorizer',
		};
	} catch (error) {
		failures.push({
			strategy: 'sketch-vectorizer',
			message: toErrorMessage(error),
		});
		recordStrategyFailure(input.source, 'sketch-vectorizer', error);
	}

	try {
		const svgMarkup = await rasterBlobToSvg(blob, {
			maxSampleDimension: 192,
			maxColors: 5,
		});
		const compiled = compileSvgToExcalidraw(svgMarkup, {
			maxPointsPerElement: 36,
			maxElementCount: 60,
			customData: input.customData,
		});
		recordStrategySuccess(input.source, 'svg-trace');
		return {
			...compiled,
			strategy: 'svg-trace',
		};
	} catch (error) {
		failures.push({
			strategy: 'svg-trace',
			message: toErrorMessage(error),
		});
		recordStrategyFailure(input.source, 'svg-trace', error);
	}

	throw createPipelineError(
		'Raster image could not be converted into native vector elements.',
		failures,
	);
}

export function compileSvgMarkupToNativeVector(
	svgMarkup: string,
	input: {
		customData: Record<string, unknown>;
		source: 'stored-svg';
	},
): NativeVectorCompileResult {
	try {
		const compiled = compileSvgToExcalidraw(svgMarkup, {
			customData: input.customData,
		});
		recordStrategySuccess(input.source, 'svg-compile');
		return {
			...compiled,
			strategy: 'svg-compile',
		};
	} catch (error) {
		recordStrategyFailure(input.source, 'svg-compile', error);
		throw createPipelineError('SVG asset could not be converted into native vector elements.', [
			{
				strategy: 'svg-compile',
				message: toErrorMessage(error),
			},
		]);
	}
}

export async function insertNativeVectorElementsOnCanvas({
	compiled,
	excalidrawApi,
	elements,
	selectedElementIds,
}: {
	compiled: NativeVectorCompileResult;
	excalidrawApi: ExcalidrawImperativeAPI;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
}): Promise<AssistantInsertionState> {
	const bounds = getElementsBounds(compiled.elements);
	const sceneCenter = resolveInsertionSceneCenter({
		excalidrawApi,
		elements,
		selectedElementIds,
		width: compiled.width,
		height: compiled.height,
	});
	const positioned = offsetInsertedElements(compiled.elements, {
		x: sceneCenter.x - (bounds.left + bounds.width / 2),
		y: sceneCenter.y - (bounds.top + bounds.height / 2),
	});

	type ElementWithBg = ExcalidrawElement & { backgroundColor?: string };
	const maxLayers = 20;
	const colorMap = new Map<string, ExcalidrawElement[]>();
	for (const element of positioned) {
		const fill = (element as ElementWithBg).backgroundColor ?? 'transparent';
		const group = colorMap.get(fill) ?? [];
		group.push(element);
		colorMap.set(fill, group);
	}

	const sortedGroups = [...colorMap.entries()]
		.map(([color, groupElements]) => ({
			color,
			elements: groupElements,
			area: Math.max(
				...groupElements.map((element) => (element.width ?? 0) * (element.height ?? 0)),
			),
		}))
		.sort((left, right) => {
			if (left.color === 'transparent') return 1;
			if (right.color === 'transparent') return -1;
			return right.area - left.area;
		});

	while (sortedGroups.length > maxLayers) {
		const last = sortedGroups.pop();
		if (!last) {
			break;
		}
		sortedGroups[sortedGroups.length - 1]?.elements.push(...last.elements);
	}

	const overallGroupId =
		(positioned[0] as ExcalidrawElement & { groupIds?: string[] })?.groupIds?.[0] ??
		crypto.randomUUID();
	const layers = sortedGroups.map((group, index) => {
		const layerGroupId = `${overallGroupId}-layer-${index}`;
		return group.elements.map((element) => ({
			...element,
			groupIds: [layerGroupId, overallGroupId],
		})) as ExcalidrawElement[];
	});

	const layerDelayMs = 80;
	const insertedElementIds: string[] = [];

	for (let index = 0; index < layers.length; index += 1) {
		const layer = layers[index];
		const currentElements = excalidrawApi.getSceneElements();
		for (const element of layer) {
			insertedElementIds.push(String(element.id));
		}

		excalidrawApi.updateScene({
			elements: [...currentElements, ...layer],
			appState: {
				isCropping: false,
				croppingElementId: null,
				selectedElementIds: Object.fromEntries(insertedElementIds.map((id) => [id, true])),
			},
		});

		if (index < layers.length - 1) {
			await new Promise<void>((resolve) => {
				setTimeout(resolve, layerDelayMs);
			});
		}
	}

	restoreCanvasSelectionState(excalidrawApi);
	syncAppStoreFromExcalidraw(excalidrawApi);
	return {
		status: 'inserted',
		insertedElementIds,
		insertMode: 'native-vector',
		vectorStrategy: compiled.strategy,
	};
}
