import { BILATERAL_FILTER, KMEANS } from '../config';
import type {
	ColorQuantizationResult,
	PreprocessInput,
	PreprocessOutput,
	RgbaColor,
} from '../types';

// ─── Color Utilities ────────────────────────────────────────────────────────────

function clampByte(v: number): number {
	return Math.max(0, Math.min(255, Math.round(v)));
}

function luminance({ r, g, b }: RgbaColor): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation({ r, g, b }: RgbaColor): number {
	return Math.max(r, g, b) - Math.min(r, g, b);
}

// ─── Image Loading ──────────────────────────────────────────────────────────────

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load raster asset for vectorization.'));
		};
		image.src = url;
	});
}

function renderImageToCanvas(
	image: HTMLImageElement,
	maxSampleDimension: number,
): { width: number; height: number; imageData: ImageData } {
	const scale = Math.min(
		1,
		maxSampleDimension / Math.max(image.naturalWidth, image.naturalHeight, 1),
	);
	const width = Math.max(1, Math.round(image.naturalWidth * scale));
	const height = Math.max(1, Math.round(image.naturalHeight * scale));

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) {
		throw new Error('Canvas 2D context unavailable for vectorization.');
	}

	// Composite onto white to handle transparency before pixel analysis
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, width, height);
	ctx.drawImage(image, 0, 0, width, height);

	return { width, height, imageData: ctx.getImageData(0, 0, width, height) };
}

// ─── Bilateral Filter ───────────────────────────────────────────────────────────

/**
 * Edge-preserving smoothing: flattens color noise within flat regions while
 * keeping luminance boundaries sharp — critical for clean segmentation.
 */
function applyBilateralFilter(imageData: ImageData): ImageData {
	const { data, width, height } = imageData;
	const result = new Uint8ClampedArray(data);
	const { SIGMA_COLOR_2, SIGMA_SPACE_2, RADIUS } = BILATERAL_FILTER;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const ci = (y * width + x) * 4;
			const cr = data[ci];
			const cg = data[ci + 1];
			const cb = data[ci + 2];
			let sumR = 0;
			let sumG = 0;
			let sumB = 0;
			let sumW = 0;

			for (let dy = -RADIUS; dy <= RADIUS; dy += 1) {
				for (let dx = -RADIUS; dx <= RADIUS; dx += 1) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
					const ni = (ny * width + nx) * 4;
					const nr = data[ni];
					const ng = data[ni + 1];
					const nb = data[ni + 2];
					const w = Math.exp(
						-(dx * dx + dy * dy) / SIGMA_SPACE_2 -
							((cr - nr) ** 2 + (cg - ng) ** 2 + (cb - nb) ** 2) / SIGMA_COLOR_2,
					);
					sumR += nr * w;
					sumG += ng * w;
					sumB += nb * w;
					sumW += w;
				}
			}

			result[ci] = sumR / sumW;
			result[ci + 1] = sumG / sumW;
			result[ci + 2] = sumB / sumW;
		}
	}

	// Return a plain compatible object to avoid the ImageData constructor
	// (unavailable in some test environments)
	return { data: result, width, height } as unknown as ImageData;
}

// ─── K-Means++ Quantization ─────────────────────────────────────────────────────

/**
 * K-Means++ clustering: distance-proportional initialization and iterative
 * refinement produce more accurate color groupings than histogram binning,
 * especially on gradients and soft-edged AI-generated images.
 */
