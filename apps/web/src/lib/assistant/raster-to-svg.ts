import { simplifyPoints, type SvgPoint } from './svg-path-utils';

interface RgbaColor {
	r: number;
	g: number;
	b: number;
	a: number;
}

interface TraceLayer {
	fill: string;
	paths: string[];
	order: number;
}

interface TracedStrokePath {
	points: SvgPoint[];
	closed: boolean;
}

interface VectorizeRasterOptions {
	maxSampleDimension?: number;
	maxColors?: number;
	suppressBottomSignature?: boolean;
}

const DEFAULT_OPTIONS: Required<VectorizeRasterOptions> = {
	maxSampleDimension: 192,
	maxColors: 6,
	suppressBottomSignature: true,
};

function clampByte(value: number) {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function colorToHex(color: RgbaColor) {
	return `#${[color.r, color.g, color.b]
		.map((channel) => clampByte(channel).toString(16).padStart(2, '0'))
		.join('')}`;
}

function luminance(color: RgbaColor) {
	return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function saturation(color: RgbaColor) {
	const max = Math.max(color.r, color.g, color.b);
	const min = Math.min(color.r, color.g, color.b);
	return max - min;
}

function colorDistance(a: RgbaColor, b: RgbaColor) {
	const dr = a.r - b.r;
	const dg = a.g - b.g;
	const db = a.b - b.b;
	return Math.sqrt(dr * dr + dg * dg + db * db);
}

function pointKey(point: SvgPoint) {
	return `${point.x},${point.y}`;
}

function computeSignedArea(points: SvgPoint[]) {
	let total = 0;
	for (let index = 0; index < points.length - 1; index += 1) {
		const current = points[index];
		const next = points[index + 1];
		total += current.x * next.y - next.x * current.y;
	}
	return total / 2;
}

function averageColor(colors: RgbaColor[]) {
	const count = Math.max(1, colors.length);
	return colors.reduce(
		(accumulator, color) => ({
			r: accumulator.r + color.r / count,
			g: accumulator.g + color.g / count,
			b: accumulator.b + color.b / count,
			a: accumulator.a + color.a / count,
		}),
		{ r: 0, g: 0, b: 0, a: 0 },
	);
}

function mergeNearbyColors(colors: RgbaColor[], threshold: number) {
	const merged: RgbaColor[] = [];
	for (const color of colors) {
		const existing = merged.find((candidate) => colorDistance(candidate, color) <= threshold);
		if (existing) {
			existing.r = (existing.r + color.r) / 2;
			existing.g = (existing.g + color.g) / 2;
			existing.b = (existing.b + color.b) / 2;
			existing.a = (existing.a + color.a) / 2;
			continue;
		}
		merged.push({ ...color });
	}
	return merged;
}

function buildPalette(
	imageData: ImageData,
	options?: VectorizeRasterOptions,
): { palette: RgbaColor[]; background: RgbaColor; monochromeInk: RgbaColor | null } {
	const maxColors = options?.maxColors ?? DEFAULT_OPTIONS.maxColors;
	const histogram = new Map<
		number,
		{ count: number; total: RgbaColor }
	>();

	for (let offset = 0; offset < imageData.data.length; offset += 4) {
		const color = {
			r: imageData.data[offset],
			g: imageData.data[offset + 1],
			b: imageData.data[offset + 2],
			a: imageData.data[offset + 3],
		};
		if (color.a < 16) {
			continue;
		}
		const key =
			(Math.floor(color.r / 32) << 8) |
			(Math.floor(color.g / 32) << 4) |
			Math.floor(color.b / 32);
		const existing = histogram.get(key);
		if (existing) {
			existing.count += 1;
			existing.total.r += color.r;
			existing.total.g += color.g;
			existing.total.b += color.b;
			existing.total.a += color.a;
		} else {
			histogram.set(key, {
				count: 1,
				total: { ...color },
			});
		}
	}

	const ranked = [...histogram.values()]
		.map((entry) => ({
			count: entry.count,
			color: {
				r: entry.total.r / entry.count,
				g: entry.total.g / entry.count,
				b: entry.total.b / entry.count,
				a: entry.total.a / entry.count,
			},
		}))
		.sort((left, right) => right.count - left.count);

	const detectedBackground =
		ranked.find((entry) => luminance(entry.color) >= 235 && entry.color.a >= 32)?.color ?? null;
	const backgroundCandidate =
		detectedBackground ?? { r: 255, g: 255, b: 255, a: 0 };

	const totalPixels = Math.max(1, imageData.width * imageData.height);
	const foregroundCandidates = ranked
		.filter((entry) => {
			if (entry.count / totalPixels < 0.003) {
				return false;
			}
			if (!detectedBackground) {
				return true;
			}
			return colorDistance(entry.color, backgroundCandidate) > 18;
		})
		.slice(0, Math.max(1, maxColors * 2))
		.map((entry) => entry.color);

	const merged = mergeNearbyColors(foregroundCandidates, 28).slice(0, Math.max(1, maxColors - 1));
	const monochromeSamples = ranked
		.filter((entry) => luminance(entry.color) < luminance(backgroundCandidate) - 24)
		.slice(0, 8)
		.map((entry) => entry.color);
	const monochromeInk =
		monochromeSamples.length > 0 ? averageColor(monochromeSamples) : null;

	return {
		palette: [backgroundCandidate, ...merged],
		background: backgroundCandidate,
		monochromeInk,
	};
}

function assignPaletteIndices(imageData: ImageData, palette: RgbaColor[], background: RgbaColor) {
	const indices = new Uint8Array(imageData.width * imageData.height);
	let darkPixelCount = 0;
	let saturatedPixelCount = 0;

	for (let index = 0; index < indices.length; index += 1) {
		const offset = index * 4;
		const color = {
			r: imageData.data[offset],
			g: imageData.data[offset + 1],
			b: imageData.data[offset + 2],
			a: imageData.data[offset + 3],
		};
		if (color.a < 16) {
			indices[index] = 0;
			continue;
		}
		if (luminance(color) < luminance(background) - 22) {
			darkPixelCount += 1;
		}
		if (saturation(color) > 28) {
			saturatedPixelCount += 1;
		}

		let bestIndex = 0;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (let paletteIndex = 0; paletteIndex < palette.length; paletteIndex += 1) {
			const candidate = palette[paletteIndex];
			const distance = colorDistance(color, candidate);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestIndex = paletteIndex;
			}
		}
		indices[index] = bestIndex;
	}

	return {
		indices,
		isMostlyMonochrome:
			saturatedPixelCount / Math.max(1, indices.length) < 0.06 &&
			darkPixelCount / Math.max(1, indices.length) > 0.01,
	};
}

function smoothMask(mask: Uint8Array, width: number, height: number) {
	if (width < 6 || height < 6) {
		return new Uint8Array(mask);
	}
	const next = new Uint8Array(mask);
	for (let y = 1; y < height - 1; y += 1) {
		for (let x = 1; x < width - 1; x += 1) {
			let total = 0;
			for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
				for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
					total += mask[(y + offsetY) * width + (x + offsetX)] ?? 0;
				}
			}
			next[y * width + x] = total >= 5 ? 1 : 0;
		}
	}
	return next;
}

