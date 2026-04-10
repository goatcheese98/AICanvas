/**
 * Tour Capture Hook - Scene snapshot capture and restore.
 *
 * Anti-Slop Pattern:
 * - Handles serialization/deserialization only
 * - No navigation state, no UI concerns
 * - Pure data transformations
 */

import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import { useCallback, useMemo } from 'react';
import { canvasTourChapters } from '../canvas-tour-content';
import type {
	RegisteredTourSceneLibrary,
	RegisteredTourSceneSnapshot,
} from '../canvas-tour-registry';
import {
	clearRegisteredTourScenes,
	loadRegisteredTourScenes,
	persistRegisteredTourScenes,
} from '../canvas-tour-registry';
import type { CameraTarget, CanvasSceneSnapshot } from '../useCanvasTourSceneController';

export type CaptureMode = 'full' | 'camera' | 'elements';

interface CaptureResult {
	/** Whether capture was successful */
	success: boolean;
	/** Captured snapshot if successful */
	snapshot?: RegisteredTourSceneSnapshot;
	/** Error message if failed */
	error?: string;
}

interface RestoreResult {
	/** Whether restore was successful */
	success: boolean;
	/** Restored snapshot if found */
	snapshot?: RegisteredTourSceneSnapshot;
	/** Error message if failed */
	error?: string;
}

interface CompareResult {
	/** Whether scenes are equal */
	isEqual: boolean;
	/** Which fields differ */
	differences: ('elements' | 'camera' | 'overlay')[];
}

interface UseTourCaptureArgs {
	/** Current scene library from state */
	sceneLibrary: RegisteredTourSceneLibrary | null;
	/** Default elements for new scenes */
	defaultElements: unknown[];
	/** Current capture mode */
	captureMode: CaptureMode;
}

interface UseTourCaptureReturn {
	/** Get registered scene by ID (from state, not storage) */
	getRegisteredScene: (sceneId: string) => RegisteredTourSceneSnapshot | null;
	/** Get default scene snapshot for a chapter */
	getDefaultScene: (sceneId: string) => RegisteredTourSceneSnapshot;
	/** Capture current scene and build snapshot (does not persist) */
	captureScene: (
		sceneId: string,
		currentSnapshot: CanvasSceneSnapshot,
		camera: CameraTarget,
		previousScene?: RegisteredTourSceneSnapshot | null,
	) => CaptureResult;
	/** Persist captured snapshot to storage */
	persistCapture: (snapshot: RegisteredTourSceneSnapshot) => RegisteredTourSceneLibrary;
	/** Restore scene from registered library */
	restoreScene: (sceneId: string) => RestoreResult;
	/** Clear registered scene */
	clearScene: (sceneId: string) => RegisteredTourSceneLibrary | null;
	/** Compare two scene snapshots */
	compareScenes: (a: RegisteredTourSceneSnapshot, b: RegisteredTourSceneSnapshot) => CompareResult;
	/** Check if scene has changes compared to default */
	hasChangesFromDefault: (sceneId: string) => boolean;
	/** Load scenes from storage (initial load) */
	loadFromStorage: () => RegisteredTourSceneLibrary | null;
	/** Clear all registered scenes */
	clearAllScenes: () => void;
	/** Build canvas snapshot from registered scene */
	buildCanvasSnapshot: (
		scene: RegisteredTourSceneSnapshot,
		imageFileData: BinaryFileData | null,
		buildAppState: (camera: CameraTarget) => Partial<unknown>,
	) => CanvasSceneSnapshot;
}

