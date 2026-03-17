import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export type SketchVectorStyle = 'clean' | 'technical' | 'hand-drawn' | 'organic';
export type SketchVectorComplexity = 'low' | 'medium' | 'high';

export interface SketchVectorControls {
	style: SketchVectorStyle;
	complexity: SketchVectorComplexity;
	colorPalette: number;
	detailLevel: number;
	edgeSensitivity: number;
}

export interface SketchVectorizerOptions {
	maxWidth?: number;
	maxHeight?: number;
	maxElements?: number;
	customData?: Record<string, unknown>;
	controls?: Partial<SketchVectorControls>;
}

export interface SketchVectorizationMetadata {
	sourceWidth: number;
	sourceHeight: number;
	workingWidth: number;
	workingHeight: number;
	numColorsRequested: number;
	numColorsUsed: number;
	backgroundLabel: number;
	morphologyKernelSize: number;
	epsilon: number;
	minArea: number;
	componentsFound: number;
	componentsFiltered: number;
	elementsCreated: number;
	elementsEmitted: number;
	processingMs: number;
}

export interface CompiledSketchVectorization {
	elements: ExcalidrawElement[];
	width: number;
	height: number;
	metadata: SketchVectorizationMetadata;
	logs: string[];
}

type Point = [number, number];

interface RGB {
	r: number;
	g: number;
	b: number;
}

interface Component {
	area: number;
	pixels: number[];
}

interface BoundaryEdge {
	start: Point;
	end: Point;
}

interface PolygonElementCandidate {
	area: number;
	color: RGB;
	skeleton: Record<string, unknown>;
}

const DEFAULT_CONTROLS: SketchVectorControls = {
	style: 'clean',
	complexity: 'medium',
	colorPalette: 12,
	detailLevel: 0.78,
	edgeSensitivity: 20,
};

const BASE_SIZE_BY_COMPLEXITY: Record<SketchVectorComplexity, number> = {
	low: 420,
	medium: 640,
	high: 860,
};

const MAX_ELEMENTS_BY_COMPLEXITY: Record<SketchVectorComplexity, number> = {
	low: 320,
	medium: 760,
	high: 1400,
};

const STYLE_ROUGHNESS: Record<SketchVectorStyle, number> = {
	clean: 0,
	technical: 0,
	'hand-drawn': 1,
	organic: 2,
};

let convertToExcalidrawElementsLoader: Promise<
	typeof import('@excalidraw/excalidraw')['convertToExcalidrawElements']
> | null = null;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function toHex(value: number) {
	return value.toString(16).padStart(2, '0');
}