function buildMonochromeMask(
	imageData: ImageData,
	background: RgbaColor,
) {
	const mask = new Uint8Array(imageData.width * imageData.height);
	const threshold = luminance(background) - 20;
	for (let index = 0; index < mask.length; index += 1) {
		const offset = index * 4;
		const color = {
			r: imageData.data[offset],
			g: imageData.data[offset + 1],
			b: imageData.data[offset + 2],
			a: imageData.data[offset + 3],
		};
		mask[index] =
			color.a >= 16 && luminance(color) <= threshold ? 1 : 0;
	}
	return smoothMask(mask, imageData.width, imageData.height);
}

function buildColorMask(indices: Uint8Array, width: number, height: number, targetIndex: number) {
	const mask = new Uint8Array(width * height);
	for (let index = 0; index < mask.length; index += 1) {
		mask[index] = indices[index] === targetIndex ? 1 : 0;
	}
	return smoothMask(mask, width, height);
}

function pruneMaskComponents(
	mask: Uint8Array,
	width: number,
	height: number,
	options?: VectorizeRasterOptions,
) {
	const next = new Uint8Array(mask);
	const visited = new Uint8Array(mask.length);
	const totalPixels = Math.max(1, width * height);
	const minKeepArea =
		totalPixels <= 256 ? 1 : totalPixels <= 4096 ? 2 : Math.max(4, Math.round(totalPixels * 0.00035));
	const signatureSuppressionEnabled =
		(options?.suppressBottomSignature ?? DEFAULT_OPTIONS.suppressBottomSignature)
		&& width >= 10
		&& height >= 10;

	for (let index = 0; index < mask.length; index += 1) {
		if (mask[index] !== 1 || visited[index] === 1) {
			continue;
		}

		const queue = [index];
		const component: number[] = [];
		visited[index] = 1;
		let minX = width;
		let maxX = 0;
		let minY = height;
		let maxY = 0;
		let sumY = 0;

		while (queue.length > 0) {
			const current = queue.pop() ?? 0;
			component.push(current);
			const x = current % width;
			const y = Math.floor(current / width);
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
			sumY += y;

			const neighbors = [
				current - 1,
				current + 1,
				current - width,
				current + width,
			];
			for (const neighbor of neighbors) {
				if (
					neighbor < 0 ||
					neighbor >= mask.length ||
					visited[neighbor] === 1 ||
					mask[neighbor] !== 1
				) {
					continue;
				}
				const currentX = current % width;
				const neighborX = neighbor % width;
				if (Math.abs(currentX - neighborX) > 1) {
					continue;
				}
				visited[neighbor] = 1;
				queue.push(neighbor);
			}
		}

		const area = component.length;
		const bboxWidth = maxX - minX + 1;
		const bboxHeight = maxY - minY + 1;
		const centroidY = sumY / Math.max(1, area);
		const isTinyNoise = area < minKeepArea;
		const isLikelySignature =
			signatureSuppressionEnabled &&
			centroidY >= Math.max(height * 0.88, height - 2.5) &&
			bboxHeight <= Math.max(2, height * 0.08) &&
			area <= Math.max(6, totalPixels * 0.0035) &&
			bboxWidth <= Math.max(4, width * 0.22);

		if (!isTinyNoise && !isLikelySignature) {
			continue;
		}

		for (const pixelIndex of component) {
			next[pixelIndex] = 0;
		}
	}

	return next;
}

