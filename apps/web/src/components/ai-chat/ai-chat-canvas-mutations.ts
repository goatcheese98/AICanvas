import { getViewportSceneCenter } from '@/components/canvas/element-factories';
import { updateSceneAndSyncAppStore } from '@/components/canvas/excalidraw-store-sync';
import { applyOverlayUpdateByType } from '@/components/canvas/overlay-registry';
import { normalizeKanbanOverlay, normalizeMarkdownOverlay } from '@ai-canvas/shared/schemas';
import type { CanvasElement } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { getSelectedSceneBounds, getViewportSceneBounds } from './ai-chat-canvas';
import { clonePatchCustomData } from './ai-chat-helpers';
import type { AssistantInsertionState } from './ai-chat-types';

export function restoreCanvasSelectionState(excalidrawApi: ExcalidrawImperativeAPI) {
	const setActiveTool = (
		excalidrawApi as ExcalidrawImperativeAPI & {
			setActiveTool?: (tool: { type: 'selection'; locked: false }) => void;
		}
	).setActiveTool;
	setActiveTool?.({ type: 'selection', locked: false });
}

export function updateOverlayElementById({
	excalidrawApi,
	setElements: _setElements,
	targetId,
	targetType,
	payload,
}: {
	excalidrawApi: ExcalidrawImperativeAPI | null;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
	targetId: string;
	targetType: 'markdown' | 'kanban' | 'prototype';
	payload: Record<string, unknown>;
}) {
	if (!excalidrawApi) {
		throw new Error('Canvas is not ready yet.');
	}

	const currentElements = excalidrawApi.getSceneElements();
	let previousCustomData: Record<string, unknown> | null = null;
	let didUpdate = false;
	const nextElements = currentElements.map((candidate) => {
		if (candidate.id !== targetId) {
			return candidate;
		}

		previousCustomData = clonePatchCustomData(
			(candidate.customData as Record<string, unknown> | undefined) ?? {},
		);
		didUpdate = true;

		if (targetType === 'markdown') {
			const markdown = normalizeMarkdownOverlay(payload);
			return applyOverlayUpdateByType('markdown', candidate as never, {
				title: markdown.title,
				content: markdown.content,
				images: markdown.images,
				settings: markdown.settings,
				editorMode: markdown.editorMode,
			}) as typeof candidate;
		}

		const board = normalizeKanbanOverlay(payload);
		return applyOverlayUpdateByType('kanban', candidate as never, board) as typeof candidate;
	});

	if (!didUpdate || !previousCustomData) {
		throw new Error('Selected canvas item is no longer available.');
	}

	updateSceneAndSyncAppStore(excalidrawApi, { elements: nextElements }, { elements: nextElements });
	return previousCustomData;
}

export function resolveInsertionSceneCenter({
	excalidrawApi,
	elements,
	selectedElementIds,
	width,
	height,
}: {
	excalidrawApi: ExcalidrawImperativeAPI | null;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
	width: number;
	height: number;
}) {
	if (!excalidrawApi) {
		return { x: 0, y: 0 };
	}

	const appState = excalidrawApi.getAppState();
	const viewportCenter = getViewportSceneCenter(appState);
	const selectionBounds = getSelectedSceneBounds(
		elements as unknown as CanvasElement[],
		selectedElementIds,
	);
	if (!selectionBounds) {
		return viewportCenter;
	}

	const viewportBounds = getViewportSceneBounds(appState as Record<string, unknown>);
	const gap = 72;
	const rightCenterX = selectionBounds.x + selectionBounds.width + gap + width / 2;
	const rightFits = rightCenterX + width / 2 <= viewportBounds.right - 24;
	if (rightFits) {
		return {
			x: rightCenterX,
			y: selectionBounds.y + Math.max(selectionBounds.height, height) / 2,
		};
	}

	return {
		x: selectionBounds.x + width / 2,
		y: selectionBounds.y + selectionBounds.height + gap + height / 2,
	};
}

export function applyInsertedElements({
	excalidrawApi,
	setElements: _setElements,
	insertedElements,
}: {
	excalidrawApi: ExcalidrawImperativeAPI;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
	insertedElements: readonly ExcalidrawElement[];
}) {
	const currentElements = excalidrawApi.getSceneElements();
	const insertedElementIds = insertedElements.map((element) => String(element.id));
	const nextElements = [...currentElements, ...insertedElements];
	const nextAppState = {
		...excalidrawApi.getAppState(),
		isCropping: false,
		croppingElementId: null,
		selectedElementIds: Object.fromEntries(
			insertedElementIds.map((id) => [id, true] as const),
		) as Record<string, true>,
	} as Partial<AppState>;
	updateSceneAndSyncAppStore(
		excalidrawApi,
		{
			elements: nextElements,
			appState: {
				isCropping: false,
				croppingElementId: null,
				selectedElementIds: nextAppState.selectedElementIds,
			},
		},
		{
			elements: nextElements,
			appState: nextAppState,
		},
	);
	restoreCanvasSelectionState(excalidrawApi);
	return {
		status: 'inserted',
		insertedElementIds,
	} satisfies AssistantInsertionState;
}

export function removeInsertedArtifactFromScene({
	excalidrawApi,
	setElements: _setElements,
	insertionState,
}: {
	excalidrawApi: ExcalidrawImperativeAPI;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
	insertionState: AssistantInsertionState;
}) {
	const nextElements = excalidrawApi
		.getSceneElements()
		.filter((element) => !insertionState.insertedElementIds.includes(String(element.id)));
	const currentFiles = excalidrawApi.getFiles();
	const nextFiles = { ...currentFiles };
	for (const fileId of insertionState.insertedFileIds ?? []) {
		delete nextFiles[fileId];
	}

	const nextAppState = {
		...excalidrawApi.getAppState(),
		isCropping: false,
		croppingElementId: null,
		selectedElementIds: {},
	};
	updateSceneAndSyncAppStore(
		excalidrawApi,
		{
			elements: nextElements,
			appState: {
				isCropping: false,
				croppingElementId: null,
				selectedElementIds: {},
			},
		},
		{
			elements: nextElements,
			appState: nextAppState,
			files: nextFiles,
		},
	);
	restoreCanvasSelectionState(excalidrawApi);
}
