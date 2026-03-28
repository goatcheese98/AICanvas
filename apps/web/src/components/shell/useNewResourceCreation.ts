import {
	createOverlayElementDraft,
	getViewportSceneCenter,
} from '@/components/canvas/element-factories';
import { useAppStore } from '@/stores/store';
import type { OverlayType } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useCallback, useState } from 'react';

export type ResourceCreationType =
	| 'canvas'
	| 'board'
	| 'document'
	| 'prototype'
	| 'quick-note'
	| 'web-embed';

interface CreateResourceOptions {
	type: ResourceCreationType;
}

interface CreateResourceResult {
	success: boolean;
	elementId?: string;
	error?: Error;
}

interface UseNewResourceCreationOptions {
	canvasId: string;
	onSuccess?: (resource: { id: string; type: ResourceCreationType }, type: string) => void;
	onError?: (error: Error) => void;
}

interface UseNewResourceCreationReturn {
	createResource: (options: CreateResourceOptions) => Promise<CreateResourceResult>;
	isCreating: boolean;
}

// Map resource types to overlay types
const RESOURCE_TO_OVERLAY_TYPE: Record<
	Exclude<ResourceCreationType, 'canvas'>,
	OverlayType | 'prototype'
> = {
	board: 'kanban',
	document: 'newlex',
	prototype: 'prototype',
	'quick-note': 'markdown',
	'web-embed': 'web-embed',
};

export function useNewResourceCreation({
	onSuccess,
	onError,
}: UseNewResourceCreationOptions): UseNewResourceCreationReturn {
	const [isCreating, setIsCreating] = useState(false);
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const appState = useAppStore((s) => s.appState);
	const setElements = useAppStore((s) => s.setElements);

	const createResource = useCallback(
		async (options: CreateResourceOptions): Promise<CreateResourceResult> => {
			const { type } = options;

			// Canvas creation is handled separately (navigates to dashboard)
			if (type === 'canvas') {
				return { success: true };
			}

			if (!excalidrawApi) {
				const error = new Error('Canvas is not ready');
				onError?.(error);
				return { success: false, error };
			}

			setIsCreating(true);

			try {
				// Get current elements
				const currentElements = excalidrawApi.getSceneElements();

				// Get viewport center for element placement
				const sceneCenter = getViewportSceneCenter(appState);

				// Get overlay type
				const overlayType = RESOURCE_TO_OVERLAY_TYPE[type];

				// Prepare custom data based on resource type
				let customData: Record<string, unknown> | undefined;

				switch (type) {
					case 'board':
						customData = {
							title: 'New Board',
							columns: [
								{
									id: crypto.randomUUID(),
									title: 'To Do',
									cards: [],
								},
								{
									id: crypto.randomUUID(),
									title: 'In Progress',
									cards: [],
								},
								{
									id: crypto.randomUUID(),
									title: 'Done',
									cards: [],
								},
							],
						};
						break;
					case 'document':
						customData = {
							title: 'New Document',
							lexicalState: '',
							comments: [],
							commentsPanelOpen: false,
							version: 1,
						};
						break;
					case 'prototype':
						customData = {
							title: 'New Prototype',
							template: 'react',
							files: {
								'App.tsx': {
									code: `export default function App() {\n  return (\n    <div style={{ padding: '2rem' }}>\n      <h1>Hello World</h1>\n      <p>Start building your prototype here</p>\n    </div>\n  );\n}`,
									active: true,
								},
							},
							dependencies: {},
						};
						break;
					case 'quick-note':
						customData = {
							title: 'Quick Note',
							content: '# Quick Note\n\nDouble-click to edit this note.',
						};
						break;
					case 'web-embed':
						customData = {
							url: '',
						};
						break;
				}

				// Handle prototype type separately (not in overlay types)
				if (type === 'prototype') {
					// For prototype, we create a custom element using the factory helper pattern
					const draft = createOverlayElementDraft(
						'kanban', // Use kanban as base for prototype card since prototype isn't in overlay-definitions
						sceneCenter,
						{
							type: 'prototype',
							...customData,
						},
					);

					// Override the type in customData since we're using kanban as base
					const newElement = {
						...draft,
						customData: {
							type: 'prototype',
							...customData,
						},
					} as unknown as ExcalidrawElement;

					const nextElements = [...currentElements, newElement];

					excalidrawApi.updateScene({
						elements: nextElements,
						appState: {
							selectedElementIds: { [draft.id]: true },
						},
					});

					setElements(nextElements);

					onSuccess?.({ id: draft.id, type }, type);

					return { success: true, elementId: draft.id };
				}

				// For standard overlay types, use the factory
				const draft = createOverlayElementDraft(
					overlayType as OverlayType,
					sceneCenter,
					customData,
				);

				const newElement = draft as unknown as ExcalidrawElement;
				const nextElements = [...currentElements, newElement];

				excalidrawApi.updateScene({
					elements: nextElements,
					appState: {
						selectedElementIds: { [draft.id]: true },
					},
				});

				setElements(nextElements);

				onSuccess?.({ id: draft.id, type }, type);

				return { success: true, elementId: draft.id };
			} catch (error) {
				const err = error instanceof Error ? error : new Error('Failed to create resource');
				onError?.(err);
				return { success: false, error: err };
			} finally {
				setIsCreating(false);
			}
		},
		[excalidrawApi, appState, setElements, onSuccess, onError],
	);

	return { createResource, isCreating };
}
