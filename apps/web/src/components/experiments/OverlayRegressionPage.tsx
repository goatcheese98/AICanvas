import { useEffect, useMemo, useRef, useState } from 'react';
import '@excalidraw/excalidraw/index.css';
import { CanvasCore } from '@/components/canvas/CanvasCore';
import { CanvasNotesLayer } from '@/components/canvas/CanvasNotesLayer';
import { createOverlayElementDraft } from '@/components/canvas/element-factories';
import { collectOverlayElements } from '@/components/canvas/overlay-registry';
import { useAppStore } from '@/stores/store';
import type { OverlayType } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

type OverlayReference = {
	id: string;
	type: OverlayType;
	left: number;
	top: number;
	width: number;
	height: number;
	transform: string;
};

function getOverlayReferenceStyle(
	element: ExcalidrawElement & { customData: { type: OverlayType } },
	appState: Partial<AppState>,
) {
	const zoom = appState.zoom?.value ?? 1;
	const scrollX = appState.scrollX ?? 0;
	const scrollY = appState.scrollY ?? 0;
	const screenCenterX = (element.x + element.width / 2 + scrollX) * zoom;
	const screenCenterY = (element.y + element.height / 2 + scrollY) * zoom;

	return {
		id: element.id,
		type: element.customData.type,
		left: screenCenterX - element.width / 2,
		top: screenCenterY - element.height / 2,
		width: element.width,
		height: element.height,
		transform: `scale(${zoom}) rotate(${element.angle || 0}rad)`,
	} satisfies OverlayReference;
}

function createZoom(value: number) {
	return { value: value as never };
}

function syncStoreFromApi(excalidrawApi: ExcalidrawImperativeAPI) {
	const { setAppState, setElements, setFiles } = useAppStore.getState();
	setElements([...excalidrawApi.getSceneElements()]);
	setAppState({
		...excalidrawApi.getAppState(),
		selectedElementIds: { ...(excalidrawApi.getAppState().selectedElementIds ?? {}) },
		zoom:
			excalidrawApi.getAppState().zoom && typeof excalidrawApi.getAppState().zoom === 'object'
				? { ...excalidrawApi.getAppState().zoom }
				: excalidrawApi.getAppState().zoom,
	});
	setFiles({ ...excalidrawApi.getFiles() });
}

function createSeedElement(
	type: OverlayType,
	center: { x: number; y: number },
	id: string,
	customData?: Record<string, unknown>,
) {
	const draft = createOverlayElementDraft(type, center, customData);
	return {
		...draft,
		id,
		versionNonce: draft.versionNonce + 1,
	} as unknown as ExcalidrawElement;
}

function buildSeedScene() {
	const markdown = createSeedElement('markdown', { x: 420, y: 320 }, 'regression-markdown', {
		title: 'Markdown',
		content: '# Regression\n\nDrag me with confidence.',
	});
	const kanban = createSeedElement('kanban', { x: 1120, y: 470 }, 'regression-kanban', {
		title: 'Kanban',
		columns: [
			{
				id: 'todo',
				title: 'Todo',
				cards: [
					{
						id: 'card-1',
						title: 'Lock drag',
						description: 'Stay aligned.',
						priority: 'medium',
						checklist: [],
					},
				],
			},
			{
				id: 'doing',
				title: 'Doing',
				cards: [],
			},
		],
	});

	return {
		elements: [markdown, kanban],
		appState: {
			scrollX: 0,
			scrollY: 0,
			zoom: createZoom(1),
			selectedElementIds: {},
			viewBackgroundColor: '#f5f5f4',
		} satisfies Partial<AppState>,
	};
}

function getInsertedOverlayCenter(type: OverlayType, sequence: number) {
	if (type === 'markdown') {
		return { x: 820, y: 210 + sequence * 70 };
	}

	return { x: 1080, y: 640 + sequence * 120 };
}

function resizeOverlayElement(
	element: ExcalidrawElement,
	nextSize: { width: number; height: number },
) {
	return {
		...element,
		width: nextSize.width,
		height: nextSize.height,
		version: element.version + 1,
		versionNonce: element.versionNonce + 1,
	};
}

