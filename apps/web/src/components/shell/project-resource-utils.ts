import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { normalizeSceneElements } from '@/components/canvas/scene-element-normalizer';
import type { ProjectResource } from './types';

function getProjectResourceName(element: ExcalidrawElement, fallback: string) {
	const customData = element.customData as { title?: unknown; type?: unknown } | undefined;
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
		if (element.isDeleted || type !== 'kanban') {
			continue;
		}

		resources.push({
			id: element.id,
			type: 'board',
			name: getProjectResourceName(element, 'Untitled Board'),
		});
	}

	return resources;
}