function traceMaskContours(mask: Uint8Array, width: number, height: number) {
	const segments: Array<{ start: SvgPoint; end: SvgPoint }> = [];
	const inside = (x: number, y: number) =>
		x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] === 1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			if (!inside(x, y)) {
				continue;
			}
			if (!inside(x, y - 1)) {
				segments.push({
					start: { x, y },
					end: { x: x + 1, y },
				});
			}
			if (!inside(x + 1, y)) {
				segments.push({
					start: { x: x + 1, y },
					end: { x: x + 1, y: y + 1 },
				});
			}
			if (!inside(x, y + 1)) {
				segments.push({
					start: { x: x + 1, y: y + 1 },
					end: { x, y: y + 1 },
				});
			}
			if (!inside(x - 1, y)) {
				segments.push({
					start: { x, y: y + 1 },
					end: { x, y },
				});
			}
		}
	}

	const outgoing = new Map<string, number[]>();
	for (let index = 0; index < segments.length; index += 1) {
		const key = pointKey(segments[index].start);
		const entries = outgoing.get(key);
		if (entries) {
			entries.push(index);
		} else {
			outgoing.set(key, [index]);
		}
	}

	const used = new Array(segments.length).fill(false);
	const loops: SvgPoint[][] = [];

	for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
		if (used[segmentIndex]) {
			continue;
		}
		const loop: SvgPoint[] = [segments[segmentIndex].start];
		let currentIndex = segmentIndex;
		used[currentIndex] = true;

		while (true) {
			const current = segments[currentIndex];
			loop.push(current.end);
			if (pointKey(current.end) === pointKey(loop[0])) {
				break;
			}
			const nextCandidates = outgoing.get(pointKey(current.end)) ?? [];
			const nextIndex = nextCandidates.find((candidate) => !used[candidate]);
			if (nextIndex === undefined) {
				break;
			}
			used[nextIndex] = true;
			currentIndex = nextIndex;
		}

		if (
			loop.length >= 4 &&
			pointKey(loop[0]) === pointKey(loop[loop.length - 1])
		) {
			loops.push(loop);
		}
	}

	return loops;
}