function rgbToHex(color: RGB) {
	return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function brightness(color: RGB) {
	return color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
}

function chroma(color: RGB) {
	return Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
}

function colorDistanceSq(a: RGB, b: RGB) {
	const dr = a.r - b.r;
	const dg = a.g - b.g;
	const db = a.b - b.b;
	return dr * dr + dg * dg + db * db;
}

function pointEquals(a: Point, b: Point) {
	return a[0] === b[0] && a[1] === b[1];
}

function pixelLuminance(r: number, g: number, b: number) {
	return r * 0.299 + g * 0.587 + b * 0.114;
}

/**
 * Derives a deterministic seed from pixel data so K-means always produces the
 * same clusters for the same image, making element counts reproducible.
 */
function computeImageSeed(data: Uint8ClampedArray): number {
	let h = 2166136261; // FNV-1a offset basis
	const step = Math.max(4, Math.floor(data.length / 2000) * 4);
	for (let i = 0; i < data.length; i += step) {
		h ^= data[i];
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h || 1; // xorshift must not receive 0
}

/** Simple xorshift32 PRNG returning values in [0, 1). */
function makeSeededRandom(seed: number): () => number {
	let s = (seed >>> 0) || 1;
	return (): number => {
		s ^= s << 13;
		s ^= s >> 17;
		s ^= s << 5;
		s = s >>> 0;
		return s / 4294967296;
	};
}

/**
 * Merges K-means color centers that are perceptually close (within `maxDistSq`
 * RGB squared distance). This prevents over-segmentation of subjects with
 * subtle tonal variation (e.g. a brown dog producing 8 shades of brown) which
 * causes seam artifacts and inflated element counts.
 *
 * Merging is done via union-find; merged center colors are the pixel-weighted
 * average of the constituent clusters.
 */
function mergeSimilarColorClusters(
	centers: RGB[],
	labels: Uint16Array,
	counts: Uint32Array,
	maxDistSq: number,
): { centers: RGB[]; labels: Uint16Array; counts: Uint32Array } {
	const n = centers.length;
	const parent = Array.from({ length: n }, (_, i) => i);

	function find(x: number): number {
		while (parent[x] !== x) {
			parent[x] = parent[parent[x]];
			x = parent[x];
		}
		return x;
	}

	// Guard: skip merging at both ends of the brightness spectrum.
	// Near-white colors (cream, off-white, light beige) and near-black colors
	// (dark gray, near-black) represent visually distinct surface colors that
	// should never be collapsed — only mid-range hues with subtle variation merge.
	const MERGE_BRIGHT_CUTOFF = 185; // above this → protect from merging
	const MERGE_DARK_CUTOFF = 55;   // below this → protect from merging
	for (let i = 0; i < n; i += 1) {
		const bi = brightness(centers[i]);
		if (bi > MERGE_BRIGHT_CUTOFF || bi < MERGE_DARK_CUTOFF) continue;
		for (let j = i + 1; j < n; j += 1) {
			const bj = brightness(centers[j]);
			if (bj > MERGE_BRIGHT_CUTOFF || bj < MERGE_DARK_CUTOFF) continue;
			if (colorDistanceSq(centers[i], centers[j]) <= maxDistSq) {
				parent[find(i)] = find(j);
			}
		}
	}

	// Build canonical new-index mapping
	const rootToNewIndex = new Map<number, number>();
	let nextId = 0;
	const mapping = new Array<number>(n);
	for (let i = 0; i < n; i += 1) {
		const root = find(i);
		if (!rootToNewIndex.has(root)) {
			rootToNewIndex.set(root, nextId);
			nextId += 1;
		}
		mapping[i] = rootToNewIndex.get(root)!;
	}

	// If nothing merged, return originals unchanged to avoid allocation
	if (nextId === n) {
		return { centers, labels, counts };
	}

	// Merged center color = pixel-weighted average of constituent clusters
	const m = nextId;
	const sumR = new Float64Array(m);
	const sumG = new Float64Array(m);
	const sumB = new Float64Array(m);
	const newCounts = new Uint32Array(m);

	for (let i = 0; i < n; i += 1) {
		const mi = mapping[i];
		sumR[mi] += centers[i].r * counts[i];
		sumG[mi] += centers[i].g * counts[i];
		sumB[mi] += centers[i].b * counts[i];
		newCounts[mi] += counts[i];
	}

	const newCenters: RGB[] = Array.from({ length: m }, (_, i) => ({
		r: newCounts[i] > 0 ? Math.round(sumR[i] / newCounts[i]) : 0,
		g: newCounts[i] > 0 ? Math.round(sumG[i] / newCounts[i]) : 0,
		b: newCounts[i] > 0 ? Math.round(sumB[i] / newCounts[i]) : 0,
	}));

	// Remap pixel labels to new cluster indices
	const newLabels = new Uint16Array(labels.length);
	for (let i = 0; i < labels.length; i += 1) {
		newLabels[i] = mapping[labels[i]];
	}

	return { centers: newCenters, labels: newLabels, counts: newCounts };
}

function isNearWhitePixel(r: number, g: number, b: number) {
	const luminance = pixelLuminance(r, g, b);
	return luminance >= 246 && chroma({ r, g, b }) <= 10;
}

function edgeKey(point: Point) {
	return `${point[0]},${point[1]}`;
}

function resolveControls(input?: Partial<SketchVectorControls>): SketchVectorControls {
	return {
		style: input?.style ?? DEFAULT_CONTROLS.style,
		complexity: input?.complexity ?? DEFAULT_CONTROLS.complexity,
		colorPalette: clamp(
			Math.round(input?.colorPalette ?? DEFAULT_CONTROLS.colorPalette),
			2,
			24,
		),
		detailLevel: clamp(input?.detailLevel ?? DEFAULT_CONTROLS.detailLevel, 0.2, 1),
		edgeSensitivity: clamp(
			Math.round(input?.edgeSensitivity ?? DEFAULT_CONTROLS.edgeSensitivity),
			1,
			100,
		),
	};
}

async function getConvertToExcalidrawElements() {
	if (!convertToExcalidrawElementsLoader) {
		convertToExcalidrawElementsLoader = import('@excalidraw/excalidraw').then(
			(module) => module.convertToExcalidrawElements,
		);
	}

	return convertToExcalidrawElementsLoader;
}

function getElementsBounds(elements: readonly ExcalidrawElement[]) {
	const left = Math.min(...elements.map((element) => element.x));
	const top = Math.min(...elements.map((element) => element.y));
	const right = Math.max(...elements.map((element) => element.x + Math.abs(element.width ?? 0)));
	const bottom = Math.max(...elements.map((element) => element.y + Math.abs(element.height ?? 0)));
	return {
		width: right - left,
		height: bottom - top,
	};
}

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

function sanitizeCheckerboardBackground(
	data: Uint8ClampedArray,
	width: number,
	height: number,
) {
	const visited = new Uint8Array(width * height);
	const queue = new Int32Array(width * height);

	function isNearNeutralLight(r: number, g: number, b: number) {
		return pixelLuminance(r, g, b) > 165 && chroma({ r, g, b }) < 30;
	}

	function enqueueIfCandidate(pixel: number, queueEnd: { value: number }) {
		if (visited[pixel] === 1) {
			return;
		}

		const offset = pixel * 4;
		if (
			!isNearNeutralLight(data[offset], data[offset + 1], data[offset + 2])
		) {
			return;
		}

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

function drawImageOnWhiteCanvas(
	image: CanvasImageSource,
	width: number,
	height: number,
) {
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

function buildNormalizedSubjectCanvas(image: HTMLImageElement) {
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

async function decodeImageData(
	blob: Blob,
	controls: SketchVectorControls,
	options: SketchVectorizerOptions,
) {
	const image = await loadImageFromBlob(blob);
	const normalizedCanvas = buildNormalizedSubjectCanvas(image);
	const detailBoost = Math.round(controls.detailLevel * 420);
	const targetMaxWidth = Math.min(
		options.maxWidth ?? BASE_SIZE_BY_COMPLEXITY[controls.complexity] + detailBoost,
		1024,
	);
	const targetMaxHeight = Math.min(
		options.maxHeight ?? BASE_SIZE_BY_COMPLEXITY[controls.complexity] + detailBoost,
		1024,
	);
	const scale = Math.min(
		targetMaxWidth / normalizedCanvas.width,
		targetMaxHeight / normalizedCanvas.height,
		1,
	);
	const width = Math.max(1, Math.floor(normalizedCanvas.width * scale));
	const height = Math.max(1, Math.floor(normalizedCanvas.height * scale));
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

function samplePixels(data: Uint8ClampedArray, maxSamples = 180_000): RGB[] {
	const totalPixels = Math.floor(data.length / 4);
	const stride = Math.max(1, Math.floor(totalPixels / maxSamples));
	const samples: RGB[] = [];

	for (let pixel = 0; pixel < totalPixels; pixel += stride) {
		const offset = pixel * 4;
		samples.push({
			r: data[offset],
			g: data[offset + 1],
			b: data[offset + 2],
		});
	}

	return samples.length > 0 ? samples : [{ r: 255, g: 255, b: 255 }];
}

function initKMeansPlusPlus(samples: RGB[], k: number, rng: () => number): RGB[] {
	const centers: RGB[] = [samples[Math.floor(rng() * samples.length)]];

	while (centers.length < k) {
		const distances = samples.map((sample) => {
			let bestDistance = Number.POSITIVE_INFINITY;
			for (const center of centers) {
				bestDistance = Math.min(bestDistance, colorDistanceSq(sample, center));
			}
			return bestDistance;
		});
		const distanceSum = distances.reduce((total, value) => total + value, 0);
		if (!Number.isFinite(distanceSum) || distanceSum <= 0) {
			centers.push(samples[Math.floor(rng() * samples.length)]);
			continue;
		}

		let pick = rng() * distanceSum;
		let chosen = samples[0];
		for (let index = 0; index < samples.length; index += 1) {
			pick -= distances[index];
			if (pick <= 0) {
				chosen = samples[index];
				break;
			}
		}
		centers.push(chosen);
	}

	return centers.map((center) => ({ ...center }));
}

function nearestCenterIndex(color: RGB, centers: RGB[]) {
	let bestIndex = 0;
	let bestDistance = Number.POSITIVE_INFINITY;

	for (let index = 0; index < centers.length; index += 1) {
		const distance = colorDistanceSq(color, centers[index]);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestIndex = index;
		}
	}

	return bestIndex;
}

function runKMeans(samples: RGB[], requestedK: number, maxIterations = 18, rng: () => number = Math.random): RGB[] {
	const clusterCount = clamp(requestedK, 2, samples.length);
	let centers = initKMeansPlusPlus(samples, clusterCount, rng);

	for (let iteration = 0; iteration < maxIterations; iteration += 1) {
		const sumsR = new Float64Array(clusterCount);
		const sumsG = new Float64Array(clusterCount);
		const sumsB = new Float64Array(clusterCount);
		const counts = new Uint32Array(clusterCount);

		for (let index = 0; index < samples.length; index += 1) {
			const centerIndex = nearestCenterIndex(samples[index], centers);
			counts[centerIndex] += 1;
			sumsR[centerIndex] += samples[index].r;
			sumsG[centerIndex] += samples[index].g;
			sumsB[centerIndex] += samples[index].b;
		}

		let shift = 0;
		const nextCenters = centers.map((center, index) => {
			if (counts[index] === 0) {
				return center;
			}

			const next = {
				r: Math.round(sumsR[index] / counts[index]),
				g: Math.round(sumsG[index] / counts[index]),
				b: Math.round(sumsB[index] / counts[index]),
			};
			shift += colorDistanceSq(center, next);
			return next;
		});

		centers = nextCenters;
		if (shift / clusterCount < 1) {
			break;
		}
	}

	return centers;
}

function applyBilateralFilter(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	options: {
		radius: number;
		sigmaColor: number;
		sigmaSpace: number;
	},
) {
	const { radius, sigmaColor, sigmaSpace } = options;
	const diameter = radius * 2 + 1;
	const output = new Uint8ClampedArray(data.length);
	const twoSigmaColorSq = 2 * sigmaColor * sigmaColor;
	const twoSigmaSpaceSq = 2 * sigmaSpace * sigmaSpace;
	const spatialKernel = new Float64Array(diameter * diameter);

	for (let deltaY = -radius; deltaY <= radius; deltaY += 1) {
		for (let deltaX = -radius; deltaX <= radius; deltaX += 1) {
			const kernelIndex = (deltaY + radius) * diameter + (deltaX + radius);
			spatialKernel[kernelIndex] = Math.exp(
				-((deltaX * deltaX + deltaY * deltaY) / twoSigmaSpaceSq),
			);
		}
	}

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const centerOffset = (y * width + x) * 4;
			const centerR = data[centerOffset];
			const centerG = data[centerOffset + 1];
			const centerB = data[centerOffset + 2];
			let weightedR = 0;
			let weightedG = 0;
			let weightedB = 0;
			let totalWeight = 0;

			for (let deltaY = -radius; deltaY <= radius; deltaY += 1) {
				const sampleY = y + deltaY;
				if (sampleY < 0 || sampleY >= height) {
					continue;
				}

				for (let deltaX = -radius; deltaX <= radius; deltaX += 1) {
					const sampleX = x + deltaX;
					if (sampleX < 0 || sampleX >= width) {
						continue;
					}

					const offset = (sampleY * width + sampleX) * 4;
					const r = data[offset];
					const g = data[offset + 1];
					const b = data[offset + 2];
					const colorDistance =
						(r - centerR) * (r - centerR)
						+ (g - centerG) * (g - centerG)
						+ (b - centerB) * (b - centerB);
					const colorWeight = Math.exp(-(colorDistance / twoSigmaColorSq));
					const spatialWeight =
						spatialKernel[(deltaY + radius) * diameter + (deltaX + radius)];
					const weight = colorWeight * spatialWeight;
					totalWeight += weight;
					weightedR += r * weight;
					weightedG += g * weight;
					weightedB += b * weight;
				}
			}

			output[centerOffset] = totalWeight <= 0 ? centerR : Math.round(weightedR / totalWeight);
			output[centerOffset + 1] =
				totalWeight <= 0 ? centerG : Math.round(weightedG / totalWeight);
			output[centerOffset + 2] =
				totalWeight <= 0 ? centerB : Math.round(weightedB / totalWeight);
			output[centerOffset + 3] = 255;
		}
	}

	return output;
}

function assignLabels(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	centers: RGB[],
) {
	const totalPixels = width * height;
	const labels = new Uint16Array(totalPixels);
	const counts = new Uint32Array(centers.length);

	for (let pixel = 0; pixel < totalPixels; pixel += 1) {
		const offset = pixel * 4;
		const label = nearestCenterIndex(
			{
				r: data[offset],
				g: data[offset + 1],
				b: data[offset + 2],
			},
			centers,
		);
		labels[pixel] = label;
		counts[label] += 1;
	}

	return { labels, counts };
}

function detectBackgroundLabels(centers: RGB[], counts: Uint32Array) {
	const backgroundLabels = new Set<number>();

	// Background must be BRIGHT (near-white), not merely the most common cluster.
	// Using pixel count misidentifies colored subjects (bus body, dog fur) as
	// background when they cover a large fraction of the image.
	let mainIndex = -1;
	for (let index = 0; index < centers.length; index += 1) {
		if (
			brightness(centers[index]) > 220 &&
			(mainIndex === -1 || brightness(centers[index]) > brightness(centers[mainIndex]))
		) {
			mainIndex = index;
		}
	}
	// Fallback: if no cluster is bright enough, use the brightest one available.
	if (mainIndex === -1) {
		for (let index = 0; index < centers.length; index += 1) {
			if (mainIndex === -1 || brightness(centers[index]) > brightness(centers[mainIndex])) {
				mainIndex = index;
			}
		}
	}
	backgroundLabels.add(mainIndex);

	for (let index = 0; index < centers.length; index += 1) {
		if (index === mainIndex) {
			continue;
		}

		const candidate = centers[index];
		const isLikelyBackgroundNeighbor =
			brightness(candidate) > 220 &&
			chroma(candidate) < 24 &&
			colorDistanceSq(candidate, centers[mainIndex]) < 24 * 24;
		if (isLikelyBackgroundNeighbor) {
			backgroundLabels.add(index);
		}
	}

	return {
		backgroundLabel: mainIndex,
		backgroundLabels,
	};
}

function binaryMaskForLabel(
	labels: Uint16Array,
	width: number,
	height: number,
	label: number,
) {
	const mask = new Uint8Array(width * height);
	for (let index = 0; index < labels.length; index += 1) {
		mask[index] = labels[index] === label ? 1 : 0;
	}
	return mask;
}

function morphErode(mask: Uint8Array, width: number, height: number, kernelSize: number) {
	const output = new Uint8Array(width * height);
	const half = Math.floor(kernelSize / 2);
	const start = -half;
	const end = kernelSize - half - 1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			if (mask[y * width + x] !== 1) {
				continue;
			}

			let keep = true;
			for (let offsetY = start; offsetY <= end && keep; offsetY += 1) {
				for (let offsetX = start; offsetX <= end; offsetX += 1) {
					const sampleX = x + offsetX;
					const sampleY = y + offsetY;
					if (
						sampleX < 0 ||
						sampleY < 0 ||
						sampleX >= width ||
						sampleY >= height ||
						mask[sampleY * width + sampleX] === 0
					) {
						keep = false;
						break;
					}
				}
			}

			if (keep) {
				output[y * width + x] = 1;
			}
		}
	}

	return output;
}

function morphDilate(mask: Uint8Array, width: number, height: number, kernelSize: number) {
	const output = new Uint8Array(width * height);
	const half = Math.floor(kernelSize / 2);
	const start = -half;
	const end = kernelSize - half - 1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			if (mask[y * width + x] !== 1) {
				continue;
			}

			for (let offsetY = start; offsetY <= end; offsetY += 1) {
				for (let offsetX = start; offsetX <= end; offsetX += 1) {
					const sampleX = x + offsetX;
					const sampleY = y + offsetY;
					if (
						sampleX < 0 ||
						sampleY < 0 ||
						sampleX >= width ||
						sampleY >= height
					) {
						continue;
					}
					output[sampleY * width + sampleX] = 1;
				}
			}
		}
	}

	return output;
}

