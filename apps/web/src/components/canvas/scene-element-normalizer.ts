import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

type SceneElementLike = ExcalidrawElement & {
	index?: string;
	groupIds?: unknown;
	frameId?: string | null;
	roundness?: unknown;
	boundElements?: unknown;
	updated?: number;
	link?: string | null;
	isDeleted?: boolean;
	seed?: number;
};

// Reject timestamp-style fractional indices like `a1773614343380` (letter + many digits).
// Valid fractional-index keys are short (e.g. `a0`, `V`, `Zz`) — not unix timestamps.
function isValidFractionalIndex(idx: string): boolean {
	if (!idx) return false;
	if (idx.length > 20) return false;
	// Single letter followed by 7+ digits → almost certainly a Date.now() timestamp
	if (/^[a-zA-Z]\d{7,}$/.test(idx)) return false;
	return true;
}

function normalizeIndex(index?: string): ExcalidrawElement['index'] {
	return (index && isValidFractionalIndex(index) ? index : 'a0') as ExcalidrawElement['index'];
}

function numberOrFallback(value: unknown, fallback: number): number {
	return typeof value === 'number' ? value : fallback;
}

function nullableValue<T>(value: T | null | undefined): T | null {
	return value ?? null;
}

function normalizeGroupIds(groupIds: unknown): string[] {
	return Array.isArray(groupIds) ? groupIds : [];
}

export function normalizeSceneElement<T extends ExcalidrawElement>(element: T): T {
	const sceneElement = element as SceneElementLike;

	return {
		...element,
		index: normalizeIndex(sceneElement.index),
		angle: numberOrFallback(sceneElement.angle, 0),
		strokeColor: sceneElement.strokeColor ?? '#000000',
		backgroundColor: sceneElement.backgroundColor ?? '#ffffff',
		fillStyle: sceneElement.fillStyle ?? 'solid',
		strokeWidth: numberOrFallback(sceneElement.strokeWidth, 1),
		strokeStyle: sceneElement.strokeStyle ?? 'solid',
		roughness: numberOrFallback(sceneElement.roughness, 0),
		opacity: numberOrFallback(sceneElement.opacity, 100),
		groupIds: normalizeGroupIds(sceneElement.groupIds),
		frameId: nullableValue(sceneElement.frameId),
		roundness: nullableValue(sceneElement.roundness),
		boundElements: nullableValue(sceneElement.boundElements),
		updated: numberOrFallback(sceneElement.updated, Date.now()),
		link: nullableValue(sceneElement.link),
		locked: Boolean(sceneElement.locked),
		version: numberOrFallback(sceneElement.version, 1),
		versionNonce: numberOrFallback(sceneElement.versionNonce, Math.floor(Math.random() * 2 ** 31)),
		isDeleted: Boolean(sceneElement.isDeleted),
		seed: numberOrFallback(sceneElement.seed, Math.floor(Math.random() * 100000)),
	} as T;
}

export function normalizeSceneElements(
	elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
	return elements.map((element) => normalizeSceneElement(element));
}
