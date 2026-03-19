import {
	type OverlayUpdatePayloadMap,
	type TypedOverlayCanvasElement,
	getOverlayDefinition,
} from '@/components/canvas/overlay-definitions';
import {
	applyOverlayUpdateToScene,
	collectOverlayElements,
} from '@/components/canvas/overlay-registry';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useAppStore } from '@/stores/store';
import type { OverlayType } from '@ai-canvas/shared/types';
import { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useExpandedOverlayState } from './useExpandedOverlayState';

function CloseIcon() {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-4 w-4"
			aria-hidden="true"
		>
			<path d="M5 5 15 15" />
			<path d="m15 5-10 10" />
		</svg>
	);
}

function ResizeHandle({
	handle,
	className,
	onStartResize,
}: {
	handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
	className: string;
	onStartResize: ReturnType<typeof useExpandedOverlayState>['startResize'];
}) {
	return (
		<div
			className={`absolute z-20 ${className}`}
			onMouseDown={(event) => onStartResize(handle, event)}
		/>
	);
}

function ExpandedOverlayShell({
	element,
	onClose,
}: {
	element: TypedOverlayCanvasElement;
	onClose: () => void;
}) {
	const { rect, startResize } = useExpandedOverlayState({ onClose });
	const elementId = element.id;
	const elementType = element.customData.type as OverlayType;
	const shellElement = useMemo(
		() => ({
			...element,
			width: rect.width,
			height: rect.height,
		}),
		[element, rect.height, rect.width],
	);

	const handleChange = useCallback(
		<K extends OverlayType>(type: K, payload: OverlayUpdatePayloadMap[K]) => {
			const { elements, excalidrawApi, setElements } = useAppStore.getState();
			if (!excalidrawApi) return;

			const { didChange, nextElements } = applyOverlayUpdateToScene(
				elements,
				elementId,
				type,
				payload,
			);
			if (!didChange) return;

			excalidrawApi.updateScene({ elements: nextElements });
			setElements(nextElements);
		},
		[elementId],
	);

	const definition = getOverlayDefinition(elementType);
	const handleRenderedChange = useCallback(
		(payload: OverlayUpdatePayloadMap[OverlayType]) => {
			handleChange(elementType, payload as never);
		},
		[handleChange, elementType],
	);

	return createPortal(
		<div
			className="fixed inset-0 z-[1400] bg-stone-950/35 backdrop-blur-[2px]"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) {
					onClose();
				}
			}}
		>
			<div
				className="absolute overflow-visible"
				style={{
					left: rect.x,
					top: rect.y,
					width: rect.width,
					height: rect.height,
				}}
				onMouseDown={(event) => event.stopPropagation()}
			>
				<button
					type="button"
					onClick={onClose}
					className="absolute -right-3 -top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 shadow-[0_14px_30px_rgba(244,63,94,0.18)] transition-colors hover:bg-rose-50 hover:text-rose-600"
					aria-label="Close expanded overlay"
					title="Close"
				>
					<CloseIcon />
				</button>

				<div className="h-full w-full overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_48px_120px_rgba(15,23,42,0.28)]">
					{definition.render({
						element: shellElement as never,
						isSelected: true,
						isActive: true,
						mode: 'shell',
						onChange: handleRenderedChange as never,
						onActivityChange: undefined,
					})}
				</div>

				<ResizeHandle
					handle="n"
					className="left-4 right-4 top-0 h-3 -translate-y-1/2 cursor-ns-resize"
					onStartResize={startResize}
				/>
				<ResizeHandle
					handle="s"
					className="bottom-0 left-4 right-4 h-3 translate-y-1/2 cursor-ns-resize"
					onStartResize={startResize}
				/>
				<ResizeHandle
					handle="e"
					className="bottom-4 right-0 top-4 w-3 translate-x-1/2 cursor-ew-resize"
					onStartResize={startResize}
				/>
				<ResizeHandle
					handle="w"
					className="bottom-4 left-0 top-4 w-3 -translate-x-1/2 cursor-ew-resize"
					onStartResize={startResize}
				/>
				<ResizeHandle
					handle="ne"
					className="right-0 top-0 h-5 w-5 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize"
					onStartResize={startResize}
				/>
				<ResizeHandle
					handle="nw"
					className="left-0 top-0 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize"
					onStartResize={startResize}
				/>
				<ResizeHandle
					handle="se"
					className="bottom-0 right-0 h-5 w-5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize"
					onStartResize={startResize}
				/>
				<ResizeHandle
					handle="sw"
					className="bottom-0 left-0 h-5 w-5 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize"
					onStartResize={startResize}
				/>
			</div>
		</div>,
		document.body,
	);
}

function ExpandedOverlayMissingGuard({ onClose }: { onClose: () => void }) {
	useMountEffect(() => {
		onClose();
	});

	return null;
}

export function ExpandedOverlayLayer() {
	const expandedOverlayId = useAppStore((s) => s.expandedOverlayId);
	const elements = useAppStore((s) => s.elements);
	const closeExpandedOverlay = useAppStore((s) => s.closeExpandedOverlay);

	if (!expandedOverlayId || typeof document === 'undefined') {
		return null;
	}

	const overlayElements = collectOverlayElements(elements);
	const expandedElement =
		overlayElements.find((candidate) => candidate.id === expandedOverlayId) ?? null;

	if (!expandedElement) {
		return <ExpandedOverlayMissingGuard onClose={closeExpandedOverlay} />;
	}

	return (
		<ExpandedOverlayShell
			key={expandedElement.id}
			element={expandedElement}
			onClose={closeExpandedOverlay}
		/>
	);
}
