import { syncAppStoreFromExcalidraw } from '@/components/canvas/excalidraw-store-sync';
import { fetchAssistantArtifactAsset, getRequiredAuthHeaders } from '@/lib/api';
import { addObservabilityBreadcrumb, captureBrowserException } from '@/lib/observability';
import { parseStoredAssistantAssetContent } from '@ai-canvas/shared/schemas';
import type { AssistantArtifact } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
	BinaryFileData,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import { createCanvasImageElement } from './ai-chat-canvas';
import {
	resolveInsertionSceneCenter,
	restoreCanvasSelectionState,
} from './ai-chat-canvas-mutations';
import type { AssistantInsertionState } from './ai-chat-types';
import {
	compileRasterBlobToNativeVector,
	compileSvgMarkupToNativeVector,
	describeNativeVectorPipelineError,
	insertNativeVectorElementsOnCanvas,
} from './ai-chat-vector-insertion';

type StoredAssistantAssetContent = NonNullable<ReturnType<typeof parseStoredAssistantAssetContent>>;
type StoredAssistantAssetReference = StoredAssistantAssetContent & {
	artifactId: string;
	runId: string;
};

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

function requireStoredAssetReference(
	artifact: AssistantArtifact,
	setChatError?: (error: string | null) => void,
): StoredAssistantAssetReference | null {
	const storedAsset = parseStoredAssistantAssetContent(artifact.content);
	if (storedAsset?.artifactId && storedAsset.runId) {
		return {
			...storedAsset,
			artifactId: storedAsset.artifactId,
			runId: storedAsset.runId,
		};
	}

	setChatError?.('This generated asset is missing a downloadable reference.');
	return null;
}

async function fetchStoredAssetById({
	runId,
	artifactId,
	getToken,
}: {
	runId: string;
	artifactId: string;
	getToken: () => Promise<string | null>;
}) {
	const headers = await getRequiredAuthHeaders(getToken);
	return fetchAssistantArtifactAsset(runId, artifactId, headers);
}

function resolveAssetMimeType(
	downloadedAsset: { mimeType: string },
	storedAsset: StoredAssistantAssetContent,
) {
	return (downloadedAsset.mimeType || storedAsset.mimeType) as BinaryFileData['mimeType'];
}

function isRasterImageMimeType(mimeType: string) {
	return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
}

function buildAssetCustomData(
	artifact: AssistantArtifact,
	storedAsset: StoredAssistantAssetContent,
	extra: Record<string, unknown> = {},
) {
	return {
		provider: storedAsset.provider,
		model: storedAsset.model,
		prompt: storedAsset.prompt,
		artifactType: artifact.type,
		...extra,
	};
}

function buildNativeVectorErrorMessage(error: unknown, fallbackMessage: string) {
	return describeNativeVectorPipelineError(error, fallbackMessage);
}

function recordImageVectorFallback(
	storedAsset: StoredAssistantAssetContent,
	reason: string,
	mode: 'asset-image' | 'unsupported-native-source',
) {
	addObservabilityBreadcrumb(
		'assistant.vectorization.image_vector_fallback',
		{
			mode,
			reason,
			sourceArtifactId: storedAsset.sourceArtifactId ?? null,
			provider: storedAsset.provider ?? null,
			model: storedAsset.model ?? null,
		},
		'warning',
		'assistant',
	);
}

interface StoredAssetInsertionContext {
	artifact: AssistantArtifact;
	getToken: () => Promise<string | null>;
	excalidrawApi: ExcalidrawImperativeAPI;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
	setFiles: (files: BinaryFiles) => void;
	setChatError: (error: string | null) => void;
}

export async function vectorizeRasterAssetOnCanvas({
	artifact,
	getToken,
	excalidrawApi,
	elements,
	selectedElementIds,
	setChatError,
}: Omit<StoredAssetInsertionContext, 'setFiles'>): Promise<AssistantInsertionState | null> {
	const storedAsset = requireStoredAssetReference(artifact, setChatError);
	if (!storedAsset) {
		return null;
	}

	const downloadedAsset = await fetchStoredAssetById({
		runId: storedAsset.runId,
		artifactId: storedAsset.artifactId,
		getToken,
	});
	const resolvedMimeType = resolveAssetMimeType(downloadedAsset, storedAsset);
	if (!isRasterImageMimeType(resolvedMimeType)) {
		setChatError('Only raster image assets can be vectorized from this card.');
		return null;
	}

	try {
		const compiled = await compileRasterBlobToNativeVector(downloadedAsset.blob, {
			source: 'artifact-raster',
			customData: buildAssetCustomData(artifact, storedAsset, {
				source: 'assistant-raster-vectorizer',
			}),
		});
		return await insertNativeVectorElementsOnCanvas({
			compiled,
			excalidrawApi,
			elements,
			selectedElementIds,
		});
	} catch (error) {
		captureBrowserException(error, {
			tags: {
				area: 'assistant',
				action: 'vectorize_raster_asset',
			},
			extra: {
				artifactType: artifact.type,
				mimeType: resolvedMimeType,
				provider: storedAsset.provider ?? null,
				model: storedAsset.model ?? null,
			},
		});
		setChatError(
			buildNativeVectorErrorMessage(error, 'This raster sketch could not be vectorized natively.'),
		);
		return null;
	}
}

