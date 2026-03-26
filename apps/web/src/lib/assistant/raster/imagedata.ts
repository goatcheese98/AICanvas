import { optimize, optimizeLayers, serialize, trace } from './stages';
import type { ColorQuantizationResult, RgbaColor, TraceLayer, TraceOutput } from './types';
import type { OptimizeOutput, SerializeOutput } from './types';

// ─── Color Utilities ────────────────────────────────────────────────────────────

function luminance({ r, g, b }: RgbaColor): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation({ r, g, b }: RgbaColor): number {
	return Math.max(r, g, b) - Math.min(r, g, b);
}

// ─── K-Means Quantization ───────────────────────────────────────────────────────

function kmeansQuantize(imageData: ImageData, k: number): ColorQuantizationResult {
	const { data, width, height } = imageData;
	const n = width * height;

	const pixels: [number, number, number][] = [];
	const pixelToSample = new Int32Array(n).fill(-1);

	for (let i = 0; i < n; i += 1) {
		if (data[i * 4 + 3] >= 16) {
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

	// K-Means++ initialization
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

	for (let iter = 0; iter < 15; iter += 1) {
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

// ─── Main ImageData Function ────────────────────────────────────────────────────

export interface ImageDataVectorizeOptions {
	maxColors: number;
	colorMergeThreshold: number;
	bgLuminanceThreshold: number;
	monochromeSaturationThreshold: number;
	minAreaRatio: number;
	maxSampleDimension: number;
	simplificationTolerance: number;
	maxSkeletonPaths: number;
	minPathLength: number;
	minPointCount: number;
}

export function vectorizeImageDataToSvg(
	imageData: ImageData,
	options: ImageDataVectorizeOptions,
): string {
	const { width, height } = imageData;

	// Quantize colors
	const quantized = kmeansQuantize(imageData, options.maxColors);
	const { centers, labels } = mergeSimilarCenters(
		quantized.centers,
		quantized.labels,
		options.colorMergeThreshold,
	);

	// Detect background
	let bgIndex = -1;
	let bgLuminance = 255;
	for (let i = 0; i < centers.length; i += 1) {
		const lum = luminance(centers[i]);
		if (lum > options.bgLuminanceThreshold && (bgIndex === -1 || lum > bgLuminance)) {
			bgIndex = i;
			bgLuminance = lum;
		}
	}
	if (bgIndex === -1) {
		bgLuminance = Math.max(...centers.map(luminance));
	}

	// Detect monochrome
	const fgCenters = bgIndex >= 0 ? centers.filter((_, i) => i !== bgIndex) : centers;
	const isMonochrome =
		fgCenters.length > 0 &&
		fgCenters.every((c) => saturation(c) < options.monochromeSaturationThreshold) &&
		fgCenters.some((c) => luminance(c) < bgLuminance - 50);

	const minArea = Math.max(4, Math.round(width * height * options.minAreaRatio));

	// Use the trace stage
	const traceResult: TraceOutput = trace({
		width,
		height,
		labels,
		centers,
		bgIndex,
		bgLuminance,
		isMonochrome,
		minArea,
	});

	// Optimize
	let optimizedLayers: TraceLayer[] = [];
	if (traceResult.paths.length > 0) {
		const optimizeResult: OptimizeOutput = optimize({
			paths: traceResult.paths,
			width,
			height,
			options,
		});
		traceResult.paths = optimizeResult.paths;
	} else {
		optimizedLayers = optimizeLayers(traceResult.layers, options);
	}

	// Serialize
	const serializeResult: SerializeOutput = serialize({
		width,
		height,
		paths: traceResult.paths,
		layers: optimizedLayers,
		inkColor: traceResult.inkColor,
	});

	return serializeResult.svg;
}
