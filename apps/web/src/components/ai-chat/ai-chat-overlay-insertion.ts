import {
	createOverlayElementDraft,
	getOverlayDefaults,
} from '@/components/canvas/element-factories';
import { syncAppStoreFromExcalidraw } from '@/components/canvas/excalidraw-store-sync';
import { normalizeKanbanOverlay } from '@ai-canvas/shared/schemas';
import type { AssistantArtifact } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
	BinaryFileData,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import {
	createCanvasImageElement,
	getConvertToExcalidrawElements,
	getSelectedKanbanElement,
} from './ai-chat-canvas';
import {
	applyInsertedElements,
	resolveInsertionSceneCenter,
	restoreCanvasSelectionState,
} from './ai-chat-canvas-mutations';
import type { AssistantInsertionState, DiagramInsertInput } from './ai-chat-types';
import { buildKanbanFromArtifact } from './assistant-artifacts';

export async function insertMarkdownOnCanvas({
	content,
	excalidrawApi,
	elements,
	selectedElementIds,
	setElements,
}: {
	content: string;
	excalidrawApi: ExcalidrawImperativeAPI;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
}): Promise<AssistantInsertionState> {
	const convertToExcalidrawElements = await getConvertToExcalidrawElements();
	const { width, height } = getOverlayDefaults('markdown');
	const sceneCenter = resolveInsertionSceneCenter({
		excalidrawApi,
		elements,
		selectedElementIds,
		width,
		height,
	});
	const draft = createOverlayElementDraft('markdown', sceneCenter, { content });
	const converted = convertToExcalidrawElements([draft as never]);
	return applyInsertedElements({
		excalidrawApi,
		setElements,
		insertedElements: converted,
	});
}

export async function insertRenderedDiagramOnCanvas({
	input,
	excalidrawApi,
	elements,
	selectedElementIds,
	setFiles,
}: {
	input: DiagramInsertInput;
	excalidrawApi: ExcalidrawImperativeAPI;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
	setFiles: (files: BinaryFiles) => void;
}): Promise<AssistantInsertionState> {
	const dataURL = input.svgMarkup as unknown as BinaryFileData['dataURL'];
	const fileId = crypto.randomUUID() as BinaryFileData['id'];
	const now = Date.now();
	const imageFile: BinaryFileData = {
		id: fileId,
		mimeType: 'image/svg+xml',
		dataURL,
		created: now,
	};
	const currentElements = excalidrawApi.getSceneElements();
	const currentFiles = excalidrawApi.getFiles();
	const width = Math.max(200, Math.round(input.width));
	const height = Math.max(120, Math.round(input.height));
	const sceneCenter = resolveInsertionSceneCenter({
		excalidrawApi,
		elements,
		selectedElementIds,
		width,
		height,
	});
	const imageElement = createCanvasImageElement({
		fileId,
		x: sceneCenter.x - width / 2,
		y: sceneCenter.y - height / 2,
		width,
		height,
		customData: {
			type: 'ai-generated-diagram',
			title: input.title,
			language: input.diagram.language,
			code: input.diagram.code,
		},
	});

	excalidrawApi.addFiles([imageFile]);
	excalidrawApi.updateScene({
		elements: [...currentElements, imageElement],
		appState: {
			isCropping: false,
			croppingElementId: null,
			selectedElementIds: { [imageElement.id]: true },
		},
	});
	restoreCanvasSelectionState(excalidrawApi);
	syncAppStoreFromExcalidraw(excalidrawApi);
	setFiles({
		...currentFiles,
		[fileId]: imageFile,
	});

	return {
		status: 'inserted',
		insertedElementIds: [String(imageElement.id)],
		insertedFileIds: [fileId],
	};
}

export async function insertKanbanArtifactOnCanvas({
	artifact,
	excalidrawApi,
	elements,
	selectedElementIds,
	setElements,
}: {
	artifact: AssistantArtifact;
	excalidrawApi: ExcalidrawImperativeAPI;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
}): Promise<AssistantInsertionState> {
	const convertToExcalidrawElements = await getConvertToExcalidrawElements();
	const { width, height } = getOverlayDefaults('kanban');
	const currentElements = excalidrawApi.getSceneElements();
	const sceneCenter = resolveInsertionSceneCenter({
		excalidrawApi,
		elements,
		selectedElementIds,
		width,
		height,
	});
	const selectedKanban = getSelectedKanbanElement(
		currentElements as unknown as Record<string, unknown>[],
		selectedElementIds,
	);
	const draft = createOverlayElementDraft(
		'kanban',
		sceneCenter,
		buildKanbanFromArtifact(
			artifact,
			selectedKanban
				? normalizeKanbanOverlay(selectedKanban.customData as Record<string, unknown>)
				: undefined,
		) as unknown as Record<string, unknown>,
	);
	const converted = convertToExcalidrawElements([draft as never]);
	return applyInsertedElements({
		excalidrawApi,
		setElements,
		insertedElements: converted,
	});
}