function kmeansQuantize(imageData: ImageData, k: number): ColorQuantizationResult {
	const { data, width, height } = imageData;
	const n = width * height;

	const pixels: [number, number, number][] = [];
	const pixelToSample = new Int32Array(n).fill(-1);

	for (let i = 0; i < n; i += 1) {
		if (data[i * 4 + 3] >= KMEANS.MIN_ALPHA) {
			pixelToSample[i] = pixels.length;
			pixels.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
		}
	}

	if (pixels.length === 0) {
		return {
			centers: [{ r: 255, g: 255, b: 255, a: 255 }],
			labels: new Int32Array(n),
		};
	}

	// K-Means++ initialization: distance-proportional seeding
	const seedIndices: number[] = [Math.floor(Math.random() * pixels.length)];
	while (seedIndices.length < k) {
		const distances = pixels.map((p) => {
			let min = Number.POSITIVE_INFINITY;
			for (const si of seedIndices) {
				const c = pixels[si];
				const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
				if (d < min) min = d;
			}
			return min;
		});
		const total = distances.reduce((a, b) => a + b, 0);
		let r = total > 0 ? Math.random() * total : -1;
		let chosen = pixels.length - 1;
		for (let i = 0; i < distances.length; i += 1) {
			r -= distances[i];
			if (r <= 0) {
				chosen = i;
				break;
			}
		}
		seedIndices.push(chosen);
	}

	let centers = seedIndices.map((i) => [...pixels[i]] as [number, number, number]);
	const sampleLabels = new Int32Array(pixels.length);

	for (let iter = 0; iter < KMEANS.MAX_ITERATIONS; iter += 1) {
		let changed = false;
		for (let i = 0; i < pixels.length; i += 1) {
			const p = pixels[i];
			let best = 0;
			let bestDist = Number.POSITIVE_INFINITY;
			for (let j = 0; j < centers.length; j += 1) {
				const c = centers[j];
				const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
				if (d < bestDist) {
					bestDist = d;
					best = j;
				}
			}
			if (sampleLabels[i] !== best) {
				sampleLabels[i] = best;
				changed = true;
			}
		}
		if (!changed) break;

		const sums = Array.from({ length: k }, () => [0, 0, 0, 0] as [number, number, number, number]);
		for (let i = 0; i < pixels.length; i += 1) {
			const s = sums[sampleLabels[i]];
			s[0] += pixels[i][0];
			s[1] += pixels[i][1];
			s[2] += pixels[i][2];
			s[3] += 1;
		}
		centers = sums.map((s, j) => (s[3] > 0 ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[j]));
	}

	const colorCenters: RgbaColor[] = centers.map(([r, g, b]) => ({ r, g, b, a: 255 }));
	const labels = new Int32Array(n);
	for (let i = 0; i < n; i += 1) {
		const si = pixelToSample[i];
		if (si >= 0) labels[i] = sampleLabels[si];
	}

	return { centers: colorCenters, labels };
}

// ─── Color Cluster Merging ──────────────────────────────────────────────────────

/**
 * Merges k-means clusters whose RGB centroids are within `threshold` Euclidean
 * distance. Reduces element count for images with near-identical color regions
 * (e.g. dark body with slight gradient, JPEG boundary artifacts).
 * Uses union-find for O(k²) merge detection, then re-labels the pixel array.
 */
function mergeSimilarCenters(
	centers: RgbaColor[],
	labels: Int32Array,
	threshold: number,
): { centers: RgbaColor[]; labels: Int32Array } {
	const n = centers.length;
	if (n <= 1) return { centers, labels };

	const parent = Array.from({ length: n }, (_, i) => i);
	const find = (x: number): number => {
		let current = x;
		while (parent[current] !== current) {
			parent[current] = parent[parent[current]];
			current = parent[current];
		}
		return current;
	};

	const sq = threshold * threshold;
	for (let i = 0; i < n; i += 1) {
		for (let j = i + 1; j < n; j += 1) {
			const dr = centers[i].r - centers[j].r;
			const dg = centers[i].g - centers[j].g;
			const db = centers[i].b - centers[j].b;
			if (dr * dr + dg * dg + db * db <= sq) {
				const ri = find(i);
				const rj = find(j);
				if (ri !== rj) parent[rj] = ri;
			}
		}
	}

	const groupAccum = new Map<number, { r: number; g: number; b: number; count: number }>();
	for (let i = 0; i < n; i += 1) {
		const root = find(i);
		const acc = groupAccum.get(root) ?? { r: 0, g: 0, b: 0, count: 0 };
		acc.r += centers[i].r;
		acc.g += centers[i].g;
		acc.b += centers[i].b;
		acc.count += 1;
		groupAccum.set(root, acc);
	}

	const rootOrder: number[] = [];
	for (const root of groupAccum.keys()) rootOrder.push(root);
	rootOrder.sort((a, b) => a - b);

	const newCenters: RgbaColor[] = rootOrder.map((root) => {
		const acc = groupAccum.get(root)!;
		return {
			r: Math.round(acc.r / acc.count),
			g: Math.round(acc.g / acc.count),
			b: Math.round(acc.b / acc.count),
			a: 255,
		};
	});

	const rootToNew = new Map(rootOrder.map((root, ni) => [root, ni]));
	const newLabels = new Int32Array(labels.length);
	for (let i = 0; i < labels.length; i += 1) {
		newLabels[i] = rootToNew.get(find(labels[i])) ?? 0;
	}

	return { centers: newCenters, labels: newLabels };
}

