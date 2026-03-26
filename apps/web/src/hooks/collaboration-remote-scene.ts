import { reconcileElements } from '@excalidraw/excalidraw';
import type { MutableRefObject } from 'react';
import type { CollabFile, CollaborationApi, RemoteElement } from './collaboration-session';

export function applyRemoteSceneUpdate(
	targetApi: CollaborationApi,
	elements: RemoteElement[],
	files: Record<string, CollabFile> | undefined,
	sentFileIds: Set<string>,
	isApplyingRemoteRef: MutableRefObject<boolean>,
) {
	if (files) {
		const toAdd = Object.values(files).map((file) => ({
			id: file.id,
			mimeType: file.mimeType,
			dataURL: file.dataURL,
			created: file.created,
		}));
		if (toAdd.length > 0) {
			targetApi.addFiles(toAdd);
			for (const file of toAdd) {
				sentFileIds.add(file.id);
			}
		}
	}

	const localElements = targetApi.getSceneElements();
	const localAppState = targetApi.getAppState();
	const reconciled = reconcileElements(
		localElements as Parameters<typeof reconcileElements>[0],
		elements as unknown as Parameters<typeof reconcileElements>[1],
		localAppState as Parameters<typeof reconcileElements>[2],
	);

	isApplyingRemoteRef.current = true;
	targetApi.updateScene({ elements: reconciled });
	queueMicrotask(() => {
		isApplyingRemoteRef.current = false;
	});
}