function thinMask(mask: Uint8Array, width: number, height: number) {
	if (width < 3 || height < 3) {
		return new Uint8Array(mask);
	}

	const next = new Uint8Array(mask);
	const neighborOffsets = [
		[0, -1],
		[1, -1],
		[1, 0],
		[1, 1],
		[0, 1],
		[-1, 1],
		[-1, 0],
		[-1, -1],
	] as const;
	let changed = true;

	const getNeighborValues = (x: number, y: number) =>
		neighborOffsets.map(([offsetX, offsetY]) => next[(y + offsetY) * width + (x + offsetX)] ?? 0);

	while (changed) {
		changed = false;

		for (const phase of [0, 1] as const) {
			const toRemove: number[] = [];
			for (let y = 1; y < height - 1; y += 1) {
				for (let x = 1; x < width - 1; x += 1) {
					const index = y * width + x;
					if (next[index] !== 1) {
						continue;
					}

					const neighbors = getNeighborValues(x, y);
					const occupied = neighbors.reduce((total, value) => total + value, 0);
					if (occupied < 2 || occupied > 6) {
						continue;
					}

					let transitions = 0;
					for (let neighborIndex = 0; neighborIndex < neighbors.length; neighborIndex += 1) {
						const current = neighbors[neighborIndex];
						const following = neighbors[(neighborIndex + 1) % neighbors.length];
						if (current === 0 && following === 1) {
							transitions += 1;
						}
					}
					if (transitions !== 1) {
						continue;
					}

					const [p2, p3, p4, p5, p6, p7, p8, p9] = neighbors;
					const phaseMatches =
						phase === 0
							? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0
							: p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0;
					if (!phaseMatches) {
						continue;
					}

					toRemove.push(index);
				}
			}

			if (toRemove.length > 0) {
				changed = true;
				for (const index of toRemove) {
					next[index] = 0;
				}
			}
		}
	}

	return next;
}

