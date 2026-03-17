import { syncAppStoreFromExcalidraw } from '@/components/canvas/excalidraw-store-sync';
import { vectorizeRasterBlobToSvg } from '@/lib/assistant/raster-to-svg';
import { vectorizeRasterBlobToSketchElements } from '@/lib/assistant/sketch-vectorizer';
import { compileSvgToExcalidraw } from '@/lib/assistant/svg-to-excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
	resolveInsertionSceneCenter,
	restoreCanvasSelectionState,
} from './ai-chat-canvas-mutations';
import type { AssistantInsertionState } from './ai-chat-types';

export interface NativeVectorCompileResult {
	elements: ExcalidrawElement[];
	width: number;
	height: number;
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

export async function compileRasterBlobToNativeVector(
	blob: Blob,
	customData: Record<string, unknown>,
): Promise<NativeVectorCompileResult> {
	try {
		return await vectorizeRasterBlobToSketchElements(blob, {
			controls: { colorPalette: 10 },
			customData,
		});
	} catch {
		const svgMarkup = await vectorizeRasterBlobToSvg(blob, {
			maxSampleDimension: 192,
			maxColors: 5,
		});
		return compileSvgToExcalidraw(svgMarkup, {
			maxPointsPerElement: 36,
			maxElementCount: 60,
			customData,
		});
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
	return { status: 'inserted', insertedElementIds };
}
