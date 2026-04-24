import type { OverlayCustomData, OverlayType } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState } from '@excalidraw/excalidraw/types';
import { getOverlayDefinition } from './overlay-definitions';
import { normalizeSceneElement } from './scene-element-normalizer';

interface CreateOverlayElementOptions {
	type: OverlayType;
	x: number;
	y: number;
	width?: number;
	height?: number;
	customData?: Record<string, unknown>;
}

const DEFAULT_VIEWPORT_WIDTH = 800;
const DEFAULT_VIEWPORT_HEIGHT = 600;
const DEFAULT_NOTE_BACKGROUND = '#ffffff';
const DEFAULT_NOTE_STROKE = 'rgba(17,24,39,0.09)';
const DEFAULT_RICH_TEXT_STROKE = 'rgba(17,24,39,0.16)';

interface OverlayElementDraft {
	id: string;
	index: string;
	type: 'rectangle';
	x: number;
	y: number;
	width: number;
	height: number;
	angle: number;
	backgroundColor: string;
	strokeColor: string;
	strokeWidth: number;
	strokeStyle: 'solid';
	roughness: number;
	opacity: number;
	fillStyle: 'solid';
	roundness: { type: number; value?: number } | null;
	groupIds: string[];
	frameId: null;
	boundElements: null;
	updated: number;
	link: null;
	seed: number;
	version: number;
	versionNonce: number;
	isDeleted: false;
	locked: false;
	customData: OverlayCustomData;
}

interface OverlayInsertionScene {
	elements: ExcalidrawElement[];
	appState: Partial<AppState>;
	insertedElementId: string;
}

function createCenteredRect(sceneCenter: { x: number; y: number }, width: number, height: number) {
	return {
		x: sceneCenter.x - width / 2,
		y: sceneCenter.y - height / 2,
		width,
		height,
	};
}

export function getViewportSceneCenter(appState: Partial<AppState>): { x: number; y: number } {
	const zoomValue =
		typeof appState.zoom?.value === 'number' && appState.zoom.value > 0 ? appState.zoom.value : 1;
	const scrollX = typeof appState.scrollX === 'number' ? appState.scrollX : 0;
	const scrollY = typeof appState.scrollY === 'number' ? appState.scrollY : 0;
	const viewportCenterX =
		(typeof appState.width === 'number' ? appState.width : DEFAULT_VIEWPORT_WIDTH) / 2;
	const viewportCenterY =
		(typeof appState.height === 'number' ? appState.height : DEFAULT_VIEWPORT_HEIGHT) / 2;

	return {
		x: viewportCenterX / zoomValue - scrollX,
		y: viewportCenterY / zoomValue - scrollY,
	};
}

/**
 * Creates the customData payload for an Excalidraw element
 * that represents an overlay.
 *
 * This will be used with the Excalidraw API to mutate elements:
 *   api.updateScene({ elements: [...elements, newElement] })
 */
export function createOverlayCustomData(options: CreateOverlayElementOptions): OverlayCustomData {
	return getOverlayDefinition(options.type).createCustomData(options);
}

export function getOverlayDefaults(type: OverlayType) {
	return getOverlayDefinition(type).defaultSize;
}

export function createOverlayElementDraft(
	type: OverlayType,
	sceneCenter: { x: number; y: number },
	customData?: Record<string, unknown>,
): OverlayElementDraft {
	const { width, height } = getOverlayDefaults(type);
	const isRichText = type === 'newlex';
	const isTextNote = type === 'markdown' || type === 'newlex';

	return normalizeSceneElement({
		id: crypto.randomUUID(),
		// Use 'a0' as a safe placeholder; Excalidraw's syncInvalidIndices will assign
		// a proper unique fractional key when the element is added via updateScene.
		// We previously used `a${Date.now()}` which produced invalid keys like
		// `a1773614343380` that break generateKeyBetween when inserting native shapes.
		index: 'a0' as ExcalidrawElement['index'],
		type: 'rectangle',
		...createCenteredRect(sceneCenter, width, height),
		angle: 0,
		backgroundColor: isTextNote ? DEFAULT_NOTE_BACKGROUND : '#ffffff',
		strokeColor: isRichText ? DEFAULT_RICH_TEXT_STROKE : DEFAULT_NOTE_STROKE,
		strokeWidth: 1,
		strokeStyle: 'solid',
		roughness: 0,
		opacity: 100,
		fillStyle: 'solid',
		roundness: type === 'kanban' ? { type: 3, value: 18 } : null,
		groupIds: [],
		frameId: null,
		boundElements: null,
		updated: Date.now(),
		link: null,
		seed: Math.floor(Math.random() * 100000),
		version: 1,
		versionNonce: Math.floor(Math.random() * 2 ** 31),
		isDeleted: false,
		locked: false,
		customData: createOverlayCustomData({
			type,
			x: sceneCenter.x,
			y: sceneCenter.y,
			width,
			height,
			customData,
		}),
	}) as unknown as OverlayElementDraft;
}

export function buildOverlayInsertionScene(
	type: OverlayType,
	currentElements: readonly ExcalidrawElement[],
	appState: Partial<AppState>,
	customData?: Record<string, unknown>,
): OverlayInsertionScene {
	const draft = createOverlayElementDraft(type, getViewportSceneCenter(appState), customData);

	return {
		elements: [...currentElements, draft as unknown as ExcalidrawElement],
		appState: {
			selectedElementIds: { [draft.id]: true },
		},
		insertedElementId: draft.id,
	};
}