function traceSkeletonPaths(mask: Uint8Array, width: number, height: number): TracedStrokePath[] {
	const activeNeighborsCache = new Map<number, number[]>();
	const activeNeighbors = (index: number) => {
		const cached = activeNeighborsCache.get(index);
		if (cached) {
			return cached;
		}
		const x = index % width;
		const y = Math.floor(index / width);
		const neighbors: number[] = [];
		for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
			for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
				if (offsetX === 0 && offsetY === 0) {
					continue;
				}
				const nextX = x + offsetX;
				const nextY = y + offsetY;
				if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
					continue;
				}
				const neighbor = nextY * width + nextX;
				if (mask[neighbor] === 1) {
					neighbors.push(neighbor);
				}
			}
		}
		activeNeighborsCache.set(index, neighbors);
		return neighbors;
	};

	const edgeKey = (left: number, right: number) => (left < right ? `${left}:${right}` : `${right}:${left}`);
	const pointForIndex = (index: number): SvgPoint => ({
		x: (index % width) + 0.5,
		y: Math.floor(index / width) + 0.5,
	});
	const visitedEdges = new Set<string>();
	const paths: TracedStrokePath[] = [];

	for (let index = 0; index < mask.length; index += 1) {
		if (mask[index] !== 1) {
			continue;
		}
		const neighbors = activeNeighbors(index);
		if (neighbors.length === 0 || neighbors.length === 2) {
			continue;
		}
		for (const neighbor of neighbors) {
			const initialEdgeKey = edgeKey(index, neighbor);
			if (visitedEdges.has(initialEdgeKey)) {
				continue;
			}
			visitedEdges.add(initialEdgeKey);
			const points = [pointForIndex(index)];
			let previous = index;
			let current = neighbor;

			while (true) {
				points.push(pointForIndex(current));
				const currentNeighbors = activeNeighbors(current);
				if (currentNeighbors.length !== 2) {
					break;
				}

				const nextCandidate = currentNeighbors.find((candidate) => candidate !== previous);
				if (nextCandidate === undefined) {
					break;
				}

				const nextEdgeKey = edgeKey(current, nextCandidate);
				if (visitedEdges.has(nextEdgeKey)) {
					break;
				}

				visitedEdges.add(nextEdgeKey);
				previous = current;
				current = nextCandidate;
			}

			if (points.length >= 2) {
				paths.push({ points, closed: false });
			}
		}
	}

	for (let index = 0; index < mask.length; index += 1) {
		if (mask[index] !== 1) {
			continue;
		}
		const neighbors = activeNeighbors(index);
		if (neighbors.length !== 2) {
			continue;
		}

		const initialNeighbor = neighbors[0];
		const initialEdgeKey = edgeKey(index, initialNeighbor);
		if (visitedEdges.has(initialEdgeKey)) {
			continue;
		}

		visitedEdges.add(initialEdgeKey);
		const points = [pointForIndex(index)];
		let previous = index;
		let current = initialNeighbor;
		let closed = false;

		while (true) {
			points.push(pointForIndex(current));
			const currentNeighbors = activeNeighbors(current);
			const nextCandidate = currentNeighbors.find((candidate) => candidate !== previous);
			if (nextCandidate === undefined) {
				break;
			}
			if (nextCandidate === index) {
				points.push(pointForIndex(index));
				closed = true;
				break;
			}

			const nextEdgeKey = edgeKey(current, nextCandidate);
			if (visitedEdges.has(nextEdgeKey)) {
				break;
			}

			visitedEdges.add(nextEdgeKey);
			previous = current;
			current = nextCandidate;
		}

		if (points.length >= 3) {
			paths.push({ points, closed });
		}
	}

	return paths;
}

function simplifyLoop(points: SvgPoint[], scaleX: number, scaleY: number) {
	const scaled = points.map((point) => ({
		x: point.x * scaleX,
		y: point.y * scaleY,
	}));
	const simplified = simplifyPoints(
		scaled,
		Math.max(0.75, Math.min(scaleX, scaleY) * 0.85),
	);
	return simplified.length >= 3 ? simplified : scaled;
}

function polygonPath(points: SvgPoint[]) {
	return `M ${points
		.map((point) => `${Math.round(point.x * 100) / 100} ${Math.round(point.y * 100) / 100}`)
		.join(' L ')} Z`;
}

function openPolylinePath(points: SvgPoint[]) {
	return `M ${points
		.map((point) => `${Math.round(point.x * 100) / 100} ${Math.round(point.y * 100) / 100}`)
		.join(' L ')}`;
}

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

function renderImageToCanvas(image: HTMLImageElement, options?: VectorizeRasterOptions) {
	const maxSampleDimension = options?.maxSampleDimension ?? DEFAULT_OPTIONS.maxSampleDimension;
	const scale = Math.min(1, maxSampleDimension / Math.max(image.naturalWidth, image.naturalHeight, 1));
	const width = Math.max(1, Math.round(image.naturalWidth * scale));
	const height = Math.max(1, Math.round(image.naturalHeight * scale));
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) {
		throw new Error('Canvas 2D context is unavailable for vectorization.');
	}
	context.drawImage(image, 0, 0, width, height);
	return {
		width,
		height,
		imageData: context.getImageData(0, 0, width, height),
	};
}

