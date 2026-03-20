import type { DecodedImageData, SketchVectorControls, SketchVectorizerOptions } from './types.js';
import {
	BASE_SIZE_BY_COMPLEXITY,
	MAX_WORKING_SIZE,
	MIN_WORKING_SIZE,
} from './config.js';

/** Calculate pixel luminance */
function pixelLuminance(r: number, g: number, b: number): number {
	return r * 0.299 + g * 0.587 + b * 0.114;
}

/** Calculate chroma (color intensity) */
function chroma(r: number, g: number, b: number): number {
	return Math.max(r, g, b) - Math.min(r, g, b);
}

/** Check if pixel is near-white (likely background) */
function isNearWhitePixel(r: number, g: number, b: number): boolean {
	const luminance = pixelLuminance(r, g, b);
	return luminance >= 246 && chroma(r, g, b) <= 10;
}

/** Check if pixel is neutral light color */
function isNearNeutralLight(r: number, g: number, b: number): boolean {
	return pixelLuminance(r, g, b) > 165 && chroma(r, g, b) < 30;
}

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Flood-fill sanitize checkerboard or neutral backgrounds starting from edges */
function sanitizeCheckerboardBackground(
	data: Uint8ClampedArray,
	width: number,
	height: number,
): void {
	const visited = new Uint8Array(width * height);
	const queue = new Int32Array(width * height);

	function enqueueIfCandidate(pixel: number, queueEnd: { value: number }): void {
		if (visited[pixel] === 1) return;
		const offset = pixel * 4;
		if (!isNearNeutralLight(data[offset], data[offset + 1], data[offset + 2])) return;

		visited[pixel] = 1;
		queue[queueEnd.value] = pixel;
		queueEnd.value += 1;
	}

	const queueEnd = { value: 0 };
	for (let x = 0; x < width; x += 1) {
		enqueueIfCandidate(x, queueEnd);
		enqueueIfCandidate((height - 1) * width + x, queueEnd);
	}
	for (let y = 1; y < height - 1; y += 1) {
		enqueueIfCandidate(y * width, queueEnd);
		enqueueIfCandidate(y * width + (width - 1), queueEnd);
	}

	let queueStart = 0;
	while (queueStart < queueEnd.value) {
		const current = queue[queueStart];
		queueStart += 1;

		const x = current % width;
		const y = Math.floor(current / width);
		const offset = current * 4;
		data[offset] = 255;
		data[offset + 1] = 255;
		data[offset + 2] = 255;
		data[offset + 3] = 255;

		if (x > 0) enqueueIfCandidate(current - 1, queueEnd);
		if (x < width - 1) enqueueIfCandidate(current + 1, queueEnd);
		if (y > 0) enqueueIfCandidate(current - width, queueEnd);
		if (y < height - 1) enqueueIfCandidate(current + width, queueEnd);
	}
}

/** Detect subject bounds by finding non-white pixel extents */
function detectSubjectBounds(
	data: Uint8ClampedArray,
	width: number,
	height: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const offset = (y * width + x) * 4;
			if (isNearWhitePixel(data[offset], data[offset + 1], data[offset + 2])) {
				continue;
			}
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
		}
	}

	if (maxX < minX || maxY < minY) {
		return null;
	}

	return { minX, minY, maxX, maxY };
}

/** Create a canvas with white background and draw image on it */
function drawImageOnWhiteCanvas(
	image: CanvasImageSource,
	width: number,
	height: number,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) {
		throw new Error('Canvas 2D context is unavailable for sketch vectorization.');
	}

	context.fillStyle = '#ffffff';
	context.fillRect(0, 0, width, height);
	context.drawImage(image, 0, 0, width, height);
	return { canvas, context };
}

/** Build a normalized square canvas centered on the subject */
function buildNormalizedSubjectCanvas(image: HTMLImageElement): HTMLCanvasElement {
	const base = drawImageOnWhiteCanvas(image, image.naturalWidth, image.naturalHeight);
	const imageData = base.context.getImageData(0, 0, base.canvas.width, base.canvas.height);
	sanitizeCheckerboardBackground(imageData.data, base.canvas.width, base.canvas.height);
	base.context.putImageData(imageData, 0, 0);

	const bounds = detectSubjectBounds(imageData.data, base.canvas.width, base.canvas.height);
	if (!bounds) {
		return base.canvas;
	}

	const subjectWidth = bounds.maxX - bounds.minX + 1;
	const subjectHeight = bounds.maxY - bounds.minY + 1;
	const subjectSize = Math.max(subjectWidth, subjectHeight);
	const padding = Math.max(18, Math.round(subjectSize * 0.1));
	const squareSize = Math.max(subjectSize + padding * 2, 256);
	const square = drawImageOnWhiteCanvas(base.canvas, squareSize, squareSize);
	const drawX = Math.floor((squareSize - subjectWidth) / 2);
	const drawY = Math.floor((squareSize - subjectHeight) / 2);

	square.context.clearRect(0, 0, squareSize, squareSize);
	square.context.fillStyle = '#ffffff';
	square.context.fillRect(0, 0, squareSize, squareSize);
	square.context.drawImage(
		base.canvas,
		bounds.minX,
		bounds.minY,
		subjectWidth,
		subjectHeight,
		drawX,
		drawY,
		subjectWidth,
		subjectHeight,
	);

	return square.canvas;
}

/** Load an image from a Blob */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const image = new Image();
		image.decoding = 'async';
		image.loading = 'eager';
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load raster asset for sketch vectorization.'));
		};
		image.src = url;
	});
}

/**
 * Decode image blob to processed pixel data.
 * Handles image loading, subject detection, normalization, and scaling.
 */
export async function decodeImageData(
	blob: Blob,
	controls: SketchVectorControls,
	options: SketchVectorizerOptions,
): Promise<DecodedImageData> {
	const image = await loadImageFromBlob(blob);
	const normalizedCanvas = buildNormalizedSubjectCanvas(image);
	const detailBoost = Math.round(controls.detailLevel * 420);
	const targetMaxWidth = Math.min(
		options.maxWidth ?? BASE_SIZE_BY_COMPLEXITY[controls.complexity] + detailBoost,
		MAX_WORKING_SIZE,
	);
	const targetMaxHeight = Math.min(
		options.maxHeight ?? BASE_SIZE_BY_COMPLEXITY[controls.complexity] + detailBoost,
		MAX_WORKING_SIZE,
	);
	const scale = Math.min(
		targetMaxWidth / normalizedCanvas.width,
		targetMaxHeight / normalizedCanvas.height,
		1,
	);
	const width = Math.max(MIN_WORKING_SIZE, Math.floor(normalizedCanvas.width * scale));
	const height = Math.max(MIN_WORKING_SIZE, Math.floor(normalizedCanvas.height * scale));
	const { context } = drawImageOnWhiteCanvas(normalizedCanvas, width, height);
	const imageData = context.getImageData(0, 0, width, height);
	sanitizeCheckerboardBackground(imageData.data, width, height);

	return {
		data: imageData.data,
		width,
		height,
		sourceWidth: image.naturalWidth,
		sourceHeight: image.naturalHeight,
	};
}