function morphOpen(mask: Uint8Array, width: number, height: number, kernelSize = 4) {
	return morphDilate(morphErode(mask, width, height, kernelSize), width, height, kernelSize);
}

function morphClose(mask: Uint8Array, width: number, height: number, kernelSize = 2) {
	return morphErode(morphDilate(mask, width, height, kernelSize), width, height, kernelSize);
}

function extractComponents(mask: Uint8Array, width: number, height: number): Component[] {
	const visited = new Uint8Array(width * height);
	const queue = new Int32Array(width * height);
	const components: Component[] = [];
	const offsets = [1, -1, width, -width];

	for (let start = 0; start < mask.length; start += 1) {
		if (mask[start] === 0 || visited[start] === 1) {
			continue;
		}

		let queueStart = 0;
		let queueEnd = 0;
		queue[queueEnd] = start;
		queueEnd += 1;
		visited[start] = 1;
		const pixels: number[] = [];

		while (queueStart < queueEnd) {
			const current = queue[queueStart];
			queueStart += 1;
			pixels.push(current);
			const x = current % width;
			const y = Math.floor(current / width);

			for (const offset of offsets) {
				const next = current + offset;
				if (next < 0 || next >= mask.length) {
					continue;
				}
				const nextX = next % width;
				const nextY = Math.floor(next / width);
				if (Math.abs(nextX - x) + Math.abs(nextY - y) !== 1) {
					continue;
				}
				if (mask[next] === 0 || visited[next] === 1) {
					continue;
				}
				visited[next] = 1;
				queue[queueEnd] = next;
				queueEnd += 1;
			}
		}

		components.push({
			area: pixels.length,
			pixels,
		});
	}

	return components;
}