async function insertImageVectorAssetNatively({
	artifact,
	storedAsset,
	downloadedAsset,
	excalidrawApi,
	elements,
	selectedElementIds,
	getToken,
}: {
	artifact: AssistantArtifact;
	storedAsset: StoredAssistantAssetReference;
	downloadedAsset: { blob: Blob; mimeType: string };
	excalidrawApi: ExcalidrawImperativeAPI;
	elements: readonly ExcalidrawElement[];
	selectedElementIds: Record<string, boolean>;
	getToken: () => Promise<string | null>;
}): Promise<AssistantInsertionState | null> {
	if (!storedAsset.sourceArtifactId && downloadedAsset.mimeType !== 'image/svg+xml') {
		recordImageVectorFallback(
			storedAsset,
			'Image-vector artifact has no source raster or SVG payload for native insertion.',
			'unsupported-native-source',
		);
		return null;
	}

	if (storedAsset.sourceArtifactId) {
		try {
			const sourceAsset = await fetchStoredAssetById({
				runId: storedAsset.runId,
				artifactId: storedAsset.sourceArtifactId,
				getToken,
			});
			if (isRasterImageMimeType(sourceAsset.mimeType)) {
				const compiled = await compileRasterBlobToNativeVector(sourceAsset.blob, {
					source: 'source-raster',
					customData: buildAssetCustomData(artifact, storedAsset, {
						source: 'assistant-source-raster-vectorizer',
						sourceArtifactId: storedAsset.sourceArtifactId,
					}),
				});
				return await insertNativeVectorElementsOnCanvas({
					compiled,
					excalidrawApi,
					elements,
					selectedElementIds,
				});
			}
		} catch (error) {
			recordImageVectorFallback(
				storedAsset,
				buildNativeVectorErrorMessage(error, 'Source raster insertion failed before SVG fallback.'),
				'asset-image',
			);
		}
	}

	if (downloadedAsset.mimeType !== 'image/svg+xml') {
		recordImageVectorFallback(
			storedAsset,
			'Downloaded vector artifact is not SVG, so it cannot be compiled natively.',
			'asset-image',
		);
		return null;
	}

	try {
		const svgMarkup = await downloadedAsset.blob.text();
		const compiled = compileSvgMarkupToNativeVector(svgMarkup, {
			source: 'stored-svg',
			customData: buildAssetCustomData(artifact, storedAsset),
		});
		return await insertNativeVectorElementsOnCanvas({
			compiled,
			excalidrawApi,
			elements,
			selectedElementIds,
		});
	} catch (error) {
		recordImageVectorFallback(
			storedAsset,
			buildNativeVectorErrorMessage(error, 'SVG native insertion failed.'),
			'asset-image',
		);
		return null;
	}
}

export async function insertStoredAssetOnCanvas({
	artifact,
	getToken,
	excalidrawApi,
	elements,
	selectedElementIds,
	setFiles,
	setChatError,
}: StoredAssetInsertionContext): Promise<AssistantInsertionState | null> {
	const storedAsset = requireStoredAssetReference(artifact, setChatError);
	if (!storedAsset) {
		return null;
	}

	const downloadedAsset = await fetchStoredAssetById({
		runId: storedAsset.runId,
		artifactId: storedAsset.artifactId,
		getToken,
	});
	const resolvedMimeType = resolveAssetMimeType(downloadedAsset, storedAsset);

	if (artifact.type === 'image-vector') {
		const nativeVectorInsertion = await insertImageVectorAssetNatively({
			artifact,
			storedAsset,
			downloadedAsset,
			excalidrawApi,
			elements,
			selectedElementIds,
			getToken,
		});
		if (nativeVectorInsertion) {
			return nativeVectorInsertion;
		}
	}

	const dataURL = await buildDataUrlFromBlob(downloadedAsset.blob);
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
			type: artifact.type === 'image-vector' ? 'ai-generated-vector-asset' : 'ai-generated-image',
			...buildAssetCustomData(artifact, storedAsset, {
				insertMode: 'image-file',
			}),
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
		insertMode: 'image-file',
	};
}