export function useTourCapture({
	sceneLibrary,
	defaultElements,
	captureMode,
}: UseTourCaptureArgs): UseTourCaptureReturn {
	// Cast defaultElements for internal use
	const typedDefaultElements = defaultElements as ExcalidrawElement[];
	const getRegisteredScene = useCallback(
		(sceneId: string): RegisteredTourSceneSnapshot | null => {
			return sceneLibrary?.scenes[sceneId] ?? null;
		},
		[sceneLibrary],
	);

	const getDefaultScene = useCallback(
		(sceneId: string): RegisteredTourSceneSnapshot => {
			const chapter = canvasTourChapters.find((c) => c.id === sceneId) ?? canvasTourChapters[0];
			return {
				sceneId,
				elements: typedDefaultElements,
				camera: chapter.camera,
				overlay: chapter.overlay,
				capturedAt: new Date(0).toISOString(),
			};
		},
		[typedDefaultElements],
	);

	const captureScene = useCallback(
		(
			sceneId: string,
			currentSnapshot: CanvasSceneSnapshot,
			camera: CameraTarget,
			previousScene?: RegisteredTourSceneSnapshot | null,
		): CaptureResult => {
			try {
				const baseScene = previousScene ?? getDefaultScene(sceneId);

				const captured: RegisteredTourSceneSnapshot = {
					sceneId,
					elements:
						captureMode === 'camera'
							? baseScene.elements
							: (currentSnapshot.elements as ExcalidrawElement[]),
					camera: captureMode === 'elements' ? baseScene.camera : camera,
					overlay: baseScene.overlay,
					capturedAt: new Date().toISOString(),
				};

				return { success: true, snapshot: captured };
			} catch (err) {
				return {
					success: false,
					error: err instanceof Error ? err.message : 'Capture failed',
				};
			}
		},
		[captureMode, getDefaultScene],
	);

	const persistCapture = useCallback(
		(snapshot: RegisteredTourSceneSnapshot): RegisteredTourSceneLibrary => {
			const nextLibrary: RegisteredTourSceneLibrary = {
				scenes: {
					...(sceneLibrary?.scenes ?? {}),
					[snapshot.sceneId]: snapshot,
				},
				updatedAt: snapshot.capturedAt,
			};
			persistRegisteredTourScenes(nextLibrary);
			return nextLibrary;
		},
		[sceneLibrary],
	);

	const restoreScene = useCallback(
		(sceneId: string): RestoreResult => {
			const registered = getRegisteredScene(sceneId);
			if (!registered) {
				return {
					success: false,
					error: `No registered scene found for ID: ${sceneId}`,
				};
			}
			return { success: true, snapshot: registered };
		},
		[getRegisteredScene],
	);

	const clearScene = useCallback(
		(sceneId: string): RegisteredTourSceneLibrary | null => {
			const nextScenes = { ...(sceneLibrary?.scenes ?? {}) };
			delete nextScenes[sceneId];

			const hasScenes = Object.keys(nextScenes).length > 0;
			if (!hasScenes) {
				clearRegisteredTourScenes();
				return null;
			}

			const nextLibrary: RegisteredTourSceneLibrary = {
				scenes: nextScenes,
				updatedAt: new Date().toISOString(),
			};
			persistRegisteredTourScenes(nextLibrary);
			return nextLibrary;
		},
		[sceneLibrary],
	);

	const compareScenes = useCallback(
		(a: RegisteredTourSceneSnapshot, b: RegisteredTourSceneSnapshot): CompareResult => {
			const differences: ('elements' | 'camera' | 'overlay')[] = [];

			// Compare elements by length (shallow check)
			if (a.elements.length !== b.elements.length) {
				differences.push('elements');
			}

			// Compare camera
			if (
				a.camera.x !== b.camera.x ||
				a.camera.y !== b.camera.y ||
				a.camera.zoom !== b.camera.zoom
			) {
				differences.push('camera');
			}

			// Compare overlay
			if (
				a.overlay.label !== b.overlay.label ||
				a.overlay.title !== b.overlay.title ||
				a.overlay.placement.leftRem !== b.overlay.placement.leftRem ||
				a.overlay.placement.topRem !== b.overlay.placement.topRem ||
				a.overlay.placement.widthRem !== b.overlay.placement.widthRem
			) {
				differences.push('overlay');
			}

			return {
				isEqual: differences.length === 0,
				differences,
			};
		},
		[],
	);

	const hasChangesFromDefault = useCallback(
		(sceneId: string): boolean => {
			const registered = getRegisteredScene(sceneId);
			if (!registered) return false;

			const defaultScene = getDefaultScene(sceneId);
			const comparison = compareScenes(registered, defaultScene);
			return !comparison.isEqual;
		},
		[getRegisteredScene, getDefaultScene, compareScenes],
	);

	const loadFromStorage = useCallback((): RegisteredTourSceneLibrary | null => {
		return loadRegisteredTourScenes();
	}, []);

	const clearAllScenes = useCallback((): void => {
		clearRegisteredTourScenes();
	}, []);

	const buildCanvasSnapshot = useCallback(
		(
			scene: RegisteredTourSceneSnapshot,
			imageFileData: BinaryFileData | null,
			buildAppState: (camera: CameraTarget) => Partial<unknown>,
		): CanvasSceneSnapshot => {
			const files = imageFileData ? { [imageFileData.id]: imageFileData } : {};
			return {
				elements: scene.elements,
				appState: buildAppState(scene.camera),
				files,
			};
		},
		[],
	);

	return useMemo(
		() => ({
			getRegisteredScene,
			getDefaultScene,
			captureScene,
			persistCapture,
			restoreScene,
			clearScene,
			compareScenes,
			hasChangesFromDefault,
			loadFromStorage,
			clearAllScenes,
			buildCanvasSnapshot,
		}),
		[
			getRegisteredScene,
			getDefaultScene,
			captureScene,
			persistCapture,
			restoreScene,
			clearScene,
			compareScenes,
			hasChangesFromDefault,
			loadFromStorage,
			clearAllScenes,
			buildCanvasSnapshot,
		],
	);
}
