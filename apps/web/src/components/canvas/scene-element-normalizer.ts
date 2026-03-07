import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export function normalizeSceneElement<T extends ExcalidrawElement>(element: T): T {
	return {
		...element,
		index:
			'index' in element && typeof (element as ExcalidrawElement & { index?: string }).index === 'string'
				? (element as ExcalidrawElement & { index?: string }).index!
				: ('a0' as any),
		angle: typeof element.angle === 'number' ? element.angle : 0,
		strokeColor: element.strokeColor ?? '#000000',
		backgroundColor: element.backgroundColor ?? '#ffffff',
		fillStyle: element.fillStyle ?? 'solid',
		strokeWidth: typeof element.strokeWidth === 'number' ? element.strokeWidth : 1,
		strokeStyle: element.strokeStyle ?? 'solid',
		roughness: typeof element.roughness === 'number' ? element.roughness : 0,
		opacity: typeof element.opacity === 'number' ? element.opacity : 100,
		groupIds: Array.isArray((element as ExcalidrawElement).groupIds)
			? (element as ExcalidrawElement).groupIds
			: [],
		frameId:
			'frameId' in element
				? ((element as ExcalidrawElement & { frameId?: string | null }).frameId ?? null)
				: null,
		roundness:
			'roundness' in element
				? ((element as ExcalidrawElement & { roundness?: unknown }).roundness ?? null)
				: null,
		boundElements:
			'boundElements' in element
				? ((element as ExcalidrawElement & { boundElements?: unknown }).boundElements ?? null)
				: null,
		updated:
			'updated' in element && typeof (element as ExcalidrawElement & { updated?: number }).updated === 'number'
				? (element as ExcalidrawElement & { updated?: number }).updated!
				: Date.now(),
		link:
			'link' in element
				? ((element as ExcalidrawElement & { link?: string | null }).link ?? null)
				: null,
		locked: Boolean(element.locked),
		version: typeof element.version === 'number' ? element.version : 1,
		versionNonce:
			typeof element.versionNonce === 'number'
				? element.versionNonce
				: Math.floor(Math.random() * 2 ** 31),
		isDeleted: Boolean((element as ExcalidrawElement & { isDeleted?: boolean }).isDeleted),
		seed:
			'seed' in element && typeof (element as ExcalidrawElement & { seed?: number }).seed === 'number'
				? (element as ExcalidrawElement & { seed?: number }).seed!
				: Math.floor(Math.random() * 100000),
	} as T;
}

export function normalizeSceneElements(elements: readonly ExcalidrawElement[]): ExcalidrawElement[] {
	return elements.map((element) => normalizeSceneElement(element));
}