function OverlayReferenceLayer() {
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const [references, setReferences] = useState<OverlayReference[]>([]);

	useEffect(() => {
		if (!excalidrawApi) {
			setReferences([]);
			return;
		}

		let frameId = 0;

		const update = () => {
			const elements = collectOverlayElements(excalidrawApi.getSceneElements());
			const appState = excalidrawApi.getAppState();
			setReferences(
				elements.map((element) =>
					getOverlayReferenceStyle(
						element as ExcalidrawElement & { customData: { type: OverlayType } },
						appState,
					),
				),
			);
			frameId = window.requestAnimationFrame(update);
		};

		update();
		return () => window.cancelAnimationFrame(frameId);
	}, [excalidrawApi]);

	return (
		<div className="pointer-events-none absolute inset-0" data-testid="overlay-reference-layer">
			{references.map((reference) => (
				<div
					key={reference.id}
					data-testid={`overlay-reference-${reference.id}`}
					data-overlay-type={reference.type}
					style={{
						position: 'absolute',
						left: reference.left,
						top: reference.top,
						width: reference.width,
						height: reference.height,
						transform: reference.transform,
						transformOrigin: 'center center',
						border: '2px dashed rgba(220, 38, 38, 0.85)',
						boxSizing: 'border-box',
						zIndex: 1,
					}}
				/>
			))}
		</div>
	);
}

