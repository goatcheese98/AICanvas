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
import { applyOverlayUpdateByType, collectOverlayElements } from './overlay-registry';
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
		isSelected,
		onRegisterRef,
		onUnregisterRef,
		updateOverlayElement,
	}: OverlayItemProps) {
		const [isEditing, setIsEditing] = useState(false);
		const isEditingRef = useRef(false);
		const divRef = useRef<HTMLDivElement>(null);
		// Expose editing state as a data attribute so the rAF loop can read it without
		// a React re-render — the loop uses this to keep editing overlays in front.
		useEffect(() => {
			if (divRef.current) divRef.current.dataset.editing = String(isEditing);
		}, [isEditing]);

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
					// z-index is computed and patched every rAF frame based on scene order:
					// 0  → behind static canvas (native shapes cover the overlay)
					// 2  → above static canvas (no native element is higher in scene order)
					// 10 → above interactive canvas (selected or editing)
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
				const { scrollX, scrollY, zoom, selectedElementIds } = api.getAppState();
				// Single transform covers all overlays — no per-element scroll math.
				container.style.transform = `scale(${zoom.value}) translate(${scrollX}px, ${scrollY}px)`;

				const allElements = api.getSceneElements();
				const itemRefs = itemRefsRef.current;

				// Build a set of overlay IDs for O(1) lookup when computing z-index.
				const overlayIds = new Set(itemRefs.keys());

				// Build a position map: element id → index in scene order.
				const scenePos = new Map<string, number>();
				for (let i = 0; i < allElements.length; i++) {
					scenePos.set(allElements[i].id, i);
				}

				// Patch each registered overlay to its live canvas position and z-index.
				// This is what eliminates the drag desync: we read from Excalidraw's
				// internal state (which is updated synchronously during drag) rather
				// than waiting for React to re-render.
				for (const el of allElements) {
					const itemEl = itemRefs.get(el.id);
					if (!itemEl) continue;
					itemEl.style.left = `${el.x}px`;
					itemEl.style.top = `${el.y}px`;
					itemEl.style.width = `${el.width}px`;
					itemEl.style.height = `${el.height}px`;
					itemEl.style.transform = el.angle ? `rotate(${el.angle}rad)` : '';

					// Z-index: derive from scene order so native shapes can appear above overlays.
					// The Excalidraw static canvas is transparent (viewBackgroundColor = 'transparent')
					// so overlays at z-index 0 are visible through the canvas between shapes, while
					// canvas-drawn shapes paint over them wherever a shape overlaps.
					const isSelected = selectedElementIds[el.id] === true;
					const isEditing = itemEl.dataset.editing === 'true';

					let zIndex: number;
					if (isSelected || isEditing) {
						// Editing/selected overlays always stay in front of everything.
						zIndex = 10;
					} else {
						// Check if any non-overlay, non-deleted element appears after this overlay
						// in scene order (i.e., is "in front" of it).
						const myPos = scenePos.get(el.id) ?? -1;
						let hasNativeAbove = false;
						for (let i = myPos + 1; i < allElements.length; i++) {
							const candidate = allElements[i];
							if (!candidate.isDeleted && !overlayIds.has(candidate.id)) {
								hasNativeAbove = true;
								break;
							}
						}
						// 0 → behind static canvas (native shapes cover the overlay where drawn)
						// 2 → above static canvas (z-index: 1) but below interactive canvas (z-index: 3)
						zIndex = hasNativeAbove ? 0 : 2;
					}
					itemEl.style.zIndex = String(zIndex);
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
		<div className="pointer-events-none absolute inset-0 overflow-hidden">
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
				{overlayElements.map((element) => (
					<OverlayItem
						key={element.id}
						element={element}
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
