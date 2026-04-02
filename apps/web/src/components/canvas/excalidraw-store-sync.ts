import {
	areBinaryFilesEquivalent,
	areExcalidrawAppStatesEquivalent,
	areExcalidrawElementsEquivalent,
} from '@/lib/excalidraw-scene-equality';
import { useAppStore } from '@/stores/store';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

export type ExcalidrawSceneUpdate = {
	elements?: readonly ExcalidrawElement[];
	appState?: Partial<AppState>;
	files?: BinaryFiles;
	captureUpdate?: Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['captureUpdate'];
	collaborators?: Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['collaborators'];
};

export type ExcalidrawSceneSnapshot = {
	elements: readonly ExcalidrawElement[];
	appState: Partial<AppState>;
	files: BinaryFiles;
};
type ExcalidrawSceneSyncApi = Pick<
	ExcalidrawImperativeAPI,
	'updateScene' | 'getSceneElements' | 'getAppState' | 'getFiles'
>;

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
		zoom: appState.zoom && typeof appState.zoom === 'object' ? { ...appState.zoom } : appState.zoom,
	} as T;
}

export function cloneExcalidrawFiles(files: BinaryFiles): BinaryFiles {
	return files && typeof files === 'object' ? { ...files } : files;
}

export function syncAppStoreSnapshot(snapshot: ExcalidrawSceneSnapshot) {
	const nextSnapshot = {
		elements: cloneExcalidrawElements(snapshot.elements),
		appState: cloneExcalidrawAppState(snapshot.appState),
		files: cloneExcalidrawFiles(snapshot.files),
	} satisfies ExcalidrawSceneSnapshot;
	const { elements, appState, files, setElements, setAppState, setFiles } = useAppStore.getState();

	if (!areExcalidrawElementsEquivalent(elements, nextSnapshot.elements)) {
		setElements(nextSnapshot.elements);
	}
	if (!areExcalidrawAppStatesEquivalent(appState, nextSnapshot.appState)) {
		setAppState(nextSnapshot.appState);
	}
	if (!areBinaryFilesEquivalent(files, nextSnapshot.files)) {
		setFiles(nextSnapshot.files);
	}

	return nextSnapshot;
}

export function syncAppStoreFromExcalidraw(
	excalidrawApi: Pick<ExcalidrawSceneSyncApi, 'getSceneElements' | 'getAppState' | 'getFiles'>,
	overrides?: Partial<ExcalidrawSceneSnapshot>,
) {
	return syncAppStoreSnapshot({
		elements: overrides?.elements ?? excalidrawApi.getSceneElements(),
		appState: overrides?.appState ?? (excalidrawApi.getAppState() as Partial<AppState>),
		files: overrides?.files ?? excalidrawApi.getFiles(),
	});
}

export function updateSceneAndSyncAppStore(
	excalidrawApi: ExcalidrawSceneSyncApi,
	scene: ExcalidrawSceneUpdate,
	snapshotOverrides?: Partial<ExcalidrawSceneSnapshot>,
) {
	excalidrawApi.updateScene(scene as Parameters<ExcalidrawImperativeAPI['updateScene']>[0]);
	return syncAppStoreFromExcalidraw(excalidrawApi, snapshotOverrides);
}
