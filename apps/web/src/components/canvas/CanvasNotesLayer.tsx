import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AppState } from '@excalidraw/excalidraw/types';
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

interface OverlayContentProps {
	element: TypedOverlayCanvasElement;
	isSelected: boolean;
	onChange: (payload: OverlayUpdatePayloadMap[OverlayType]) => void;
	onEditingChange: (isEditing: boolean) => void;
}

const OverlayContent = memo(function OverlayContent({
	element,
	isSelected,
	onChange,
	onEditingChange,
}: OverlayContentProps) {
	const definition = getOverlayDefinition(element.customData.type);
	return definition.render({
		element: element as never,
		isSelected,
		onChange: onChange as never,
		onEditingChange,
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

function OverlayItem({
	element,
	stackIndex,
	appState,
	updateOverlayElement,
}: OverlayItemProps) {
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
	const handleEditingChange = useCallback((nextIsEditing: boolean) => {
		if (isEditingRef.current === nextIsEditing) return;
		isEditingRef.current = nextIsEditing;
		setIsEditing(nextIsEditing);
	}, []);

	return (
		<div
			className="absolute"
			style={{
				...containerStyle,
				pointerEvents: interactionEnabled ? 'auto' : 'none',
			}}
		>
			<div className="h-full w-full">
				<OverlayContent
					element={normalizedElement}
					isSelected={isSelected}
					onChange={handleChange as never}
					onEditingChange={handleEditingChange}
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

			let didChange = false;
			const nextElements = currentElements.map((candidate) => {
				if (candidate.id !== elementId) return candidate;
				const updated = applyOverlayUpdateByType(
					type,
					candidate as unknown as TypedOverlayCanvasElement,
					payload,
				);
				didChange = didChange || updated !== candidate;
				return updated;
			});
			if (!didChange) return;

			excalidrawApi.updateScene({ elements: nextElements });
			setElements(nextElements);
		},
		[],
	);

	return (
		<div
			className="pointer-events-none absolute inset-0 overflow-hidden"
			style={{ zIndex: 2 }}
		>
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
