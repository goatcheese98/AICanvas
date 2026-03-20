import type { AppState } from '@excalidraw/excalidraw/types';
import { useCallback, useRef, useState } from 'react';
import type { CameraTarget } from '../tour-types';

function getViewportAppState(target: CameraTarget, width: number, height: number) {
	const zoom = target.zoom;

	return {
		scrollX: width / (2 * zoom) - target.x,
		scrollY: height / (2 * zoom) - target.y,
		zoom: { value: zoom as never },
	};
}

interface UseTourCameraArgs {
	initialCamera: CameraTarget;
	viewportSize: { width: number; height: number };
}

interface UseTourCameraReturn {
	cameraRef: React.MutableRefObject<CameraTarget>;
	liveCamera: CameraTarget;
	setLiveCamera: (camera: CameraTarget) => void;
	buildGuideAppState: (targetCamera: CameraTarget) => Partial<AppState>;
	buildExploreAppState: (targetCamera: CameraTarget) => Partial<AppState>;
	createCameraFromAppState: (appState: Partial<AppState>) => CameraTarget;
}

export function useTourCamera({ initialCamera, viewportSize }: UseTourCameraArgs): UseTourCameraReturn {
	const cameraRef = useRef<CameraTarget>(initialCamera);
	const [liveCamera, setLiveCamera] = useState<CameraTarget>(initialCamera);

	const buildGuideAppState = useCallback(
		(targetCamera: CameraTarget): Partial<AppState> => ({
			viewBackgroundColor: '#f7f8fb',
			viewModeEnabled: true,
			selectedElementIds: {},
			openMenu: null,
			openPopup: null,
			openSidebar: null,
			openDialog: null,
			contextMenu: null,
			editingTextElement: null,
			editingLinearElement: null,
			activeEmbeddable: null,
			...getViewportAppState(targetCamera, viewportSize.width, viewportSize.height),
		}),
		[viewportSize.height, viewportSize.width],
	);

	const buildExploreAppState = useCallback(
		(targetCamera: CameraTarget): Partial<AppState> => ({
			viewBackgroundColor: '#f7f8fb',
			viewModeEnabled: false,
			...getViewportAppState(targetCamera, viewportSize.width, viewportSize.height),
		}),
		[viewportSize.height, viewportSize.width],
	);

	const createCameraFromAppState = useCallback(
		(appState: Partial<AppState>): CameraTarget => {
			const zoom =
				typeof appState.zoom?.value === 'number' && appState.zoom.value > 0
					? appState.zoom.value
					: 1;
			const width =
				typeof appState.width === 'number' && appState.width > 0
					? appState.width
					: viewportSize.width;
			const height =
				typeof appState.height === 'number' && appState.height > 0
					? appState.height
					: viewportSize.height;
			const scrollX = typeof appState.scrollX === 'number' ? appState.scrollX : 0;
			const scrollY = typeof appState.scrollY === 'number' ? appState.scrollY : 0;

			return {
				x: width / (2 * zoom) - scrollX,
				y: height / (2 * zoom) - scrollY,
				zoom,
			};
		},
		[viewportSize.height, viewportSize.width],
	);

	return {
		cameraRef,
		liveCamera,
		setLiveCamera,
		buildGuideAppState,
		buildExploreAppState,
		createCameraFromAppState,
	};
}