function polygonArea(points: Point[]) {
	if (points.length < 3) {
		return 0;
	}

	let area = 0;
	for (let index = 0; index < points.length; index += 1) {
		const [x1, y1] = points[index];
		const [x2, y2] = points[(index + 1) % points.length];
		area += x1 * y2 - x2 * y1;
	}
	return area / 2;
}

function buildBoundaryLoops(
	component: Component,
	mask: Uint8Array,
	width: number,
	height: number,
) {
	const edges: BoundaryEdge[] = [];

	for (const pixel of component.pixels) {
		const x = pixel % width;
		const y = Math.floor(pixel / width);
		const topOutside = y === 0 || mask[(y - 1) * width + x] === 0;
		const rightOutside = x === width - 1 || mask[y * width + (x + 1)] === 0;
		const bottomOutside = y === height - 1 || mask[(y + 1) * width + x] === 0;
		const leftOutside = x === 0 || mask[y * width + (x - 1)] === 0;

		if (topOutside) edges.push({ start: [x, y], end: [x + 1, y] });
		if (rightOutside) edges.push({ start: [x + 1, y], end: [x + 1, y + 1] });
		if (bottomOutside) edges.push({ start: [x + 1, y + 1], end: [x, y + 1] });
		if (leftOutside) edges.push({ start: [x, y + 1], end: [x, y] });
	}

	if (edges.length === 0) {
		return [];
	}

	const adjacency = new Map<string, number[]>();
	const used = new Uint8Array(edges.length);
	for (let index = 0; index < edges.length; index += 1) {
		const key = edgeKey(edges[index].start);
		const existing = adjacency.get(key) ?? [];
		existing.push(index);
		adjacency.set(key, existing);
	}

	function takeUnusedEdge(start: Point) {
		const edgeIndices = adjacency.get(edgeKey(start));
		if (!edgeIndices) {
			return null;
		}

		for (const edgeIndex of edgeIndices) {
			if (used[edgeIndex] === 0) {
				return edgeIndex;
			}
		}

		return null;
	}

	const loops: Point[][] = [];
	for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
		if (used[edgeIndex] === 1) {
			continue;
		}

		const start = edges[edgeIndex].start;
		const loop: Point[] = [start];
		let currentIndex: number | null = edgeIndex;

		while (currentIndex !== null) {
			used[currentIndex] = 1;
			const nextPoint = edges[currentIndex].end;
			loop.push(nextPoint);
			if (pointEquals(nextPoint, start)) {
				break;
			}
			currentIndex = takeUnusedEdge(nextPoint);
		}

		if (loop.length >= 4 && pointEquals(loop[0], loop[loop.length - 1])) {
			loops.push(loop);
		}
	}

	return loops;
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point) {
	const [x, y] = point;
	const [x1, y1] = lineStart;
	const [x2, y2] = lineEnd;
	const dx = x2 - x1;
	const dy = y2 - y1;

	if (dx === 0 && dy === 0) {
		return Math.hypot(x - x1, y - y1);
	}

	const t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy), 0, 1);
	const projectionX = x1 + t * dx;
	const projectionY = y1 + t * dy;
	return Math.hypot(x - projectionX, y - projectionY);
}

