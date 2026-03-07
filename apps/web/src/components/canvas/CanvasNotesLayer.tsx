import { useCallback, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { OverlayType } from '@ai-canvas/shared/types';
import { useAppStore } from '@/stores/store';
import {
	applyOverlayUpdateByType,
	collectOverlayElements,
	getOverlayZIndex,
} from './overlay-registry';
import {
	getOverlayDefinition,
	normalizeOverlayElement,
	type OverlayUpdatePayloadMap,
	type TypedOverlayCanvasElement,
} from './overlay-definitions';

const EMPTY_SELECTED_ELEMENT_IDS: NonNullable<AppState['selectedElementIds']> = {};

function getNormalizedAppState(appState: {
	scrollX?: number;
	scrollY?: number;
	zoomValue?: number;
	selectedElementIds?: AppState['selectedElementIds'];
}) {
	return {
		scrollX: appState.scrollX ?? 0,
		scrollY: appState.scrollY ?? 0,
		zoom: {
			value: appState.zoomValue ?? 1,
		},
		selectedElementIds: appState.selectedElementIds ?? EMPTY_SELECTED_ELEMENT_IDS,
	};
}

function getOverlayContainerStyle(
	element: TypedOverlayCanvasElement,
	appState: ReturnType<typeof getNormalizedAppState>,
	zIndex: number,
) {
	const zoom = appState.zoom.value;
	const screenCenterX = (element.x + element.width / 2 + appState.scrollX) * zoom;
	const screenCenterY = (element.y + element.height / 2 + appState.scrollY) * zoom;

	return {
		left: screenCenterX - element.width / 2,
		top: screenCenterY - element.height / 2,
		width: element.width,
		height: element.height,
		transform: `scale(${zoom}) rotate(${element.angle || 0}rad)`,
		transformOrigin: 'center center',
		zIndex,
	} satisfies CSSProperties;
}

interface CanvasNotesLayerProps {
	onOverlaySceneChange?: (elements: readonly ExcalidrawElement[]) => void;
}

export function CanvasNotesLayer({ onOverlaySceneChange }: CanvasNotesLayerProps) {
	const elements = useAppStore((s) => s.elements);
	const scrollX = useAppStore((s) => s.appState.scrollX ?? 0);
	const scrollY = useAppStore((s) => s.appState.scrollY ?? 0);
	const zoomValue = useAppStore((s) => s.appState.zoom?.value ?? 1);
	const selectedElementIds = useAppStore(
		(s) => s.appState.selectedElementIds ?? EMPTY_SELECTED_ELEMENT_IDS,
	);

	const overlayElements = useMemo(() => collectOverlayElements(elements), [elements]);
	const normalizedAppState = useMemo(
		() =>
			getNormalizedAppState({
				scrollX,
				scrollY,
				zoomValue,
				selectedElementIds,
			}),
		[scrollX, scrollY, selectedElementIds, zoomValue],
	);

	const updateOverlayElement = useCallback(
		<K extends OverlayType>(elementId: string, type: K, payload: OverlayUpdatePayloadMap[K]) => {
			const { elements: currentElements, excalidrawApi, setElements } = useAppStore.getState();
			if (!excalidrawApi) return;

			const nextElements = currentElements.map((candidate) => {
				if (candidate.id !== elementId) return candidate;
				return applyOverlayUpdateByType(
					type,
					candidate as unknown as TypedOverlayCanvasElement,
					payload,
				);
			});

			excalidrawApi.updateScene({ elements: nextElements as ExcalidrawElement[] });
			setElements(nextElements as ExcalidrawElement[]);
			onOverlaySceneChange?.(nextElements as ExcalidrawElement[]);
		},
		[onOverlaySceneChange],
	);

	const renderOverlay = useCallback(
		(element: TypedOverlayCanvasElement, stackIndex: number) => {
			const type = element.customData.type;
			const normalizedElement = normalizeOverlayElement(type, element);
			const isSelected = normalizedAppState.selectedElementIds[normalizedElement.id] === true;
			const containerStyle = getOverlayContainerStyle(
				normalizedElement,
				normalizedAppState,
				getOverlayZIndex(isSelected, false, stackIndex),
			);

			const interactionEnabled = isSelected;
			const definition = getOverlayDefinition(type);
			const content: ReactNode = definition.render({
				element: normalizedElement as never,
				isSelected,
				onChange: (payload) =>
					updateOverlayElement(
						normalizedElement.id,
						type,
						payload as OverlayUpdatePayloadMap[typeof type],
					),
			});

			return (
				<div
					key={normalizedElement.id}
					className="absolute"
					style={{
						...containerStyle,
						pointerEvents: interactionEnabled ? 'auto' : 'none',
					}}
				>
					<div className="h-full w-full">
						{content}
					</div>
				</div>
			);
		},
		[normalizedAppState, updateOverlayElement],
	);

	return (
		<div
			className="pointer-events-none absolute inset-0 overflow-hidden"
			style={{ zIndex: 2 }}
		>
			{overlayElements.map((element, stackIndex) => renderOverlay(element, stackIndex))}
		</div>
	);
}
