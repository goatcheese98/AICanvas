import { normalizeMarkdownOverlay, normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { CanvasElement } from '@ai-canvas/shared/types';
import type { BinaryFileData } from '@excalidraw/excalidraw/types';

let convertToExcalidrawElementsLoader: Promise<
	typeof import('@excalidraw/excalidraw')['convertToExcalidrawElements']
> | null = null;

export function resolveMarkdownContentFromElements(
	elements: readonly CanvasElement[],
	targetId: string,
): string | null {
	const match = elements.find((candidate) => String(candidate.id) === targetId);
	if (!match) {
		return null;
	}

	const customData = (match.customData as Record<string, unknown> | undefined) ?? {};
	if (customData.type !== 'markdown') {
		return null;
	}

	return normalizeMarkdownOverlay(customData).content;
}

export function resolvePrototypeOverlayFromElements(
	elements: readonly CanvasElement[],
	targetId: string,
) {
	const match = elements.find((candidate) => String(candidate.id) === targetId);
	if (!match) {
		return null;
	}

	const customData = (match.customData as Record<string, unknown> | undefined) ?? {};
	if (customData.type !== 'prototype') {
		return null;
	}

	return normalizePrototypeOverlay(customData);
}

export function getSelectedPrototypeElement(
	elements: readonly Record<string, unknown>[],
	selectedElementIds: Record<string, boolean>,
) {
	const selectedElements = elements.filter(
		(candidate) =>
			selectedElementIds[String(candidate.id)] === true &&
			(candidate.customData as { type?: string } | undefined)?.type === 'prototype',
	);

	return selectedElements.length === 1 ? selectedElements[0] : null;
}

export function getSelectedKanbanElement(
	elements: readonly Record<string, unknown>[],
	selectedElementIds: Record<string, boolean>,
) {
	const selectedElements = elements.filter(
		(candidate) =>
			selectedElementIds[String(candidate.id)] === true &&
			(candidate.customData as { type?: string } | undefined)?.type === 'kanban',
	);

	return selectedElements.length === 1 ? selectedElements[0] : null;
}

export async function getConvertToExcalidrawElements() {
	if (!convertToExcalidrawElementsLoader) {
		convertToExcalidrawElementsLoader = import('@excalidraw/excalidraw').then(
			(module) => module.convertToExcalidrawElements,
		);
	}

	return convertToExcalidrawElementsLoader;
}

export function createCanvasImageElement(input: {
	fileId: BinaryFileData['id'];
	x: number;
	y: number;
	width: number;
	height: number;
	customData?: Record<string, unknown>;
}) {
	return {
		id: crypto.randomUUID(),
		type: 'image' as const,
		fileId: input.fileId,
		status: 'saved' as const,
		scale: [1, 1] as [number, number],
		crop: null,
		x: input.x,
		y: input.y,
		width: input.width,
		height: input.height,
		angle: 0,
		strokeColor: 'transparent',
		backgroundColor: 'transparent',
		fillStyle: 'solid' as const,
		strokeWidth: 0,
		strokeStyle: 'solid' as const,
		roughness: 0,
		opacity: 100,
		roundness: null,
		seed: Math.floor(Math.random() * 100000),
		version: 1,
		versionNonce: Math.floor(Math.random() * 2 ** 31),
		isDeleted: false,
		groupIds: [],
		frameId: null,
		boundElements: null,
		updated: Date.now(),
		link: null,
		locked: false,
		index: `a${Date.now()}` as never,
		...(input.customData ? { customData: input.customData } : {}),
	} as const;
}

export function getSelectedSceneBounds(
	elements: readonly CanvasElement[],
	selectedIds: Record<string, boolean>,
) {
	const selectedBounds = elements
		.filter((element) => selectedIds[String(element.id)] === true)
		.map((element) => {
			const x = typeof element.x === 'number' ? element.x : null;
			const y = typeof element.y === 'number' ? element.y : null;
			const width = typeof element.width === 'number' ? Math.abs(element.width) : 0;
			const height = typeof element.height === 'number' ? Math.abs(element.height) : 0;
			return x == null || y == null ? null : { x, y, width, height };
		})
		.filter(Boolean) as Array<{ x: number; y: number; width: number; height: number }>;

	if (selectedBounds.length === 0) {
		return null;
	}

	const left = Math.min(...selectedBounds.map((item) => item.x));
	const top = Math.min(...selectedBounds.map((item) => item.y));
	const right = Math.max(...selectedBounds.map((item) => item.x + item.width));
	const bottom = Math.max(...selectedBounds.map((item) => item.y + item.height));
	return {
		x: left,
		y: top,
		width: right - left,
		height: bottom - top,
	};
}

export function getViewportSceneBounds(appState: Record<string, unknown>) {
	const view = appState as {
		zoom?: { value?: number };
		scrollX?: number;
		scrollY?: number;
		width?: number;
		height?: number;
	};

	const zoomValue =
		typeof view.zoom?.value === 'number' && view.zoom.value > 0 ? view.zoom.value : 1;
	const scrollX = typeof view.scrollX === 'number' ? view.scrollX : 0;
	const scrollY = typeof view.scrollY === 'number' ? view.scrollY : 0;
	const width = typeof view.width === 'number' ? view.width : 1280;
	const height = typeof view.height === 'number' ? view.height : 720;

	return {
		left: -scrollX,
		top: -scrollY,
		right: -scrollX + width / zoomValue,
		bottom: -scrollY + height / zoomValue,
	};
}
