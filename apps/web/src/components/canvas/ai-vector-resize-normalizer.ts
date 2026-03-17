import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

type ElementWithCustomData = ExcalidrawElement & {
	customData?: Record<string, unknown>;
	groupIds?: string[];
	points?: readonly (readonly [number, number])[];
	lastCommittedPoint?: readonly [number, number] | null;
};

function isAiGeneratedVectorElement(element: ExcalidrawElement) {
	const customData = (element as ElementWithCustomData).customData;
	return customData?.type === 'ai-generated-vector-elements';
}

function getPrimaryGroupId(element: ExcalidrawElement) {
	const groupIds = (element as ElementWithCustomData).groupIds;
	return Array.isArray(groupIds) && groupIds.length > 0 ? groupIds[0] : null;
}

function getBounds(elements: readonly ExcalidrawElement[]) {
	const left = Math.min(...elements.map((element) => element.x));
	const top = Math.min(...elements.map((element) => element.y));
	const right = Math.max(...elements.map((element) => element.x + Math.abs(element.width)));
	const bottom = Math.max(...elements.map((element) => element.y + Math.abs(element.height)));
	return {
		left,
		top,
		right,
		bottom,
		width: Math.max(1, right - left),
		height: Math.max(1, bottom - top),
	};
}

function scaleLinearPoints(
	points: readonly (readonly [number, number])[] | undefined,
	scale: number,
) {
	return points?.map(([x, y]) => [x * scale, y * scale] as const);
}

function scaleElementUniformly(
	previousElement: ExcalidrawElement,
	currentElement: ExcalidrawElement,
	previousBounds: ReturnType<typeof getBounds>,
	targetBounds: ReturnType<typeof getBounds>,
	scale: number,
	offsetX: number,
	offsetY: number,
) {
	const relativeX = previousElement.x - previousBounds.left;
	const relativeY = previousElement.y - previousBounds.top;
	const nextX = targetBounds.left + offsetX + relativeX * scale;
	const nextY = targetBounds.top + offsetY + relativeY * scale;

	if (currentElement.type === 'line' || currentElement.type === 'arrow') {
		const previousLinear = previousElement as ElementWithCustomData;
		const currentLinear = currentElement as ElementWithCustomData;
		const scaledPoints = scaleLinearPoints(previousLinear.points, scale);
		return {
			...currentElement,
			x: nextX,
			y: nextY,
			width: previousElement.width * scale,
			height: previousElement.height * scale,
			points: scaledPoints,
			lastCommittedPoint: previousLinear.lastCommittedPoint
				? [
						previousLinear.lastCommittedPoint[0] * scale,
						previousLinear.lastCommittedPoint[1] * scale,
					]
				: currentLinear.lastCommittedPoint ?? null,
			strokeWidth: Math.max(1, previousElement.strokeWidth * scale),
		} as ExcalidrawElement;
	}

	if (currentElement.type === 'freedraw') {
		const previousFreeDraw = previousElement as ElementWithCustomData;
		return {
			...currentElement,
			x: nextX,
			y: nextY,
			width: previousElement.width * scale,
			height: previousElement.height * scale,
			points: scaleLinearPoints(previousFreeDraw.points, scale) ?? [],
			lastCommittedPoint: previousFreeDraw.lastCommittedPoint
				? [
						previousFreeDraw.lastCommittedPoint[0] * scale,
						previousFreeDraw.lastCommittedPoint[1] * scale,
					]
				: null,
			strokeWidth: Math.max(1, previousElement.strokeWidth * scale),
		} as ExcalidrawElement;
	}

	return {
		...currentElement,
		x: nextX,
		y: nextY,
		width: previousElement.width * scale,
		height: previousElement.height * scale,
		strokeWidth: Math.max(1, previousElement.strokeWidth * scale),
	} as ExcalidrawElement;
}

export function normalizeAiVectorGroupResize(params: {
	previousElements: readonly ExcalidrawElement[];
	nextElements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
}) {
	const selectedIds = Object.entries(params.selectedElementIds)
		.filter(([, isSelected]) => isSelected)
		.map(([id]) => id);

	if (selectedIds.length < 2) {
		return null;
	}

	const selectedElements = params.nextElements.filter((element) => selectedIds.includes(element.id));
	if (selectedElements.length !== selectedIds.length) {
		return null;
	}

	if (!selectedElements.every((element) => isAiGeneratedVectorElement(element))) {
		return null;
	}

	const groupId = getPrimaryGroupId(selectedElements[0]);
	if (!groupId || !selectedElements.every((element) => getPrimaryGroupId(element) === groupId)) {
		return null;
	}

	const nextGroup = params.nextElements.filter(
		(element) => isAiGeneratedVectorElement(element) && getPrimaryGroupId(element) === groupId,
	);
	if (nextGroup.length !== selectedElements.length) {
		return null;
	}

	const previousGroup = params.previousElements.filter(
		(element) => isAiGeneratedVectorElement(element) && getPrimaryGroupId(element) === groupId,
	);
	if (previousGroup.length !== nextGroup.length) {
		return null;
	}

	const previousById = new Map(previousGroup.map((element) => [element.id, element] as const));
	if (nextGroup.some((element) => !previousById.has(element.id))) {
		return null;
	}

	const previousBounds = getBounds(previousGroup);
	const nextBounds = getBounds(nextGroup);

	// Skip if the group hasn't meaningfully changed size (avoid infinite update loops).
	const widthRatio = nextBounds.width / previousBounds.width;
	const heightRatio = nextBounds.height / previousBounds.height;
	if (Math.abs(widthRatio - 1) < 0.001 && Math.abs(heightRatio - 1) < 0.001) {
		return null;
	}

	// Always enforce uniform scale so all sub-elements resize together.
	// Excalidraw's native group resize does not reliably re-scale `line` element
	// point arrays, so we must always apply the correction here.
	const scale = Math.min(widthRatio, heightRatio);
	const scaledWidth = previousBounds.width * scale;
	const scaledHeight = previousBounds.height * scale;
	const offsetX = (nextBounds.width - scaledWidth) / 2;
	const offsetY = (nextBounds.height - scaledHeight) / 2;

	const replacementById = new Map(
		nextGroup.map((currentElement) => {
			const previousElement = previousById.get(currentElement.id) ?? currentElement;
			return [
				currentElement.id,
				scaleElementUniformly(
					previousElement,
					currentElement,
					previousBounds,
					nextBounds,
					scale,
					offsetX,
					offsetY,
				),
			] as const;
		}),
	);

	return params.nextElements.map((element) => replacementById.get(element.id) ?? element);
}