export function OverlayRegressionPage() {
	const excalidrawApi = useAppStore((s) => s.excalidrawApi);
	const elementCount = useAppStore((s) => s.elements.length);
	const [zoomLabel, setZoomLabel] = useState('100%');
	const [lastInsertedIds, setLastInsertedIds] = useState<Record<OverlayType, string | null>>({
		markdown: null,
		kanban: null,
		newlex: null,
		'web-embed': null,
		prototype: null,
	});
	const insertionCountRef = useRef<Record<OverlayType, number>>({
		markdown: 0,
		kanban: 0,
		newlex: 0,
		'web-embed': 0,
		prototype: 0,
	});

	const seedScene = useMemo(() => buildSeedScene(), []);
	const initialData = useMemo(
		() => ({
			elements: seedScene.elements,
			appState: seedScene.appState,
			files: {},
		}),
		[seedScene],
	);

	useEffect(() => {
		useAppStore.setState({
			elements: seedScene.elements,
			appState: seedScene.appState,
			files: {},
		});
		insertionCountRef.current = {
			markdown: 0,
			kanban: 0,
			newlex: 0,
			'web-embed': 0,
			prototype: 0,
		};
		setLastInsertedIds({
			markdown: null,
			kanban: null,
			newlex: null,
			'web-embed': null,
			prototype: null,
		});
		setZoomLabel('100%');
	}, [seedScene]);

	const setZoom = (value: number) => {
		if (!excalidrawApi) return;
		const nextAppState = {
			...excalidrawApi.getAppState(),
			scrollX: 0,
			scrollY: 0,
			zoom: createZoom(value),
		};
		excalidrawApi.updateScene({ appState: nextAppState });
		syncStoreFromApi(excalidrawApi);
		setZoomLabel(`${Math.round(value * 100)}%`);
	};

	const panViewport = (deltaX: number, deltaY: number) => {
		if (!excalidrawApi) return;
		const currentAppState = excalidrawApi.getAppState();
		excalidrawApi.updateScene({
			appState: {
				...currentAppState,
				scrollX: (currentAppState.scrollX ?? 0) + deltaX,
				scrollY: (currentAppState.scrollY ?? 0) + deltaY,
			},
		});
		syncStoreFromApi(excalidrawApi);
	};

	const resizeSeedOverlays = () => {
		if (!excalidrawApi) return;
		const currentElements = excalidrawApi.getSceneElements();
		const nextElements = currentElements.map((element) => {
			if (element.id === 'regression-markdown') {
				return resizeOverlayElement(element, { width: 680, height: 620 });
			}

			if (element.id === 'regression-kanban') {
				return resizeOverlayElement(element, { width: 980, height: 640 });
			}

			return element;
		});

		excalidrawApi.updateScene({ elements: nextElements });
		syncStoreFromApi(excalidrawApi);
	};

	const resetScene = () => {
		if (!excalidrawApi) return;
		excalidrawApi.updateScene({
			elements: seedScene.elements,
			appState: seedScene.appState,
		});
		syncStoreFromApi(excalidrawApi);
		insertionCountRef.current = {
			markdown: 0,
			kanban: 0,
			newlex: 0,
			'web-embed': 0,
			prototype: 0,
		};
		setLastInsertedIds({
			markdown: null,
			kanban: null,
			newlex: null,
			'web-embed': null,
			prototype: null,
		});
		setZoomLabel('100%');
	};

	const insertOverlay = (type: OverlayType) => {
		if (!excalidrawApi) return;

		const nextSequence = insertionCountRef.current[type] + 1;
		insertionCountRef.current[type] = nextSequence;
		const overlayId = `inserted-${type}-${nextSequence}`;
		const center = getInsertedOverlayCenter(type, nextSequence);
		const customData =
			type === 'markdown'
				? {
						title: 'Markdown',
						content: `# Inserted ${nextSequence}\n\nStill locked.`,
					}
				: type === 'kanban'
					? {
							title: 'Kanban',
							columns: [
								{
									id: `todo-${nextSequence}`,
									title: 'Todo',
									cards: [
										{
											id: `card-${nextSequence}`,
											title: 'Inserted',
											description: 'Drag stays aligned.',
											priority: 'medium',
											checklist: [],
										},
									],
								},
							],
						}
					: undefined;

		const draft = createSeedElement(type, center, overlayId, customData);
		const currentElements = excalidrawApi.getSceneElements();
		const nextElements = [...currentElements, draft];
		const nextAppState = {
			...excalidrawApi.getAppState(),
			selectedElementIds: {
				[overlayId]: true as const,
			},
		};

		excalidrawApi.updateScene({
			elements: nextElements,
			appState: nextAppState,
		});
		syncStoreFromApi(excalidrawApi);
		setLastInsertedIds((current) => ({
			...current,
			[type]: overlayId,
		}));
	};

	return (
		<div className="relative h-screen w-screen overflow-hidden bg-stone-100">
			<div className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-xl border border-stone-200 bg-white/96 p-3 shadow-lg backdrop-blur">
				<button
					type="button"
					data-testid="overlay-regression-reset"
					onClick={resetScene}
					className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800"
				>
					Reset Scene
				</button>
				<button
					type="button"
					data-testid="overlay-regression-zoom-100"
					onClick={() => setZoom(1)}
					className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800"
				>
					100%
				</button>
				<button
					type="button"
					data-testid="overlay-regression-zoom-150"
					onClick={() => setZoom(1.5)}
					className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800"
				>
					150%
				</button>
				<button
					type="button"
					data-testid="overlay-regression-insert-markdown"
					onClick={() => insertOverlay('markdown')}
					className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800"
				>
					Insert Markdown
				</button>
				<button
					type="button"
					data-testid="overlay-regression-insert-kanban"
					onClick={() => insertOverlay('kanban')}
					className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800"
				>
					Insert Kanban
				</button>
				<button
					type="button"
					data-testid="overlay-regression-pan-view"
					onClick={() => panViewport(160, 45)}
					className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800"
				>
					Pan View
				</button>
				<button
					type="button"
					data-testid="overlay-regression-resize-seeds"
					onClick={resizeSeedOverlays}
					className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800"
				>
					Resize Seeds
				</button>
				<div
					className="rounded-md bg-stone-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500"
					data-testid="overlay-regression-zoom-label"
				>
					{zoomLabel}
				</div>
			</div>

			<div className="absolute right-4 top-4 z-30 rounded-xl border border-stone-200 bg-white/96 p-3 text-xs text-stone-600 shadow-lg backdrop-blur">
				<div className="font-semibold uppercase tracking-[0.18em] text-stone-500">
					Overlay Regression
				</div>
				<div className="mt-1 max-w-xs leading-relaxed">
					Dashed red frames are API-derived live references. The real overlay DOM should stay locked
					to them while dragging and zooming.
				</div>
				<div className="mt-2 flex items-center gap-2 text-[11px]">
					<span data-testid="overlay-regression-api-state">
						API: {excalidrawApi ? 'ready' : 'waiting'}
					</span>
					<span data-testid="overlay-regression-element-count">Elements: {elementCount}</span>
				</div>
				<div className="mt-1 flex flex-col gap-1 text-[11px]">
					<span data-testid="overlay-regression-last-markdown-id">
						Last Markdown: {lastInsertedIds.markdown ?? 'none'}
					</span>
					<span data-testid="overlay-regression-last-kanban-id">
						Last Kanban: {lastInsertedIds.kanban ?? 'none'}
					</span>
				</div>
			</div>

			<CanvasCore canvasId="overlay-regression" initialData={initialData} />
			<OverlayReferenceLayer />
			{excalidrawApi ? <CanvasNotesLayer canvasId="overlay-regression" /> : null}
		</div>
	);
}
