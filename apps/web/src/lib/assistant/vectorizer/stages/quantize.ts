import type {
	RGB,
	DecodedImageData,
	QuantizationResult,
	SketchVectorControls,
} from '../types.js';
import {
	MAX_KMEANS_SAMPLES,
	KMEANS_MAX_ITERATIONS,
	KMEANS_MIN_CLUSTERS,
	KMEANS_MAX_CLUSTERS,
	MERGE_BRIGHT_CUTOFF,
	MERGE_DARK_CUTOFF,
	MERGE_MAX_DIST_SQ,
	BILATERAL_SIGMA_COLOR,
	BILATERAL_SIGMA_SPACE,
	BACKGROUND_BRIGHTNESS_THRESHOLD,
} from '../config.js';

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Calculate brightness of an RGB color */
function brightness(color: RGB): number {
	return color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
}

/** Calculate chroma (color intensity) of an RGB color */
function chroma(color: RGB): number {
	return Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
}

/** Calculate squared Euclidean distance between two colors */
function colorDistanceSq(a: RGB, b: RGB): number {
	const dr = a.r - b.r;
	const dg = a.g - b.g;
	const db = a.b - b.b;
	return dr * dr + dg * dg + db * db;
}

/** Sample pixels for K-means clustering */
function samplePixels(data: Uint8ClampedArray, maxSamples = MAX_KMEANS_SAMPLES): RGB[] {
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

/** Derives a deterministic seed from pixel data for reproducible clustering */
function computeImageSeed(data: Uint8ClampedArray): number {
	let h = 2166136261; // FNV-1a offset basis
	const step = Math.max(4, Math.floor(data.length / 2000) * 4);
	for (let i = 0; i < data.length; i += step) {
		h ^= data[i];
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h || 1; // xorshift must not receive 0
}

/** Simple xorshift32 PRNG returning values in [0, 1) */
function makeSeededRandom(seed: number): () => number {
	let s = seed >>> 0 || 1;
	return (): number => {
		s ^= s << 13;
		s ^= s >> 17;
		s ^= s << 5;
		s = s >>> 0;
		return s / 4294967296;
	};
}

/** Find index of nearest color center */
function nearestCenterIndex(color: RGB, centers: RGB[]): number {
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

/** Initialize K-means centers using K-means++ algorithm */
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

/** Run K-means clustering to find color centers */
function runKMeans(
	samples: RGB[],
	requestedK: number,
	maxIterations = KMEANS_MAX_ITERATIONS,
	rng: () => number = Math.random,
): RGB[] {
	const clusterCount = clamp(requestedK, KMEANS_MIN_CLUSTERS, samples.length);
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

/**
 * Merges K-means color centers that are perceptually close.
 * This prevents over-segmentation of subjects with subtle tonal variation.
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

	// Guard: skip merging at both ends of the brightness spectrum
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

	// If nothing merged, return originals unchanged
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

/** Assign each pixel to its nearest color center */
function assignLabels(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	centers: RGB[],
): { labels: Uint16Array; counts: Uint32Array } {
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

/** Detect which color labels represent background colors */
function detectBackgroundLabels(
	centers: RGB[],
	counts: Uint32Array,
): { backgroundLabel: number; backgroundLabels: Set<number> } {
	const backgroundLabels = new Set<number>();

	// Background must be BRIGHT (near-white), not merely the most common cluster
	let mainIndex = -1;
	for (let index = 0; index < centers.length; index += 1) {
		if (
			brightness(centers[index]) > BACKGROUND_BRIGHTNESS_THRESHOLD &&
			(mainIndex === -1 || brightness(centers[index]) > brightness(centers[mainIndex]))
		) {
			mainIndex = index;
		}
	}
	// Fallback: if no cluster is bright enough, use the brightest one available
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
			brightness(candidate) > BACKGROUND_BRIGHTNESS_THRESHOLD &&
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

/** Apply edge-preserving bilateral filter to reduce noise while preserving edges */
function applyBilateralFilter(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	options: {
		radius: number;
		sigmaColor: number;
		sigmaSpace: number;
	},
): Uint8ClampedArray {
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
						(r - centerR) * (r - centerR) +
						(g - centerG) * (g - centerG) +
						(b - centerB) * (b - centerB);
					const colorWeight = Math.exp(-(colorDistance / twoSigmaColorSq));
					const spatialWeight = spatialKernel[(deltaY + radius) * diameter + (deltaX + radius)];
					const weight = colorWeight * spatialWeight;
					totalWeight += weight;
					weightedR += r * weight;
					weightedG += g * weight;
					weightedB += b * weight;
				}
			}

			output[centerOffset] = totalWeight <= 0 ? centerR : Math.round(weightedR / totalWeight);
			output[centerOffset + 1] = totalWeight <= 0 ? centerG : Math.round(weightedG / totalWeight);
			output[centerOffset + 2] = totalWeight <= 0 ? centerB : Math.round(weightedB / totalWeight);
			output[centerOffset + 3] = 255;
		}
	}

	return output;
}

/**
 * Color quantization stage: bilateral filtering + K-means clustering
 *
 * @param image - Decoded image data
 * @param controls - User control parameters
 * @returns Quantization result with color centers and pixel labels
 */
export function quantize(
	image: DecodedImageData,
	controls: SketchVectorControls,
): QuantizationResult {
	// Apply edge-preserving bilateral filter
	const filtered = applyBilateralFilter(image.data, image.width, image.height, {
		radius: controls.detailLevel > 0.75 ? 2 : 1,
		sigmaColor: BILATERAL_SIGMA_COLOR,
		sigmaSpace: BILATERAL_SIGMA_SPACE,
	});

	// Generate seeded random for reproducible clustering
	const rng = makeSeededRandom(computeImageSeed(image.data));

	// Run K-means clustering
	const requestedColors = clamp(
		Math.round(controls.colorPalette),
		KMEANS_MIN_CLUSTERS,
		KMEANS_MAX_CLUSTERS,
	);
	const rawCenters = runKMeans(samplePixels(filtered), requestedColors, KMEANS_MAX_ITERATIONS, rng);
	const rawAssignment = assignLabels(filtered, image.width, image.height, rawCenters);

	// Merge perceptually similar clusters before polygon extraction
	const { centers, labels, counts } = mergeSimilarColorClusters(
		rawCenters,
		rawAssignment.labels,
		rawAssignment.counts,
		MERGE_MAX_DIST_SQ,
	);

	const { backgroundLabel, backgroundLabels } = detectBackgroundLabels(centers, counts);

	return {
		centers,
		labels,
		counts,
		backgroundLabel,
		backgroundLabels,
		requestedColors,
	};
}
