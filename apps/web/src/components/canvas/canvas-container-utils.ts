import type { CanvasData } from '@/lib/persistence/CanvasPersistenceCoordinator';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
	BinaryFileData,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { normalizeSceneElements } from './scene-element-normalizer';

type SceneUpdateAppState = NonNullable<
	Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['appState']
>;

let exportToBlobLoader: Promise<typeof import('@excalidraw/excalidraw')['exportToBlob']> | null =
	null;

export async function getExportToBlob(): Promise<
	typeof import('@excalidraw/excalidraw')['exportToBlob']
> {
	if (!exportToBlobLoader) {
		exportToBlobLoader = import('@excalidraw/excalidraw').then((module) => module.exportToBlob);
	}
	return exportToBlobLoader;
}

export function toSceneUpdateAppState(
	appState: Record<string, unknown> | null | undefined,
): SceneUpdateAppState {
	return (appState ?? {}) as SceneUpdateAppState;
}

export function toBinaryFiles(
	files: BinaryFiles | Record<string, unknown> | null | undefined,
): BinaryFiles {
	return (files ?? {}) as BinaryFiles;
}

export function toBinaryFileList(
	files: BinaryFiles | Record<string, unknown> | null | undefined,
): BinaryFileData[] {
	return Object.values(toBinaryFiles(files));
}

export function toSceneElements(
	elements: readonly Record<string, unknown>[] | null | undefined,
): ExcalidrawElement[] {
	return normalizeSceneElements((elements ?? []) as unknown as ExcalidrawElement[]);
}

export function getThumbnailSignature(data: CanvasData): string {
	return JSON.stringify(
		data.elements.map((element: Record<string, unknown>) => [
			element.id,
			element.version,
			element.versionNonce,
			element.isDeleted === true,
		]),
	);
}

export function getNonDeletedElements(data: CanvasData): Record<string, unknown>[] {
	return data.elements.filter((element) => (element as Record<string, unknown>).isDeleted !== true);
}

export function hasElements(data: CanvasData): boolean {
	return getNonDeletedElements(data).length > 0;
}
