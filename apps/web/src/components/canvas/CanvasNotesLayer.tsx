import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
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

const EMPTY_SELECTED_ELEMENT_IDS: Record<string, boolean> = {};

// ─── OverlayContent ──────────────────────────────────────────────────────────
// Isolated so React only re-renders overlay internals when content changes.

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

// ─── OverlayItem ─────────────────────────────────────────────────────────────
// Position (left/top/width/height) is set imperatively by the rAF loop.
// React only controls z-index, pointer-events, and overlay content.

interface OverlayItemProps {
	element: TypedOverlayCanvasElement;
	stackIndex: number;
	isSelected: boolean;
	onRegisterRef: (id: string, el: HTMLDivElement) => void;
	onUnregisterRef: (id: string) => void;
	updateOverlayElement: <K extends OverlayType>(
		elementId: string,
		type: K,
		payload: OverlayUpdatePayloadMap[K],
	) => void;
}

const OverlayItem = memo(
	function OverlayItem({
		element,
		stackIndex,
		isSelected,
		onRegisterRef,
		onUnregisterRef,
		updateOverlayElement,
	}: OverlayItemProps) {
		const [isEditing, setIsEditing] = useState(false);
		const isEditingRef = useRef(false);
		const divRef = useRef<HTMLDivElement>(null);

		const type = element.customData.type;
		const normalizedElement = useMemo(
			() => normalizeOverlayElement(type, element),
			[element, type],
		);

		// Register the DOM node with the parent so the rAF loop can patch it.
		useLayoutEffect(() => {
			const el = divRef.current;
			if (!el) return;
			onRegisterRef(normalizedElement.id, el);
			return () => onUnregisterRef(normalizedElement.id);
		}, [normalizedElement.id, onRegisterRef, onUnregisterRef]);

		const zIndex = getOverlayZIndex(isSelected, isEditing, stackIndex);

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
				ref={divRef}
				className="absolute"
				data-overlay-id={normalizedElement.id}
				data-overlay-type={type}
				data-testid={`overlay-item-${normalizedElement.id}`}
				style={{
					// Initial canvas-space position — rAF loop keeps this current every frame.
					left: normalizedElement.x,
					top: normalizedElement.y,
					width: normalizedElement.width,
					height: normalizedElement.height,
					transform: normalizedElement.angle ? `rotate(${normalizedElement.angle}rad)` : undefined,
					transformOrigin: 'center center',
					zIndex,
					pointerEvents: isSelected ? 'auto' : 'none',
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
	},
	(prev, next) =>
		prev.element === next.element &&
		prev.stackIndex === next.stackIndex &&
		prev.isSelected === next.isSelected &&
		prev.onRegisterRef === next.onRegisterRef &&
		prev.onUnregisterRef === next.onUnregisterRef &&
		prev.updateOverlayElement === next.updateOverlayElement,
);

// ─── CanvasNotesLayer ─────────────────────────────────────────────────────────
// Renders a single viewport-transform container in canvas space.
// A requestAnimationFrame loop reads live state from excalidrawApi and patches
// the container transform + each element's position directly — no React renders
// are triggered during pan, zoom, or drag.

export function CanvasNotesLayer() {
	const elements = useAppStore((s) => s.elements);
	const selectedElementIds = useAppStore(
		(s) => s.appState.selectedElementIds ?? EMPTY_SELECTED_ELEMENT_IDS,
	);
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);

	// Keep a ref so the rAF loop always sees the latest API handle without
	// re-subscribing every time the API becomes available.
	const excalidrawApiRef = useRef(excalidrawApi);
	useEffect(() => {
		excalidrawApiRef.current = excalidrawApi;
	}, [excalidrawApi]);

	// viewportRef: the single container that receives the viewport transform.
	// itemRefsRef: map of element id → overlay div, for per-element DOM patching.
	const viewportRef = useRef<HTMLDivElement>(null);
	const itemRefsRef = useRef<Map<string, HTMLDivElement>>(new Map());
	const rafRef = useRef<number>(0);

	// The rAF loop — runs every frame, independent of React's render cycle.
	// It applies scroll/zoom as a CSS transform on the container (eliminating the
	// coordinate math that React used to do) and patches each overlay's position
	// directly from the live Excalidraw scene (handling drag without lag).
	useLayoutEffect(() => {
		function syncPositions() {
			const api = excalidrawApiRef.current;
			const container = viewportRef.current;

			if (api && container) {
				const { scrollX, scrollY, zoom } = api.getAppState();
				// Single transform covers all overlays — no per-element scroll math.
				container.style.transform = `scale(${zoom.value}) translate(${scrollX}px, ${scrollY}px)`;

				// Patch each registered overlay to its live canvas position.
				// This is what eliminates the drag desync: we read from Excalidraw's
				// internal state (which is updated synchronously during drag) rather
				// than waiting for React to re-render.
				for (const el of api.getSceneElements()) {
					const itemEl = itemRefsRef.current.get(el.id);
					if (!itemEl) continue;
					itemEl.style.left = `${el.x}px`;
					itemEl.style.top = `${el.y}px`;
					itemEl.style.width = `${el.width}px`;
					itemEl.style.height = `${el.height}px`;
					itemEl.style.transform = el.angle ? `rotate(${el.angle}rad)` : '';
				}
			}

			rafRef.current = requestAnimationFrame(syncPositions);
		}

		rafRef.current = requestAnimationFrame(syncPositions);
		return () => cancelAnimationFrame(rafRef.current);
	}, []); // Intentionally empty — the loop runs for the lifetime of this component.

	const overlayElements = useMemo(() => collectOverlayElements(elements), [elements]);

	const onRegisterRef = useCallback((id: string, el: HTMLDivElement) => {
		itemRefsRef.current.set(id, el);
	}, []);

	const onUnregisterRef = useCallback((id: string) => {
		itemRefsRef.current.delete(id);
	}, []);

	const updateOverlayElement = useCallback(
		<K extends OverlayType>(elementId: string, type: K, payload: OverlayUpdatePayloadMap[K]) => {
			const { elements: currentElements, excalidrawApi: api, setElements } = useAppStore.getState();
			if (!api) return;

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

			api.updateScene({ elements: nextElements });
			setElements(nextElements);
		},
		[],
	);

	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 2 }}>
			{/*
			 * Viewport-transform container: sits in canvas-space (top-left = canvas origin).
			 * The rAF loop applies scale + translate here, so all children are automatically
			 * positioned relative to the canvas coordinate system.
			 */}
			<div
				ref={viewportRef}
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					transformOrigin: '0 0',
				}}
			>
				{overlayElements.map((element, stackIndex) => (
					<OverlayItem
						key={element.id}
						element={element}
						stackIndex={stackIndex}
						isSelected={selectedElementIds[element.id] === true}
						onRegisterRef={onRegisterRef}
						onUnregisterRef={onUnregisterRef}
						updateOverlayElement={updateOverlayElement}
					/>
				))}
			</div>
		</div>
	);
}
