import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ProjectResource } from './types';

const DEFAULT_CANVAS_NAME = 'Overview Canvas';
const DEFAULT_PROTOTYPE_NAME = 'Prototype';

function getResourceName(value: unknown, fallback: string) {
	if (typeof value !== 'string') {
		return fallback;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : fallback;
}

export function buildCanvasProjectResources({
	canvasId,
	canvasTitle,
	elements,
}: {
	canvasId: string;
	canvasTitle?: string | null;
	elements: readonly ExcalidrawElement[];
}): ProjectResource[] {
	const resources: ProjectResource[] = [
		{
			id: canvasId,
			type: 'canvas',
			name: getResourceName(canvasTitle, DEFAULT_CANVAS_NAME),
		},
	];
	const seenResourceIds = new Set<string>([canvasId]);

	for (const element of elements) {
		if (element.isDeleted) {
			continue;
		}

		const customData = element.customData as { type?: unknown; title?: unknown } | undefined;
		if (customData?.type !== 'prototype') {
			continue;
		}

		if (seenResourceIds.has(element.id)) {
			continue;
		}

		seenResourceIds.add(element.id);
		resources.push({
			id: element.id,
			type: 'prototype',
			name: getResourceName(customData.title, DEFAULT_PROTOTYPE_NAME),
		});
	}

	return resources;
}

export function getActiveProjectResourceName(
	resources: readonly ProjectResource[],
	activeResourceId: string,
	fallback: string,
) {
	return resources.find((resource) => resource.id === activeResourceId)?.name ?? fallback;
}
