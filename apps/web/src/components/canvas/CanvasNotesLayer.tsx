import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
	type CSSProperties,
} from 'react';
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
	type OverlayRenderMode,
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

interface OverlayRuntimeStore {
	getIsActive: (elementId: string) => boolean;
	setIsActive: (elementId: string, isActive: boolean) => void;
	subscribe: (elementId: string, listener: () => void) => () => void;
	prune: (elementIds: readonly string[]) => void;
}

function createOverlayRuntimeStore(): OverlayRuntimeStore {
	const activeOverlayIds = new Set<string>();
	const listenersById = new Map<string, Set<() => void>>();

	const emit = (elementId: string) => {
		const listeners = listenersById.get(elementId);
		if (!listeners) return;
		for (const listener of listeners) listener();
	};

	return {
		getIsActive: (elementId) => activeOverlayIds.has(elementId),
		setIsActive: (elementId, isActive) => {
			const wasActive = activeOverlayIds.has(elementId);
			if (wasActive === isActive) return;

			if (isActive) {
				activeOverlayIds.add(elementId);
			} else {
				activeOverlayIds.delete(elementId);
			}

			emit(elementId);
		},
		subscribe: (elementId, listener) => {
			let listeners = listenersById.get(elementId);
			if (!listeners) {
				listeners = new Set();
				listenersById.set(elementId, listeners);
			}

			listeners.add(listener);

			return () => {
				const currentListeners = listenersById.get(elementId);
				if (!currentListeners) return;
				currentListeners.delete(listener);
				if (currentListeners.size === 0) {
					listenersById.delete(elementId);
				}
			};
		},
		prune: (elementIds) => {
			const activeElementIds = new Set(elementIds);
			for (const elementId of activeOverlayIds) {
				if (activeElementIds.has(elementId)) continue;
				activeOverlayIds.delete(elementId);
				emit(elementId);
			}
		},
	};
}

function getOverlayRenderMode(isSelected: boolean, isActive: boolean): OverlayRenderMode {
	if (isActive) return 'live';
	return isSelected ? 'shell' : 'preview';
}

function useOverlayActivity(runtimeStore: OverlayRuntimeStore, elementId: string) {
	return useSyncExternalStore(
		useCallback((listener: () => void) => runtimeStore.subscribe(elementId, listener), [
			elementId,
			runtimeStore,
		]),
		useCallback(() => runtimeStore.getIsActive(elementId), [elementId, runtimeStore]),
		useCallback(() => false, []),
	);
}

interface OverlayContentProps {
	element: TypedOverlayCanvasElement;
	mode: OverlayRenderMode;
	isSelected: boolean;
	isActive: boolean;
	onChange: (payload: OverlayUpdatePayloadMap[OverlayType]) => void;
	onActivityChange: (isActive: boolean) => void;
}

const OverlayContent = memo(function OverlayContent({
	element,
	mode,
	isSelected,
	isActive,
	onChange,
	onActivityChange,
}: OverlayContentProps) {
	const definition = getOverlayDefinition(element.customData.type);
	return definition.render({
		element: element as never,
		mode,
		isSelected,
		isActive,
		onChange: onChange as never,
		onActivityChange,
	});
});

interface OverlayItemProps {
	element: TypedOverlayCanvasElement;
	stackIndex: number;
	appState: ReturnType<typeof getNormalizedAppState>;
	runtimeStore: OverlayRuntimeStore;
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
	runtimeStore,
	updateOverlayElement,
}: OverlayItemProps) {
	const type = element.customData.type;
	const normalizedElement = normalizeOverlayElement(type, element);
	const isSelected = appState.selectedElementIds[normalizedElement.id] === true;
	const isActive = useOverlayActivity(runtimeStore, normalizedElement.id);
	const mode = getOverlayRenderMode(isSelected, isActive);
	const isPinned = isSelected || isActive;
	const containerStyle = useMemo(
		() =>
			getOverlayContainerStyle(
				normalizedElement,
				appState,
				getOverlayZIndex(isSelected, isActive, stackIndex),
			),
		[appState, isActive, isSelected, normalizedElement, stackIndex],
	);
	const interactionEnabled = isSelected || isActive;
	const handleChange = useCallback(
		(payload: OverlayUpdatePayloadMap[typeof type]) => {
			updateOverlayElement(normalizedElement.id, type, payload);
		},
		[normalizedElement.id, type, updateOverlayElement],
	);
	const handleActivityChange = useCallback(
		(nextIsActive: boolean) => {
			runtimeStore.setIsActive(normalizedElement.id, nextIsActive);
		},
		[normalizedElement.id, runtimeStore],
	);

	return (
		<div
			className="absolute"
			data-testid={`overlay-item-${normalizedElement.id}`}
			data-overlay-active={isActive ? 'true' : 'false'}
			data-overlay-id={normalizedElement.id}
			data-overlay-mode={mode}
			data-overlay-pinned={isPinned ? 'true' : 'false'}
			data-overlay-type={type}
			style={{
				...containerStyle,
				contain: 'layout paint',
				pointerEvents: interactionEnabled ? 'auto' : 'none',
			}}
		>
			<div className="h-full w-full">
				<OverlayContent
					element={normalizedElement}
					mode={mode}
					isSelected={isSelected}
					isActive={isActive}
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
	const runtimeStoreRef = useRef<OverlayRuntimeStore | null>(null);
	if (runtimeStoreRef.current === null) {
		runtimeStoreRef.current = createOverlayRuntimeStore();
	}
	const runtimeStore = runtimeStoreRef.current;

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

	useEffect(() => {
		runtimeStore.prune(overlayElements.map((element) => element.id));
	}, [overlayElements, runtimeStore]);

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
					runtimeStore={runtimeStore}
					updateOverlayElement={updateOverlayElement}
				/>
			))}
		</div>
	);
}