// ─── Background Detection ───────────────────────────────────────────────────────

function detectBackground(
	centers: RgbaColor[],
	bgLuminanceThreshold: number,
): { bgIndex: number; bgLuminance: number } {
	let bgIndex = -1;
	let bgLuminance = 255;

	for (let i = 0; i < centers.length; i += 1) {
		const lum = luminance(centers[i]);
		if (lum > bgLuminanceThreshold && (bgIndex === -1 || lum > bgLuminance)) {
			bgIndex = i;
			bgLuminance = lum;
		}
	}

	if (bgIndex === -1) {
		bgLuminance = Math.max(...centers.map(luminance));
	}

	return { bgIndex, bgLuminance };
}

// ─── Monochrome Detection ───────────────────────────────────────────────────────

function detectMonochrome(
	centers: RgbaColor[],
	bgIndex: number,
	bgLuminance: number,
	monochromeSaturationThreshold: number,
): boolean {
	const fgCenters = bgIndex >= 0 ? centers.filter((_, i) => i !== bgIndex) : centers;

	// Monochrome detection: ALL foreground clusters must be genuinely achromatic
	// (saturation < threshold) — this is true for scanned pen sketches but NOT for
	// colored digital renders like a tablet with a blue/gray screen.
	return (
		fgCenters.length > 0 &&
		fgCenters.every((c) => saturation(c) < monochromeSaturationThreshold) &&
		fgCenters.some((c) => luminance(c) < bgLuminance - 50)
	);
}

// ─── Main Preprocess Function ───────────────────────────────────────────────────

export async function preprocess(input: PreprocessInput): Promise<PreprocessOutput> {
	const { blob, options } = input;

	// Load and render image
	const image = await loadImageFromBlob(blob);
	const { width, height, imageData } = renderImageToCanvas(image, options.maxSampleDimension);

	// Apply bilateral filter: edge-preserving denoising before quantization
	const filtered = applyBilateralFilter(imageData);

	// K-Means++ quantization, then merge perceptually near-identical clusters.
	// A merge threshold of 30 RGB units collapses slight color variants (e.g.
	// a black bezel at #050505 and a near-black shadow at #1a1818) into one
	// region, naturally reducing element count without losing visible structure.
	const quantized = kmeansQuantize(filtered, options.maxColors);
	const { centers, labels } = mergeSimilarCenters(
		quantized.centers,
		quantized.labels,
		options.colorMergeThreshold,
	);

	// Update quantized with merged results
	const mergedQuantized: ColorQuantizationResult = { centers, labels };

	// Detect background: lightest cluster with luminance > threshold
	const { bgIndex, bgLuminance } = detectBackground(centers, options.bgLuminanceThreshold);

	// Detect if image is monochrome
	const isMonochrome = detectMonochrome(
		centers,
		bgIndex,
		bgLuminance,
		options.monochromeSaturationThreshold,
	);

	// Prune components smaller than min area ratio
	const minArea = Math.max(4, Math.round(width * height * options.minAreaRatio));

	return {
		width,
		height,
		imageData,
		quantized: mergedQuantized,
		bgIndex,
		bgLuminance,
		isMonochrome,
		minArea,
	};
}
