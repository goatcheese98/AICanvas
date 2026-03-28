import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ProjectResource } from './types';

function getProjectResourceName(element: ExcalidrawElement, fallback: string) {
	const customData = element.customData as
		| { title?: unknown; type?: unknown; resourceSnapshot?: { title?: unknown } }
		| undefined;
	const snapshotTitle = customData?.resourceSnapshot?.title;
	if (typeof snapshotTitle === 'string' && snapshotTitle.trim().length > 0) {
		return snapshotTitle;
	}

	if (typeof customData?.title === 'string' && customData.title.trim().length > 0) {
		return customData.title;
	}
	return fallback;
}

export function buildProjectResources({
	canvasId,
	canvasName,
	elements,
}: {
	canvasId: string;
	canvasName: string;
	elements: readonly ExcalidrawElement[];
}): ProjectResource[] {
	const resources: ProjectResource[] = [
		{
			id: canvasId,
			type: 'canvas',
			name: canvasName,
		},
	];

	for (const element of normalizeSceneElements(elements)) {
		const type = (element.customData as { type?: unknown } | undefined)?.type;
		if (element.isDeleted) {
			continue;
		}

		if (type === 'kanban') {
			resources.push({
				id: element.id,
				type: 'board',
				name: getProjectResourceName(element, 'Untitled Board'),
			});
		} else if (type === 'newlex') {
			resources.push({
				id: element.id,
				type: 'document',
				name: getProjectResourceName(element, 'Untitled Document'),
			});
		} else if (type === 'prototype') {
			resources.push({
				id: element.id,
				type: 'prototype',
				name: getProjectResourceName(element, 'Untitled Prototype'),
			});
		}
	}

	return resources;
}
