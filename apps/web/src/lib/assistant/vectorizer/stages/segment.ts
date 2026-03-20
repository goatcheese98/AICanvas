import type { Component, RGB } from '../types.js';
import { DARK_CLUSTER_THRESHOLD } from '../config.js';

/** Create a binary mask for a specific label */
export function binaryMaskForLabel(
	labels: Uint16Array,
	width: number,
	height: number,
	label: number,
): Uint8Array {
	const mask = new Uint8Array(width * height);
	for (let index = 0; index < labels.length; index += 1) {
		mask[index] = labels[index] === label ? 1 : 0;
	}
	return mask;
}

/** Morphological erosion operation */
function morphErode(mask: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
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

/** Morphological dilation operation */
function morphDilate(mask: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
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
					if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) {
						continue;
					}
					output[sampleY * width + sampleX] = 1;
				}
			}
		}
	}

	return output;
}

/** Morphological opening operation (erosion followed by dilation) */
export function morphOpen(
	mask: Uint8Array,
	width: number,
	height: number,
	kernelSize = 4,
): Uint8Array {
	return morphDilate(morphErode(mask, width, height, kernelSize), width, height, kernelSize);
}

/** Morphological closing operation (dilation followed by erosion) */
export function morphClose(
	mask: Uint8Array,
	width: number,
	height: number,
	kernelSize = 2,
): Uint8Array {
	return morphErode(morphDilate(mask, width, height, kernelSize), width, height, kernelSize);
}

/** Extract connected components from a binary mask using flood fill */
export function extractComponents(mask: Uint8Array, width: number, height: number): Component[] {
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

/** Calculate brightness of an RGB color */
function brightness(color: RGB): number {
	return color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
}

/**
 * Process a single color label: create mask, apply morphology, extract components
 *
 * @param label - Color label index
 * @param color - RGB color for this label
 * @param labels - Pixel label array
 * @param width - Image width
 * @param height - Image height
 * @param kernelSize - Morphological operation kernel size
 * @param minArea - Minimum component area threshold
 * @returns Object with filtered components, processed mask, and processing stats
 */
export function processLabel(
	label: number,
	color: RGB,
	labels: Uint16Array,
	width: number,
	height: number,
	kernelSize: number,
	minArea: number,
): {
	components: Component[];
	mask: Uint8Array;
	filtered: number;
} {
	// Dark clusters form thin structures - skip morphClose to preserve gaps
	const clusterBrightness = brightness(color);
	const isDarkCluster = clusterBrightness < DARK_CLUSTER_THRESHOLD;

	const rawMask = binaryMaskForLabel(labels, width, height, label);
	const processedMask = isDarkCluster
		? rawMask
		: morphOpen(morphClose(rawMask, width, height, 2), width, height, kernelSize);

	const allComponents = extractComponents(processedMask, width, height);

	// Dark clusters use lower minArea so small details aren't filtered out
	const componentMinArea = isDarkCluster ? Math.max(4, Math.round(minArea * 0.35)) : minArea;
	const components = allComponents
		.filter((c) => c.area >= componentMinArea)
		.sort((a, b) => b.area - a.area);

	return {
		components,
		mask: processedMask,
		filtered: allComponents.length - components.length,
	};
}