function rdp(points: Point[], epsilon: number): Point[] {
	if (points.length < 3) {
		return points;
	}

	let maxDistance = 0;
	let splitIndex = 0;
	const lastIndex = points.length - 1;
	for (let index = 1; index < lastIndex; index += 1) {
		const distance = perpendicularDistance(points[index], points[0], points[lastIndex]);
		if (distance > maxDistance) {
			maxDistance = distance;
			splitIndex = index;
		}
	}

	if (maxDistance > epsilon) {
		const left = rdp(points.slice(0, splitIndex + 1), epsilon);
		const right = rdp(points.slice(splitIndex), epsilon);
		return [...left.slice(0, -1), ...right];
	}

	return [points[0], points[lastIndex]];
}

function simplifyClosedPolygon(points: Point[], epsilon: number) {
	if (points.length < 4) {
		return points;
	}

	const ring = pointEquals(points[0], points[points.length - 1])
		? points.slice(0, -1)
		: [...points];
	if (ring.length < 3) {
		return [];
	}

	const simplified = rdp(ring, epsilon);
	if (simplified.length < 3) {
		return [];
	}
	if (!pointEquals(simplified[0], simplified[simplified.length - 1])) {
		simplified.push(simplified[0]);
	}
	return simplified;
}

function chaikinSmoothClosed(points: Point[], iterations = 1) {
	if (points.length < 4 || iterations <= 0) {
		return points;
	}

	let ring = pointEquals(points[0], points[points.length - 1])
		? points.slice(0, -1)
		: [...points];
	if (ring.length < 3) {
		return points;
	}

	for (let iteration = 0; iteration < iterations; iteration += 1) {
		const next: Point[] = [];
		for (let index = 0; index < ring.length; index += 1) {
			const pointA = ring[index];
			const pointB = ring[(index + 1) % ring.length];
			next.push(
				[
					pointA[0] * 0.75 + pointB[0] * 0.25,
					pointA[1] * 0.75 + pointB[1] * 0.25,
				],
				[
					pointA[0] * 0.25 + pointB[0] * 0.75,
					pointA[1] * 0.25 + pointB[1] * 0.75,
				],
			);
		}
		ring = next;
		if (ring.length > 2400) {
			break;
		}
	}

	if (!pointEquals(ring[0], ring[ring.length - 1])) {
		ring.push(ring[0]);
	}
	return ring;
}


