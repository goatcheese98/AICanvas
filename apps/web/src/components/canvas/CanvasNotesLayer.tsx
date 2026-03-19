import { useAppStore } from '@/stores/store';
import type { OverlayType } from '@ai-canvas/shared/types';
import type { AppState } from '@excalidraw/excalidraw/types';
import { type CSSProperties, memo, useCallback, useMemo, useRef, useState } from 'react';
import {
	type OverlayUpdatePayloadMap,
	type TypedOverlayCanvasElement,
	getOverlayDefinition,
	normalizeOverlayElement,
} from './overlay-definitions';
import {
	applyOverlayUpdateToScene,
	collectOverlayElements,
	getOverlayZIndex,
} from './overlay-registry';

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

interface OverlayContentProps {
	element: TypedOverlayCanvasElement;
	isSelected: boolean;
	isActive: boolean;
	mode: 'preview' | 'shell' | 'live';
	onChange: (payload: OverlayUpdatePayloadMap[OverlayType]) => void;
	onActivityChange: (isActive: boolean) => void;
}

const OverlayContent = memo(function OverlayContent({
	element,
	isSelected,
	isActive,
	mode,
	onChange,
	onActivityChange,
}: OverlayContentProps) {
	const definition = getOverlayDefinition(element.customData.type);
	return definition.render({
		element: element as never,
		isSelected,
		isActive,
		mode,
		onChange: onChange as never,
		onActivityChange,
	});
});

interface OverlayItemProps {
	element: TypedOverlayCanvasElement;
	stackIndex: number;
	appState: ReturnType<typeof getNormalizedAppState>;
	updateOverlayElement: <K extends OverlayType>(
		elementId: string,
		type: K,
		payload: OverlayUpdatePayloadMap[K],
	) => void;
}

function OverlayItem({ element, stackIndex, appState, updateOverlayElement }: OverlayItemProps) {
	const [isEditing, setIsEditing] = useState(false);
	const isEditingRef = useRef(false);
	const type = element.customData.type;
	const normalizedElement = normalizeOverlayElement(type, element);
	const isSelected = appState.selectedElementIds[normalizedElement.id] === true;
	const containerStyle = useMemo(
		() =>
			getOverlayContainerStyle(
				normalizedElement,
				appState,
				getOverlayZIndex(isSelected, isEditing, stackIndex),
			),
		[appState, isEditing, isSelected, normalizedElement, stackIndex],
	);
	const interactionEnabled = isSelected;
	const handleChange = useCallback(
		(payload: OverlayUpdatePayloadMap[typeof type]) => {
			updateOverlayElement(normalizedElement.id, type, payload);
		},
		[normalizedElement.id, type, updateOverlayElement],
	);
	const handleActivityChange = useCallback((nextIsActive: boolean) => {
		if (isEditingRef.current === nextIsActive) return;
		isEditingRef.current = nextIsActive;
		setIsEditing(nextIsActive);
	}, []);

	return (
		<div
			className="absolute"
			data-testid={`overlay-item-${normalizedElement.id}`}
			data-overlay-id={normalizedElement.id}
			data-overlay-type={type}
			style={{
				...containerStyle,
				pointerEvents: interactionEnabled ? 'auto' : 'none',
			}}
		>
			<div className="h-full w-full">
				<OverlayContent
					element={normalizedElement}
					isSelected={isSelected}
					isActive={isEditing}
					mode={isSelected ? 'live' : 'preview'}
					onChange={handleChange as never}
					onActivityChange={handleActivityChange}
				/>
			</div>
		</div>
	);
}

export function CanvasNotesLayer() {
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

			const { didChange, nextElements } = applyOverlayUpdateToScene(
				currentElements,
				elementId,
				type,
				payload,
			);
			if (!didChange) return;

			excalidrawApi.updateScene({ elements: nextElements });
			setElements(nextElements);
		},
		[],
	);

	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 2 }}>
			{overlayElements.map((element, stackIndex) => (
				<OverlayItem
					key={element.id}
					element={element}
					stackIndex={stackIndex}
					appState={normalizedAppState}
					updateOverlayElement={updateOverlayElement}
				/>
			))}
		</div>
	);
}
