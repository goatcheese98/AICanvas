import type {
	KanbanOverlayCustomData,
	OverlayType,
	OverlayCustomData,
} from '@ai-canvas/shared/types';
import { normalizeMarkdownOverlay } from '@ai-canvas/shared/schemas';
import type { AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { normalizeSceneElement } from './scene-element-normalizer';

interface CreateOverlayElementOptions {
	type: OverlayType;
	x: number;
	y: number;
	width?: number;
	height?: number;
	customData?: Record<string, unknown>;
}

const DEFAULTS: Record<OverlayType, { width: number; height: number }> = {
	markdown: { width: 400, height: 300 },
	newlex: { width: 500, height: 400 },
	kanban: { width: 700, height: 500 },
	'web-embed': { width: 640, height: 480 },
};

const DEFAULT_VIEWPORT_WIDTH = 800;
const DEFAULT_VIEWPORT_HEIGHT = 600;

export interface SceneCenter {
	x: number;
	y: number;
}

export interface OverlayElementDraft {
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
	roundness: null;
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

export interface OverlayInsertionScene {
	elements: ExcalidrawElement[];
	appState: Partial<AppState>;
	insertedElementId: string;
}

function createCenteredRect(sceneCenter: SceneCenter, width: number, height: number) {
	return {
		x: sceneCenter.x - width / 2,
		y: sceneCenter.y - height / 2,
		width,
		height,
	};
}

export function getViewportSceneCenter(appState: Partial<AppState>): SceneCenter {
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
export function createOverlayCustomData(
	options: CreateOverlayElementOptions,
): OverlayCustomData {
	switch (options.type) {
		case 'markdown':
			return normalizeMarkdownOverlay({
				content:
					typeof options.customData?.content === 'string'
						? options.customData.content
						: '# New Note\n\nStart writing...',
				images:
					typeof options.customData?.images === 'object'
						? (options.customData.images as Record<string, string>)
						: undefined,
				settings:
					typeof options.customData?.settings === 'object'
						? (options.customData.settings as Record<string, unknown>)
						: undefined,
				editorMode:
					options.customData?.editorMode === 'hybrid' ? 'hybrid' : undefined,
			});
		case 'newlex':
			return {
				type: 'newlex',
				lexicalState:
					typeof options.customData?.lexicalState === 'string'
						? options.customData.lexicalState
						: '',
				comments: Array.isArray(options.customData?.comments)
					? options.customData.comments
					: [],
				commentsPanelOpen:
					typeof options.customData?.commentsPanelOpen === 'boolean'
						? options.customData.commentsPanelOpen
						: false,
				version:
					typeof options.customData?.version === 'number' ? options.customData.version : 1,
			};
		case 'kanban':
			return {
				type: 'kanban',
				title:
					typeof options.customData?.title === 'string'
						? options.customData.title
						: 'Kanban Board',
				bgTheme:
					typeof options.customData?.bgTheme === 'string'
						? options.customData.bgTheme
						: 'parchment',
				fontId:
					typeof options.customData?.fontId === 'string'
						? options.customData.fontId
						: 'excalifont',
				fontSize:
					typeof options.customData?.fontSize === 'number'
						? options.customData.fontSize
						: 13,
				columns: Array.isArray(options.customData?.columns)
					? (options.customData.columns as KanbanOverlayCustomData['columns'])
					: [
						{ id: crypto.randomUUID(), title: 'To Do', cards: [] },
						{ id: crypto.randomUUID(), title: 'In Progress', cards: [] },
						{ id: crypto.randomUUID(), title: 'Done', cards: [] },
					],
			};
		case 'web-embed':
			return {
				type: 'web-embed',
				url: typeof options.customData?.url === 'string' ? options.customData.url : '',
			};
	}
}

export function getOverlayDefaults(type: OverlayType) {
	return DEFAULTS[type];
}

export function createOverlayElementDraft(
	type: OverlayType,
	sceneCenter: SceneCenter,
	customData?: Record<string, unknown>,
): OverlayElementDraft {
	const { width, height } = getOverlayDefaults(type);

	return normalizeSceneElement({
		id: crypto.randomUUID(),
		index: `a${Date.now()}` as any,
		type: 'rectangle',
		...createCenteredRect(sceneCenter, width, height),
		angle: 0,
		backgroundColor: type === 'kanban' ? '#faf8f2' : '#ffffff',
		strokeColor: type === 'markdown' ? 'transparent' : 'rgba(0,0,0,0.12)',
		strokeWidth: type === 'markdown' ? 0 : 1,
		strokeStyle: 'solid',
		roughness: 0,
		opacity: 100,
		fillStyle: 'solid',
		roundness: null,
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