function createPolygonSkeleton(
	polygon: Point[],
	color: RGB,
	area: number,
	controls: SketchVectorControls,
	customData: Record<string, unknown>,
	groupId: string,
	layerIndex: number,
	overrides?: {
		strokeColor?: string;
		backgroundColor?: string;
		strokeWidth?: number;
		roughness?: number;
	},
): PolygonElementCandidate | null {
	if (polygon.length < 4) {
		return null;
	}

	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const [x, y] of polygon) {
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}

	const width = maxX - minX;
	const height = maxY - minY;
	if (width <= 1 || height <= 1) {
		return null;
	}

	const points = polygon.map(([x, y]) => [x - minX, y - minY] as Point);
	if (!pointEquals(points[0], points[points.length - 1])) {
		points.push(points[0]);
	}

	const baseColor = rgbToHex(color);
	return {
		area,
		color,
		skeleton: {
			type: 'line',
			x: Math.round(minX * 100) / 100,
			y: Math.round(minY * 100) / 100,
			points,
			strokeColor: overrides?.strokeColor ?? '#050505',
			backgroundColor: overrides?.backgroundColor ?? baseColor,
			fillStyle: 'solid',
			// Dark stroke centered on boundary — inward half hidden by fill, outward
			// half overwritten by adjacent solid-fill polygons. Eliminates seam gaps.
			strokeWidth:
				overrides?.strokeWidth ?? clamp(controls.edgeSensitivity / 12, 1.8, 3.5),
			strokeStyle: 'solid',
			roughness: overrides?.roughness ?? STYLE_ROUGHNESS[controls.style],
			opacity: 100,
			groupIds: [`${groupId}-layer-${layerIndex}`, groupId],
			customData,
		},
	};
}

