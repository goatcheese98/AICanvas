import {
	createOverlayElementDraft,
	getOverlayDefaults,
	getViewportSceneCenter,
} from '@/components/canvas/element-factories';
import { syncAppStoreFromExcalidraw } from '@/components/canvas/excalidraw-store-sync';
import { applyOverlayUpdateByType } from '@/components/canvas/overlay-registry';
import type { AssistantArtifact, PrototypeOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { getConvertToExcalidrawElements, getSelectedPrototypeElement } from './ai-chat-canvas';
import { applyInsertedElements, resolveInsertionSceneCenter } from './ai-chat-canvas-mutations';
import type { AssistantInsertionState } from './ai-chat-types';
import {
	buildPrototypeFromArtifact,
	buildPrototypeFromMessageContent,
} from './assistant-artifacts';

interface PrototypeInsertionContext {
	excalidrawApi: ExcalidrawImperativeAPI;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
}

function applyPrototypeToSelectedElement({
	excalidrawApi,
	selectedPrototypeId,
	prototype,
}: {
	excalidrawApi: ExcalidrawImperativeAPI;
	selectedPrototypeId: string;
	prototype: PrototypeOverlayCustomData;
}) {
	const currentElements = excalidrawApi.getSceneElements();
	const nextElements = currentElements.map((candidate) =>
		candidate.id === selectedPrototypeId
			? (applyOverlayUpdateByType('prototype', candidate as never, {
					title: prototype.title,
					template: prototype.template,
					files: prototype.files,
					dependencies: prototype.dependencies,
					preview: prototype.preview,
					activeFile: prototype.activeFile,
					showEditor: prototype.showEditor,
					showPreview: prototype.showPreview,
				}) as typeof candidate)
			: candidate,
	);
	excalidrawApi.updateScene({ elements: nextElements });
	syncAppStoreFromExcalidraw(excalidrawApi);
}

export async function insertPrototypeArtifactOnCanvas({
	artifact,
	excalidrawApi,
	elements,
	selectedElementIds,
	setElements,
}: PrototypeInsertionContext & { artifact: AssistantArtifact }): Promise<AssistantInsertionState> {
	const prototype = buildPrototypeFromArtifact(artifact);
	const currentElements = excalidrawApi.getSceneElements();
	const selectedPrototype = getSelectedPrototypeElement(
		currentElements as unknown as Record<string, unknown>[],
		selectedElementIds,
	);

	if (selectedPrototype) {
		applyPrototypeToSelectedElement({
			excalidrawApi,
			selectedPrototypeId: String(selectedPrototype.id),
			prototype,
		});
		return {
			status: 'inserted',
			insertedElementIds: [String(selectedPrototype.id)],
		};
	}

	const convertToExcalidrawElements = await getConvertToExcalidrawElements();
	const { width, height } = getOverlayDefaults('prototype');
	const sceneCenter = resolveInsertionSceneCenter({
		excalidrawApi,
		elements,
		selectedElementIds,
		width,
		height,
	});
	const draft = createOverlayElementDraft(
		'prototype',
		sceneCenter,
		prototype as unknown as Record<string, unknown>,
	);
	const converted = convertToExcalidrawElements([draft as never]);
	return applyInsertedElements({
		excalidrawApi,
		setElements,
		insertedElements: converted,
	});
}

export async function insertPrototypeMessageOnCanvas({
	messageContent,
	excalidrawApi,
	selectedElementIds,
}: Omit<PrototypeInsertionContext, 'elements' | 'setElements'> & {
	messageContent: string;
}): Promise<void> {
	const prototype = buildPrototypeFromMessageContent(messageContent);
	if (!prototype) {
		return;
	}

	const convertToExcalidrawElements = await getConvertToExcalidrawElements();
	const sceneCenter = getViewportSceneCenter(excalidrawApi.getAppState());
	const currentElements = excalidrawApi.getSceneElements();
	const selectedPrototype = getSelectedPrototypeElement(
		currentElements as unknown as Record<string, unknown>[],
		selectedElementIds,
	);

	if (selectedPrototype) {
		applyPrototypeToSelectedElement({
			excalidrawApi,
			selectedPrototypeId: String(selectedPrototype.id),
			prototype,
		});
		return;
	}

	const draft = createOverlayElementDraft(
		'prototype',
		sceneCenter,
		prototype as unknown as Record<string, unknown>,
	);
	const converted = convertToExcalidrawElements([draft as never]);
	excalidrawApi.updateScene({ elements: [...currentElements, ...converted] });
	syncAppStoreFromExcalidraw(excalidrawApi);
}
