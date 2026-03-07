import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { OverlayType } from '@ai-canvas/shared/types';
import { useAppStore } from '@/stores/store';
import { MarkdownNote } from '@/components/overlays/markdown';
import { LexicalNote } from '@/components/overlays/lexical';
import { KanbanBoard } from '@/components/overlays/kanban';
import { WebEmbed } from '@/components/overlays/web-embed';
import {
	applyOverlayUpdateByType,
	collectOverlayElements,
	getOverlayZIndex,
	type TypedOverlayCanvasElement,
	type OverlayUpdatePayloadMap,
} from './overlay-registry';

function getNormalizedAppState(appState: Partial<AppState>) {
	return {
		scrollX: appState.scrollX ?? 0,
		scrollY: appState.scrollY ?? 0,
		zoom: {
			value: appState.zoom?.value ?? 1,
		},
		selectedElementIds: appState.selectedElementIds ?? {},
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
	const appState = useAppStore((s) => s.appState);
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const setElements = useAppStore((s) => s.setElements);
	const [editingElementId, setEditingElementId] = useState<string | null>(null);

	const overlayElements = useMemo(() => collectOverlayElements(elements), [elements]);
	const normalizedAppState = useMemo(() => getNormalizedAppState(appState), [appState]);

	const updateOverlayElement = useCallback(
		<K extends OverlayType>(elementId: string, type: K, payload: OverlayUpdatePayloadMap[K]) => {
			if (!excalidrawApi) return;

			const nextElements = elements.map((candidate) => {
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
		[elements, excalidrawApi, onOverlaySceneChange, setElements],
	);

	const renderOverlay = useCallback(
		(element: TypedOverlayCanvasElement, stackIndex: number) => {
			const isSelected = normalizedAppState.selectedElementIds[element.id] === true;
			const containerStyle = getOverlayContainerStyle(
				element,
				normalizedAppState,
				getOverlayZIndex(isSelected, editingElementId === element.id, stackIndex),
			);

			const interactionEnabled = isSelected || editingElementId === element.id;

			let content: ReactNode = null;

			switch (element.customData.type) {
				case 'markdown':
					content = (
						<MarkdownNote
							element={element as any}
							isSelected={isSelected}
							onChange={(elementId, contentValue, images, settings, editorMode, elementStyle) =>
								updateOverlayElement(elementId, 'markdown', {
									content: contentValue,
									images,
									settings,
									editorMode,
									elementStyle,
								})
							}
							onEditingChange={(isEditing) => setEditingElementId(isEditing ? element.id : null)}
						/>
					);
					break;
				case 'newlex':
					content = (
						<LexicalNote
							element={element as any}
							isSelected={isSelected}
							onChange={(elementId, updates) => updateOverlayElement(elementId, 'newlex', updates)}
							onEditingChange={(isEditing) => setEditingElementId(isEditing ? element.id : null)}
						/>
					);
					break;
				case 'kanban':
					content = (
						<KanbanBoard
							element={element as any}
							isSelected={isSelected}
							onChange={(elementId, data) => updateOverlayElement(elementId, 'kanban', data)}
							onEditingChange={(isEditing) => setEditingElementId(isEditing ? element.id : null)}
						/>
					);
					break;
				case 'web-embed':
					content = (
						<WebEmbed
							element={element as any}
							isSelected={isSelected}
							onChange={(elementId, url) => updateOverlayElement(elementId, 'web-embed', { url })}
							onEditingChange={(isEditing) => setEditingElementId(isEditing ? element.id : null)}
						/>
					);
					break;
			}

			return (
				<div
					key={element.id}
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
		[editingElementId, normalizedAppState, updateOverlayElement],
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