async function runLayeredVectorization(
	blob: Blob,
	options?: SketchVectorizerOptions,
) {
	const startedAt = performance.now();
	const controls = resolveControls(options?.controls);
	const decoded = await decodeImageData(blob, controls, options ?? {});
	const logs: string[] = [];
	const customData = {
		type: 'ai-generated-vector-elements',
		renderer: 'layered-sketch-vectorizer',
		...(options?.customData ?? {}),
	};
	const groupId = crypto.randomUUID();
	const requestedColors = clamp(Math.round(controls.colorPalette), 2, 24);

	logs.push('Applying edge-preserving bilateral filter...');
	const filtered = applyBilateralFilter(decoded.data, decoded.width, decoded.height, {
		radius: controls.detailLevel > 0.75 ? 2 : 1,
		sigmaColor: 45,
		sigmaSpace: 2,
	});

	logs.push('Applying k-means color clustering...');
	const rng = makeSeededRandom(computeImageSeed(decoded.data));
	const rawCenters = runKMeans(samplePixels(filtered), requestedColors, 18, rng);
	const rawAssignment = assignLabels(filtered, decoded.width, decoded.height, rawCenters);

	// Merge perceptually similar clusters before polygon extraction.
	// Without this, a subject with subtle tonal gradients (e.g. a brown dog)
	// produces many near-identical clusters that leave seam gaps at boundaries
	// and inflate element counts unpredictably across runs.
	// Threshold: RGB squared distance ≤ 40² (catches ~25-unit per-channel differences).
	const { centers, labels, counts } = mergeSimilarColorClusters(
		rawCenters,
		rawAssignment.labels,
		rawAssignment.counts,
		40 * 40,
	);

	const { backgroundLabel, backgroundLabels } = detectBackgroundLabels(centers, counts);
	const epsilon = clamp(2.45 - controls.detailLevel * 1.35, 0.85, 2.25);
	const minArea = Math.max(18, Math.round(48 - controls.detailLevel * 32));
	const kernelSize = controls.detailLevel >= 0.85 ? 3 : 4;

	const fillCandidates: PolygonElementCandidate[] = [];
	let componentsFound = 0;
	let componentsFiltered = 0;

	for (let label = 0; label < centers.length; label += 1) {
		if (backgroundLabels.has(label)) {
			continue;
		}

		// Dark clusters (frames, outlines) form thin structures — typically only
		// 3-6px wide in the working image. morphOpen with kernel ≥ 3 erodes them
		// away completely, splitting the frame into many disconnected islands that
		// leave visible gaps. For these clusters we only close (fill tiny holes)
		// and skip the open step. Light/medium clusters are large solid fills where
		// the open step still helps remove K-means noise protrusions.
		const clusterBrightness =
			0.299 * centers[label].r + 0.587 * centers[label].g + 0.114 * centers[label].b;
		const isDarkCluster = clusterBrightness < 80;
		const closedMask = morphClose(
			binaryMaskForLabel(labels, decoded.width, decoded.height, label),
			decoded.width,
			decoded.height,
			isDarkCluster ? 3 : 2,
		);
		const openedMask = isDarkCluster
			? closedMask
			: morphOpen(closedMask, decoded.width, decoded.height, kernelSize);
		const components = extractComponents(openedMask, decoded.width, decoded.height);
		componentsFound += components.length;

		// Keep all components above minArea — no per-cluster cap.
		// The overall maxElements budget and 20-layer ceiling act as the safety valves.
		const eligible = components
			.filter((c) => c.area >= minArea)
			.sort((a, b) => b.area - a.area);
		componentsFiltered += components.length - eligible.length;

		if (eligible.length === 0) {
			continue;
		}

		for (const component of eligible) {
			const loops = buildBoundaryLoops(component, openedMask, decoded.width, decoded.height);
			if (loops.length === 0) {
				continue;
			}

			let chosenLoop = loops[0];
			let chosenArea = Math.abs(polygonArea(chosenLoop));
			for (let index = 1; index < loops.length; index += 1) {
				const currentArea = Math.abs(polygonArea(loops[index]));
				if (currentArea > chosenArea) {
					chosenLoop = loops[index];
					chosenArea = currentArea;
				}
			}

			const smoothed = chaikinSmoothClosed(
				chosenLoop,
				controls.detailLevel >= 0.8 ? 1 : 0,
			);
			const simplified = simplifyClosedPolygon(smoothed, epsilon);
			if (simplified.length < 4) {
				continue;
			}

			const candidate = createPolygonSkeleton(
				simplified,
				centers[label],
				component.area,
				controls,
				customData,
				groupId,
				label,
			);
			if (candidate) {
				fillCandidates.push(candidate);
			}
		}
	}

	// Painter's algorithm: darker elements go first (bottom), lighter elements go
	// last (top). This is the correct depth order for layered illustrations:
	// - Dark frame / silhouette polygon covers the full object footprint → bottom
	// - Medium fills (windows, shadows) in the middle
	// - Light background fills (cream bus body, fur) rendered last → top
	//
	// The light element's polygon only covers its own K-means pixels, so it
	// exposes the dark fill underneath wherever dark pixels exist (window frames,
	// outlines). No ring-shape detection needed — the K-means boundaries do the
	// clipping automatically.
	//
	// Within the same brightness band, larger area goes first so large-area
	// fragments of a hue don't accidentally cover finer same-hue details.
	const brightness = ({ color: c }: PolygonElementCandidate) =>
		0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
	fillCandidates.sort((left, right) => {
		const bLeft = brightness(left);
		const bRight = brightness(right);
		if (Math.abs(bLeft - bRight) > 15) return bLeft - bRight; // darker first
		return right.area - left.area; // same band: larger first
	});

	const maxElements =
		options?.maxElements ?? MAX_ELEMENTS_BY_COMPLEXITY[controls.complexity];
	const emittedSkeletons = fillCandidates
		.slice(0, maxElements)
		.map((candidate) => candidate.skeleton);

	if (emittedSkeletons.length === 0) {
		throw new Error('No vectorizable regions were detected in this image.');
	}

	const convertToExcalidrawElements = await getConvertToExcalidrawElements();
	const elements = convertToExcalidrawElements(emittedSkeletons as never[]) as ExcalidrawElement[];
	const bounds = getElementsBounds(elements);

	return {
		elements,
		width: bounds.width,
		height: bounds.height,
		logs,
		metadata: {
			sourceWidth: decoded.sourceWidth,
			sourceHeight: decoded.sourceHeight,
			workingWidth: decoded.width,
			workingHeight: decoded.height,
			numColorsRequested: requestedColors,
			numColorsUsed: centers.length,
			backgroundLabel,
			morphologyKernelSize: kernelSize,
			epsilon,
			minArea,
			componentsFound,
			componentsFiltered,
			elementsCreated: fillCandidates.length,
			elementsEmitted: elements.length,
			processingMs: Math.round(performance.now() - startedAt),
		},
	} satisfies CompiledSketchVectorization;
}

export async function vectorizeRasterBlobToSketchElements(
	blob: Blob,
	options?: SketchVectorizerOptions,
): Promise<CompiledSketchVectorization> {
	return runLayeredVectorization(blob, options);
}