export function vectorizeImageDataToSvg(
	imageData: ImageData,
	options?: VectorizeRasterOptions,
) {
	const { palette, background, monochromeInk } = buildPalette(imageData, options);
	const { indices, isMostlyMonochrome } = assignPaletteIndices(imageData, palette, background);
	const layers: TraceLayer[] = [];

	if (isMostlyMonochrome) {
		const prunedMask = pruneMaskComponents(
			buildMonochromeMask(imageData, background),
			imageData.width,
			imageData.height,
			options,
		);
		const mask = thinMask(prunedMask, imageData.width, imageData.height);
		let strokePaths = traceSkeletonPaths(mask, imageData.width, imageData.height)
			.map((path) => ({
				...path,
				points: simplifyLoop(path.points, 1, 1),
			}))
			.filter((path) => path.points.length >= 2)
			.filter((path) => {
				let totalLength = 0;
				for (let index = 0; index < path.points.length - 1; index += 1) {
					const current = path.points[index];
					const next = path.points[index + 1];
					totalLength += Math.hypot(next.x - current.x, next.y - current.y);
				}
				return totalLength >= 3;
			})
			.sort((left, right) => right.points.length - left.points.length);
		if (strokePaths.length === 0) {
			strokePaths = traceMaskContours(prunedMask, imageData.width, imageData.height)
				.map((loop) => ({
					points: simplifyLoop(loop, 1, 1),
					closed: true,
				}))
				.filter((path) => path.points.length >= 3)
				.filter((path) => Math.abs(computeSignedArea(path.points)) >= 1);
		}
		if (strokePaths.length === 0) {
			throw new Error('No vectorizable stroke paths were detected in this sketch.');
		}
		const strokeColor = colorToHex(monochromeInk ?? { r: 34, g: 34, b: 34, a: 255 });
		const paths = strokePaths
			.map((path) => {
				const d = path.closed ? polygonPath(path.points) : openPolylinePath(path.points);
				return `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="1.6" />`;
			})
			.join('\n');

		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${imageData.width} ${imageData.height}">
${paths}
</svg>`;
	} else {
		for (let paletteIndex = 1; paletteIndex < palette.length; paletteIndex += 1) {
			const mask = pruneMaskComponents(
				buildColorMask(indices, imageData.width, imageData.height, paletteIndex),
				imageData.width,
				imageData.height,
				options,
			);
			const loops = traceMaskContours(mask, imageData.width, imageData.height);
			const paths = loops
				.map((loop) => simplifyLoop(loop, 1, 1))
				.filter((loop) => Math.abs(computeSignedArea(loop)) >= 3)
				.sort((left, right) => Math.abs(computeSignedArea(right)) - Math.abs(computeSignedArea(left)))
				.map((loop) => polygonPath(loop));
			if (paths.length === 0) {
				continue;
			}
			layers.push({
				fill: colorToHex(palette[paletteIndex]),
				paths,
				order: paletteIndex,
			});
		}
	}

	if (layers.length === 0) {
		throw new Error('No vectorizable regions were detected in this image.');
	}

	const paths = layers
		.sort((left, right) => left.order - right.order)
		.flatMap((layer) =>
			layer.paths.map(
				(path) => `<path d="${path}" fill="${layer.fill}" stroke="transparent" />`,
			),
		)
		.join('\n');

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${imageData.width} ${imageData.height}">
${paths}
</svg>`;
}

export async function vectorizeRasterBlobToSvg(
	blob: Blob,
	options?: VectorizeRasterOptions,
) {
	const image = await loadImageFromBlob(blob);
	const rendered = renderImageToCanvas(image, options);
	return vectorizeImageDataToSvg(rendered.imageData, options);
}
