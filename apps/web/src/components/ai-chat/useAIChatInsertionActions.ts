import {
	createOverlayElementDraft,
	getOverlayDefaults,
	getViewportSceneCenter,
} from '@/components/canvas/element-factories';
import { syncAppStoreFromExcalidraw } from '@/components/canvas/excalidraw-store-sync';
import { applyOverlayUpdateByType } from '@/components/canvas/overlay-registry';
import { parseStoredAssistantAssetContent } from '@ai-canvas/shared/schemas';
import { fetchAssistantArtifactAsset, getRequiredAuthHeaders } from '@/lib/api';
import { svgToDataUrl } from '@/lib/assistant/diagram-renderer';
import { vectorizeRasterBlobToSvg } from '@/lib/assistant/raster-to-svg';
import { vectorizeRasterBlobToSketchElements } from '@/lib/assistant/sketch-vectorizer';
import { compileSvgToExcalidraw } from '@/lib/assistant/svg-to-excalidraw';
import { normalizeKanbanOverlay, normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantContextMode,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
	BinaryFileData,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { type Dispatch, type SetStateAction, useCallback } from 'react';
import {
	createCanvasImageElement,
	getConvertToExcalidrawElements,
	getSelectedKanbanElement,
	getSelectedPrototypeElement,
} from './ai-chat-canvas';
import {
	applyInsertedElements,
	removeInsertedArtifactFromScene,
	resolveInsertionSceneCenter,
	restoreCanvasSelectionState,
} from './ai-chat-canvas-mutations';
import type { AssistantInsertionState } from './ai-chat-types';
import {
	buildKanbanFromArtifact,
	buildMarkdownArtifactContent,
	buildPrototypeFromArtifact,
	buildPrototypeFromMessageContent,
} from './assistant-artifacts';

function buildDataUrlFromBlob(blob: Blob): Promise<BinaryFileData['dataURL']> {
	return blob.arrayBuffer().then((buffer) => {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}
		return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}` as BinaryFileData['dataURL'];
	});
}

function getFallbackImageDimensions() {
	return { width: 1024, height: 1024 };
}

async function getImageDimensions(dataURL: string): Promise<{ width: number; height: number }> {
	if (typeof Image === 'undefined') {
		return getFallbackImageDimensions();
	}

	return new Promise((resolve) => {
		const image = new Image();
		const fallbackTimer = window.setTimeout(() => resolve(getFallbackImageDimensions()), 150);
		const settle = (value: { width: number; height: number }) => {
			window.clearTimeout(fallbackTimer);
			resolve(value);
		};
		image.onload = () => {
			settle({
				width: image.naturalWidth || image.width || getFallbackImageDimensions().width,
				height: image.naturalHeight || image.height || getFallbackImageDimensions().height,
			});
		};
		image.onerror = () => settle(getFallbackImageDimensions());
		image.src = dataURL;
	});
}

function constrainImageSize(input: { width: number; height: number }) {
	const maxDimension = 480;
	const width = Math.max(1, Math.round(input.width));
	const height = Math.max(1, Math.round(input.height));
	const scale = Math.min(1, maxDimension / Math.max(width, height));
	return {
		width: Math.max(160, Math.round(width * scale)),
		height: Math.max(120, Math.round(height * scale)),
	};
}

function getElementsBounds(elements: readonly ExcalidrawElement[]) {
	const left = Math.min(...elements.map((element) => element.x));
	const top = Math.min(...elements.map((element) => element.y));
	const right = Math.max(...elements.map((element) => element.x + Math.abs(element.width ?? 0)));
	const bottom = Math.max(...elements.map((element) => element.y + Math.abs(element.height ?? 0)));
	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function offsetInsertedElements(
	elements: readonly ExcalidrawElement[],
	offset: { x: number; y: number },
): ExcalidrawElement[] {
	return elements.map((element) => ({
		...element,
		x: element.x + offset.x,
		y: element.y + offset.y,
		updated: Date.now(),
	}));
}

interface NativeVectorCompileResult {
	elements: ExcalidrawElement[];
	width: number;
	height: number;
}

export function useAIChatInsertionActions({
	getToken,
	excalidrawApi,
	elements,
	selectedElementIds,
	setElements,
	setFiles,
	setChatError,
	assistantInsertionStates,
	setAssistantInsertionStates,
}: {
	getToken: () => Promise<string | null>;
	excalidrawApi: ExcalidrawImperativeAPI | null;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
	setElements: (elements: readonly ExcalidrawElement[]) => void;
	setFiles: (files: BinaryFiles) => void;
	setChatError: (error: string | null) => void;
	assistantInsertionStates: Record<string, AssistantInsertionState>;
	setAssistantInsertionStates: Dispatch<SetStateAction<Record<string, AssistantInsertionState>>>;
}) {
	const removeInsertedArtifact = useCallback(
		(artifactKey: string) => {
			const insertionState = assistantInsertionStates[artifactKey];
			if (!insertionState || !excalidrawApi) {
				return;
			}

			removeInsertedArtifactFromScene({
				excalidrawApi,
				setElements,
				setFiles,
				insertionState,
			});
			setAssistantInsertionStates((current) => ({
				...current,
				[artifactKey]: {
					...insertionState,
					status: 'removed',
				},
			}));
		},
		[assistantInsertionStates, excalidrawApi, setAssistantInsertionStates, setElements, setFiles],
	);

	const insertMarkdownOnCanvas = useCallback(
		async (content: string): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			const convertToExcalidrawElements = await getConvertToExcalidrawElements();
			const { width, height } = getOverlayDefaults('markdown');
			const sceneCenter = resolveInsertionSceneCenter({
				excalidrawApi,
				elements,
				selectedElementIds,
				width,
				height,
			});
			const draft = createOverlayElementDraft('markdown', sceneCenter, { content });
			const converted = convertToExcalidrawElements([draft as never]);
			return applyInsertedElements({
				excalidrawApi,
				setElements,
				insertedElements: converted,
			});
		},
		[elements, excalidrawApi, selectedElementIds, setChatError, setElements],
	);

	const insertRenderedDiagramOnCanvas = useCallback(
		async (input: {
			title: string;
			svgMarkup: string;
			width: number;
			height: number;
			diagram: {
				language: 'mermaid' | 'd2';
				code: string;
			};
		}): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			const dataURL = svgToDataUrl(input.svgMarkup) as BinaryFileData['dataURL'];
			const fileId = crypto.randomUUID() as BinaryFileData['id'];
			const now = Date.now();
			const imageFile: BinaryFileData = {
				id: fileId,
				mimeType: 'image/svg+xml',
				dataURL,
				created: now,
			};
			const currentElements = excalidrawApi.getSceneElements();
			const currentFiles = excalidrawApi.getFiles();
			const width = Math.max(200, Math.round(input.width));
			const height = Math.max(120, Math.round(input.height));
			const sceneCenter = resolveInsertionSceneCenter({
				excalidrawApi,
				elements,
				selectedElementIds,
				width,
				height,
			});
			const imageElement = createCanvasImageElement({
				fileId,
				x: sceneCenter.x - width / 2,
				y: sceneCenter.y - height / 2,
				width,
				height,
				customData: {
					type: 'ai-generated-diagram',
					title: input.title,
					language: input.diagram.language,
					code: input.diagram.code,
				},
			});

			excalidrawApi.addFiles([imageFile]);
			excalidrawApi.updateScene({
				elements: [...currentElements, imageElement],
				appState: {
					isCropping: false,
					croppingElementId: null,
					selectedElementIds: { [imageElement.id]: true },
				},
			});
			restoreCanvasSelectionState(excalidrawApi);
			syncAppStoreFromExcalidraw(excalidrawApi);
			setFiles({
				...currentFiles,
				[fileId]: imageFile,
			});
			return {
				status: 'inserted',
				insertedElementIds: [String(imageElement.id)],
				insertedFileIds: [fileId],
			};
		},
		[elements, excalidrawApi, selectedElementIds, setChatError, setElements, setFiles],
	);

	const insertSvgMarkupOnCanvas = useCallback(
		async (svgMarkup: string): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			try {
				const compiled = compileSvgToExcalidraw(svgMarkup, {
					customData: {
						source: 'assistant-svg-message',
					},
				});
				const bounds = getElementsBounds(compiled.elements);
				const sceneCenter = resolveInsertionSceneCenter({
					excalidrawApi,
					elements,
					selectedElementIds,
					width: compiled.width,
					height: compiled.height,
				});
				return applyInsertedElements({
					excalidrawApi,
					setElements,
					insertedElements: offsetInsertedElements(compiled.elements, {
						x: sceneCenter.x - (bounds.left + bounds.width / 2),
						y: sceneCenter.y - (bounds.top + bounds.height / 2),
					}),
				});
			} catch {
				setChatError('This SVG could not be converted into native canvas elements.');
				return null;
			}
		},
		[elements, excalidrawApi, selectedElementIds, setChatError, setElements],
	);

	const insertNativeVectorElementsOnCanvas = useCallback(
		async (compiled: NativeVectorCompileResult): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			const bounds = getElementsBounds(compiled.elements);
			const sceneCenter = resolveInsertionSceneCenter({
				excalidrawApi,
				elements,
				selectedElementIds,
				width: compiled.width,
				height: compiled.height,
			});
			const positioned = offsetInsertedElements(compiled.elements, {
				x: sceneCenter.x - (bounds.left + bounds.width / 2),
				y: sceneCenter.y - (bounds.top + bounds.height / 2),
			});

			// Group ALL elements by their backgroundColor into distinct color layers.
			// "Max layers" (not max elements) is the correct cap: each rendering pass
			// inserts all elements of one color simultaneously, building the image
			// layer by layer like a painter — large base shapes first, details last.
			// This prevents individual elements from landing at wrong z-depths.
			type ElementWithBg = ExcalidrawElement & { backgroundColor?: string };
			const MAX_LAYERS = 20;
			const colorMap = new Map<string, ExcalidrawElement[]>();
			for (const el of positioned) {
				const fill = (el as ElementWithBg).backgroundColor ?? 'transparent';
				const group = colorMap.get(fill) ?? [];
				group.push(el);
				colorMap.set(fill, group);
			}

			// Sort color groups by their largest element's bounding-box area:
			// large regions (body fills) render first/behind, small details last/on top.
			// Stroke-only outlines (transparent background) always go last so they
			// draw over fills — they don't cover fills since backgroundColor is transparent.
			const sortedGroups = [...colorMap.entries()]
				.map(([color, els]) => ({
					color,
					elements: els,
					area: Math.max(...els.map((el) => (el.width ?? 0) * (el.height ?? 0))),
				}))
				.sort((a, b) => {
					if (a.color === 'transparent') return 1;
					if (b.color === 'transparent') return -1;
					return b.area - a.area;
				});

			// Merge overflow groups into adjacent layers to honour MAX_LAYERS.
			// Smallest groups merge into the preceding layer (least disruptive visually).
			while (sortedGroups.length > MAX_LAYERS) {
				const last = sortedGroups.pop()!;
				sortedGroups[sortedGroups.length - 1].elements.push(...last.elements);
			}

			// Assign nested groupIds so layers are independently selectable:
			//   single-click  → select the element
			//   double-click  → select the color layer (all elements of this color)
			//   triple-click  → select the entire vectorized image
			// groupIds[0] = layer group (inner), groupIds[1] = overall group (outer).
			const overallGroupId =
				(positioned[0] as ExcalidrawElement & { groupIds?: string[] })?.groupIds?.[0] ??
				crypto.randomUUID();
			const layers = sortedGroups.map((g, i) => {
				const layerGroupId = `${overallGroupId}-layer-${i}`;
				return g.elements.map((el) => ({
					...el,
					groupIds: [layerGroupId, overallGroupId],
				})) as ExcalidrawElement[];
			});

			// Insert one layer at a time so each fill layer renders before the next is placed.
			// This creates a visible build-up and prevents Excalidraw from rendering all
			// complex polygons in the same layout pass, which can cause Rough.js to skip fills.
			const LAYER_DELAY_MS = 80;
			const allInsertedIds: string[] = [];

			for (let i = 0; i < layers.length; i += 1) {
				const layer = layers[i];
				const current = excalidrawApi.getSceneElements();
				for (const el of layer) allInsertedIds.push(String(el.id));

				excalidrawApi.updateScene({
					elements: [...current, ...layer],
					appState: {
						isCropping: false,
						croppingElementId: null,
						selectedElementIds: Object.fromEntries(allInsertedIds.map((id) => [id, true])),
					},
				});

				if (i < layers.length - 1) {
					await new Promise<void>((resolve) => {
						setTimeout(resolve, LAYER_DELAY_MS);
					});
				}
			}

			restoreCanvasSelectionState(excalidrawApi);
			syncAppStoreFromExcalidraw(excalidrawApi);
			return { status: 'inserted', insertedElementIds: allInsertedIds };
		},
		[elements, excalidrawApi, selectedElementIds, setChatError, setElements],
	);

	const compileRasterBlobToNativeVector = useCallback(
		async (blob: Blob, customData: Record<string, unknown>): Promise<NativeVectorCompileResult> => {
			try {
				return await vectorizeRasterBlobToSketchElements(blob, {
					controls: { colorPalette: 10 },
					customData,
				});
			} catch {
				const svgMarkup = await vectorizeRasterBlobToSvg(blob, {
					maxSampleDimension: 192,
					maxColors: 5,
				});
				return compileSvgToExcalidraw(svgMarkup, {
					maxPointsPerElement: 36,
					maxElementCount: 60,
					customData,
				});
			}
		},
		[],
	);

	const vectorizeRasterAssetOnCanvas = useCallback(
		async (artifact: AssistantArtifact): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			const storedAsset = parseStoredAssistantAssetContent(artifact.content);
			if (!storedAsset?.artifactId || !storedAsset.runId) {
				setChatError('This generated asset is missing a downloadable reference.');
				return null;
			}

			const headers = await getRequiredAuthHeaders(getToken);
			const { blob, mimeType } = await fetchAssistantArtifactAsset(
				storedAsset.runId,
				storedAsset.artifactId,
				headers,
			);
			const resolvedMimeType = mimeType || storedAsset.mimeType;
			if (!resolvedMimeType.startsWith('image/') || resolvedMimeType === 'image/svg+xml') {
				setChatError('Only raster image assets can be vectorized from this card.');
				return null;
			}

			try {
				const compiled = await compileRasterBlobToNativeVector(blob, {
					source: 'assistant-raster-vectorizer',
					provider: storedAsset.provider,
					model: storedAsset.model,
					prompt: storedAsset.prompt,
					artifactType: artifact.type,
				});
				return insertNativeVectorElementsOnCanvas(compiled);
			} catch (error) {
				setChatError(
					error instanceof Error
						? error.message
						: 'This raster sketch could not be vectorized natively.',
				);
				return null;
			}
		},
		[
			compileRasterBlobToNativeVector,
			excalidrawApi,
			getToken,
			insertNativeVectorElementsOnCanvas,
			setChatError,
		],
	);

	const insertSourceRasterAsNativeVector = useCallback(
		async (artifact: AssistantArtifact): Promise<AssistantInsertionState | null> => {
			const storedAsset = parseStoredAssistantAssetContent(artifact.content);
			if (!storedAsset?.sourceArtifactId || !storedAsset.runId) {
				return null;
			}

			const headers = await getRequiredAuthHeaders(getToken);
			const sourceAsset = await fetchAssistantArtifactAsset(
				storedAsset.runId,
				storedAsset.sourceArtifactId,
				headers,
			);
			const sourceMimeType = sourceAsset.mimeType;
			if (!sourceMimeType.startsWith('image/') || sourceMimeType === 'image/svg+xml') {
				return null;
			}

			const compiled = await compileRasterBlobToNativeVector(sourceAsset.blob, {
				source: 'assistant-source-raster-vectorizer',
				provider: storedAsset.provider,
				model: storedAsset.model,
				prompt: storedAsset.prompt,
				artifactType: artifact.type,
				sourceArtifactId: storedAsset.sourceArtifactId,
			});
			return insertNativeVectorElementsOnCanvas(compiled);
		},
		[compileRasterBlobToNativeVector, getToken, insertNativeVectorElementsOnCanvas],
	);

	const insertStoredAssetOnCanvas = useCallback(
		async (artifact: AssistantArtifact): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			const storedAsset = parseStoredAssistantAssetContent(artifact.content);
			if (!storedAsset?.artifactId || !storedAsset.runId) {
				setChatError('This generated asset is missing a downloadable reference.');
				return null;
			}

			const headers = await getRequiredAuthHeaders(getToken);
			const { blob, mimeType } = await fetchAssistantArtifactAsset(
				storedAsset.runId,
				storedAsset.artifactId,
				headers,
			);

			const resolvedMimeType = (mimeType || storedAsset.mimeType) as BinaryFileData['mimeType'];
			if (artifact.type === 'image-vector') {
				try {
					const nativeSourceInsertion = await insertSourceRasterAsNativeVector(artifact);
					if (nativeSourceInsertion) {
						return nativeSourceInsertion;
					}
				} catch {
					// Fall through to SVG/image insertion if the layered native path fails.
				}
			}

			if (artifact.type === 'image-vector' && resolvedMimeType === 'image/svg+xml') {
				try {
					const svgMarkup = await blob.text();
					const compiled = compileSvgToExcalidraw(svgMarkup, {
						customData: {
							provider: storedAsset.provider,
							model: storedAsset.model,
							prompt: storedAsset.prompt,
							artifactType: artifact.type,
						},
					});
					return insertNativeVectorElementsOnCanvas(compiled);
				} catch {
					// Fall back to inserting the SVG as an image asset so the user still gets a usable result.
				}
			}

			const dataURL = await buildDataUrlFromBlob(blob);
			const naturalSize = await getImageDimensions(dataURL);
			const { width, height } = constrainImageSize(naturalSize);
			const fileId = crypto.randomUUID() as BinaryFileData['id'];
			const now = Date.now();
			const imageFile: BinaryFileData = {
				id: fileId,
				mimeType: resolvedMimeType,
				dataURL,
				created: now,
			};
			const currentElements = excalidrawApi.getSceneElements();
			const currentFiles = excalidrawApi.getFiles();
			const sceneCenter = resolveInsertionSceneCenter({
				excalidrawApi,
				elements,
				selectedElementIds,
				width,
				height,
			});
			const imageElement = createCanvasImageElement({
				fileId,
				x: sceneCenter.x - width / 2,
				y: sceneCenter.y - height / 2,
				width,
				height,
				customData: {
					type:
						artifact.type === 'image-vector' ? 'ai-generated-vector-asset' : 'ai-generated-image',
					provider: storedAsset.provider,
					model: storedAsset.model,
					prompt: storedAsset.prompt,
				},
			});

			excalidrawApi.addFiles([imageFile]);
			excalidrawApi.updateScene({
				elements: [...currentElements, imageElement],
				appState: {
					isCropping: false,
					croppingElementId: null,
					selectedElementIds: { [imageElement.id]: true },
				},
			});
			restoreCanvasSelectionState(excalidrawApi);
			syncAppStoreFromExcalidraw(excalidrawApi);
			setFiles({
				...currentFiles,
				[fileId]: imageFile,
			});
			return {
				status: 'inserted',
				insertedElementIds: [String(imageElement.id)],
				insertedFileIds: [fileId],
			};
		},
		[
			elements,
			excalidrawApi,
			getToken,
			insertNativeVectorElementsOnCanvas,
			insertSourceRasterAsNativeVector,
			selectedElementIds,
			setChatError,
			setElements,
			setFiles,
		],
	);

	const rememberInsertionState = useCallback(
		(artifactKey: string, insertionState: AssistantInsertionState) => {
			setAssistantInsertionStates((current) => ({
				...current,
				[artifactKey]: insertionState,
			}));
		},
		[setAssistantInsertionStates],
	);

	const insertArtifactOnCanvas = useCallback(
		async (artifact: AssistantArtifact): Promise<AssistantInsertionState | null> => {
			if (!excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return null;
			}

			const convertToExcalidrawElements = await getConvertToExcalidrawElements();
			const currentElements = excalidrawApi.getSceneElements();

			switch (artifact.type) {
				case 'kanban-ops': {
					const { width, height } = getOverlayDefaults('kanban');
					const sceneCenter = resolveInsertionSceneCenter({
						excalidrawApi,
						elements,
						selectedElementIds,
						width,
						height,
					});
					const selectedKanban = getSelectedKanbanElement(
						currentElements as unknown as Record<string, unknown>[],
						selectedElementIds,
					);
					const draft = createOverlayElementDraft(
						'kanban',
						sceneCenter,
						buildKanbanFromArtifact(
							artifact,
							selectedKanban
								? normalizeKanbanOverlay(selectedKanban.customData as Record<string, unknown>)
								: undefined,
						) as unknown as Record<string, unknown>,
					);
					const converted = convertToExcalidrawElements([draft as never]);
					return applyInsertedElements({
						excalidrawApi,
						setElements,
						insertedElements: converted,
					});
				}
				case 'mermaid':
				case 'd2':
				case 'markdown':
					return await insertMarkdownOnCanvas(buildMarkdownArtifactContent(artifact));
				case 'image':
				case 'image-vector':
					return await insertStoredAssetOnCanvas(artifact);
				case 'prototype-files': {
					const prototype = buildPrototypeFromArtifact(artifact);
					const selectedPrototype = getSelectedPrototypeElement(
						currentElements as unknown as Record<string, unknown>[],
						selectedElementIds,
					);

					if (selectedPrototype) {
						const nextElements = currentElements.map((candidate) =>
							candidate.id === selectedPrototype.id
								? (applyOverlayUpdateByType('prototype', candidate as never, {
										title: prototype.title,
										template: prototype.template,
										files: prototype.files,
										dependencies: prototype.dependencies,
										preview: prototype.preview,
										activeFile: prototype.activeFile,
										showEditor: prototype.showEditor,
										showPreview: prototype.showPreview,
									}) as typeof candidate)
								: candidate,
						);
						excalidrawApi.updateScene({ elements: nextElements });
						syncAppStoreFromExcalidraw(excalidrawApi);
						return {
							status: 'inserted',
							insertedElementIds: [String(selectedPrototype.id)],
						};
					}

					const { width, height } = getOverlayDefaults('prototype');
					const sceneCenter = resolveInsertionSceneCenter({
						excalidrawApi,
						elements,
						selectedElementIds,
						width,
						height,
					});
					const draft = createOverlayElementDraft(
						'prototype',
						sceneCenter,
						prototype as unknown as Record<string, unknown>,
					);
					const converted = convertToExcalidrawElements([draft as never]);
					return applyInsertedElements({
						excalidrawApi,
						setElements,
						insertedElements: converted,
					});
				}
				default:
					setChatError('This artifact type is not insertable yet.');
					return null;
			}
		},
		[
			elements,
			excalidrawApi,
			insertMarkdownOnCanvas,
			insertStoredAssetOnCanvas,
			selectedElementIds,
			setChatError,
			setElements,
		],
	);

	const insertPrototypeOnCanvas = useCallback(
		async (messageContent: string) => {
			const prototype = buildPrototypeFromMessageContent(messageContent);
			if (!prototype || !excalidrawApi) {
				setChatError('Canvas is not ready yet.');
				return;
			}

			const convertToExcalidrawElements = await getConvertToExcalidrawElements();
			const sceneCenter = getViewportSceneCenter(excalidrawApi.getAppState());
			const currentElements = excalidrawApi.getSceneElements();
			const selectedPrototype = getSelectedPrototypeElement(
				currentElements as unknown as Record<string, unknown>[],
				selectedElementIds,
			);

			if (selectedPrototype) {
				const nextElements = currentElements.map((candidate) =>
					candidate.id === selectedPrototype.id
						? (applyOverlayUpdateByType('prototype', candidate as never, {
								title: prototype.title,
								template: prototype.template,
								files: prototype.files,
								dependencies: prototype.dependencies,
								preview: prototype.preview,
								activeFile: prototype.activeFile,
								showEditor: prototype.showEditor,
								showPreview: prototype.showPreview,
							}) as typeof candidate)
						: candidate,
				);
				excalidrawApi.updateScene({ elements: nextElements });
				syncAppStoreFromExcalidraw(excalidrawApi);
				return;
			}

			const draft = createOverlayElementDraft(
				'prototype',
				sceneCenter,
				prototype as unknown as Record<string, unknown>,
			);
			const converted = convertToExcalidrawElements([draft as never]);
			const nextElements = [...currentElements, ...converted];
			excalidrawApi.updateScene({ elements: nextElements });
			syncAppStoreFromExcalidraw(excalidrawApi);
		},
		[excalidrawApi, selectedElementIds, setChatError, setElements],
	);

	const getPrototypeContextForRequest = useCallback(
		(effectiveContextMode: AssistantContextMode): PrototypeOverlayCustomData | undefined => {
			if (effectiveContextMode !== 'selected') {
				return undefined;
			}

			const selectedPrototype = getSelectedPrototypeElement(
				elements as unknown as Record<string, unknown>[],
				selectedElementIds,
			);
			if (!selectedPrototype) {
				return undefined;
			}

			return normalizePrototypeOverlay(selectedPrototype.customData as Record<string, unknown>);
		},
		[elements, selectedElementIds],
	);

	return {
		removeInsertedArtifact,
		insertMarkdownOnCanvas,
		insertRenderedDiagramOnCanvas,
		insertSvgMarkupOnCanvas,
		vectorizeRasterAssetOnCanvas,
		insertStoredAssetOnCanvas,
		rememberInsertionState,
		insertArtifactOnCanvas,
		insertPrototypeOnCanvas,
		getPrototypeContextForRequest,
	};
}
