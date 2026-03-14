import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
	AppState,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { useAppStore } from '@/stores/store';

export type ExcalidrawSceneUpdate = {
	elements?: readonly ExcalidrawElement[];
	appState?: Partial<AppState>;
	files?: BinaryFiles;
	captureUpdate?: Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['captureUpdate'];
	collaborators?: Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['collaborators'];
};

export function cloneExcalidrawElements(
	elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
	return [...elements];
}

export function cloneExcalidrawAppState(appState: AppState): AppState;
export function cloneExcalidrawAppState<T extends Partial<AppState>>(appState: T): T;
export function cloneExcalidrawAppState<T extends Partial<AppState>>(appState: T): T {
	return {
		...appState,
		selectedElementIds: { ...(appState.selectedElementIds ?? {}) },
		zoom:
			appState.zoom && typeof appState.zoom === 'object'
				? { ...appState.zoom }
				: appState.zoom,
	} as T;
}

export function cloneExcalidrawFiles(files: BinaryFiles): BinaryFiles {
	return files && typeof files === 'object' ? { ...files } : files;
}

export function syncAppStoreFromExcalidraw(
	excalidrawApi: Pick<
		ExcalidrawImperativeAPI,
		'getSceneElements' | 'getAppState' | 'getFiles'
	>,
) {
	const snapshot = {
		elements: cloneExcalidrawElements(excalidrawApi.getSceneElements()),
		appState: cloneExcalidrawAppState(
			excalidrawApi.getAppState() as Partial<AppState>,
		),
		files: cloneExcalidrawFiles(excalidrawApi.getFiles()),
	};
	const { setElements, setAppState, setFiles } = useAppStore.getState();

	setElements(snapshot.elements);
	setAppState(snapshot.appState);
	setFiles(snapshot.files);

	return snapshot;
}

export function updateSceneAndSyncAppStore(
	excalidrawApi: Pick<
		ExcalidrawImperativeAPI,
		'updateScene' | 'getSceneElements' | 'getAppState' | 'getFiles'
	>,
	scene: ExcalidrawSceneUpdate,
) {
	excalidrawApi.updateScene(
		scene as Parameters<ExcalidrawImperativeAPI['updateScene']>[0],
	);
	return syncAppStoreFromExcalidraw(excalidrawApi);
}
