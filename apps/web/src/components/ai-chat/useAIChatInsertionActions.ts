import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { normalizeKanbanOverlay, normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantContextMode,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import type {
	BinaryFileData,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
	createOverlayElementDraft,
	getOverlayDefaults,
	getViewportSceneCenter,
} from '@/components/canvas/element-factories';
import { syncAppStoreFromExcalidraw } from '@/components/canvas/excalidraw-store-sync';
import { applyOverlayUpdateByType } from '@/components/canvas/overlay-registry';
import {
	buildKanbanFromArtifact,
	buildMarkdownArtifactContent,
	buildPrototypeFromArtifact,
	buildPrototypeFromMessageContent,
	parseStoredAssistantAssetContent,
} from './assistant-artifacts';
import { fetchAssistantArtifactAsset, getRequiredAuthHeaders } from '@/lib/api';
import { svgToDataUrl } from '@/lib/assistant/diagram-renderer';
import {
	createCanvasImageElement,
	getConvertToExcalidrawElements,
	getSelectedKanbanElement,
	getSelectedPrototypeElement,
} from './ai-chat-canvas';
import {
	applyInsertedElements,
	removeInsertedArtifactFromScene,
	restoreCanvasSelectionState,
	resolveInsertionSceneCenter,
} from './ai-chat-canvas-mutations';
import type {
	AssistantInsertionState,
} from './ai-chat-types';

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
			const dataURL = await buildDataUrlFromBlob(blob);
			const naturalSize = await getImageDimensions(dataURL);
			const { width, height } = constrainImageSize(naturalSize);
			const fileId = crypto.randomUUID() as BinaryFileData['id'];
			const now = Date.now();
			const imageFile: BinaryFileData = {
				id: fileId,
				mimeType: (mimeType || storedAsset.mimeType) as BinaryFileData['mimeType'],
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
					type: artifact.type === 'image-vector' ? 'ai-generated-vector-asset' : 'ai-generated-image',
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
		[elements, excalidrawApi, getToken, selectedElementIds, setChatError, setElements, setFiles],
	);

	const rememberInsertionState = useCallback((artifactKey: string, insertionState: AssistantInsertionState) => {
		setAssistantInsertionStates((current) => ({
			...current,
			[artifactKey]: insertionState,
		}));
	}, [setAssistantInsertionStates]);

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
								? applyOverlayUpdateByType('prototype', candidate as never, {
										title: prototype.title,
										template: prototype.template,
										files: prototype.files,
										dependencies: prototype.dependencies,
										preview: prototype.preview,
										activeFile: prototype.activeFile,
										showEditor: prototype.showEditor,
										showPreview: prototype.showPreview,
								  }) as typeof candidate
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
						? applyOverlayUpdateByType('prototype', candidate as never, {
								title: prototype.title,
								template: prototype.template,
								files: prototype.files,
								dependencies: prototype.dependencies,
								preview: prototype.preview,
								activeFile: prototype.activeFile,
								showEditor: prototype.showEditor,
								showPreview: prototype.showPreview,
						  }) as typeof candidate
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
		insertStoredAssetOnCanvas,
		rememberInsertionState,
		insertArtifactOnCanvas,
		insertPrototypeOnCanvas,
		getPrototypeContextForRequest,
	};
}
