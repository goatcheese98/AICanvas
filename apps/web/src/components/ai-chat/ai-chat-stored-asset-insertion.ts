import { syncAppStoreFromExcalidraw } from '@/components/canvas/excalidraw-store-sync';
import { parseStoredAssistantAssetContent } from '@ai-canvas/shared/schemas';
import { fetchAssistantArtifactAsset, getRequiredAuthHeaders } from '@/lib/api';
import { compileSvgToExcalidraw } from '@/lib/assistant/svg-to-excalidraw';
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
	insertNativeVectorElementsOnCanvas,
} from './ai-chat-vector-insertion';

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
		return await insertNativeVectorElementsOnCanvas({
			compiled,
			excalidrawApi,
			elements,
			selectedElementIds,
		});
	} catch (error) {
		setChatError(
			error instanceof Error
				? error.message
				: 'This raster sketch could not be vectorized natively.',
		);
		return null;
	}
}

export async function insertSourceRasterAsNativeVector({
	artifact,
	getToken,
	excalidrawApi,
	elements,
	selectedElementIds,
}: Omit<
	StoredAssetInsertionContext,
	'setFiles' | 'setChatError'
>): Promise<AssistantInsertionState | null> {
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

	return await insertNativeVectorElementsOnCanvas({
		compiled,
		excalidrawApi,
		elements,
		selectedElementIds,
	});
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
			const nativeSourceInsertion = await insertSourceRasterAsNativeVector({
				artifact,
				getToken,
				excalidrawApi,
				elements,
				selectedElementIds,
			});
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
			return await insertNativeVectorElementsOnCanvas({
				compiled,
				excalidrawApi,
				elements,
				selectedElementIds,
			});
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
}
