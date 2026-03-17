import { simplifyPoints, type SvgPoint } from './svg-path-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RgbaColor {
	r: number;
	g: number;
	b: number;
	a: number;
}

interface TraceLayer {
	fill: string;
	paths: string[];
	pixelCount: number;
}

interface TracedPath {
	points: SvgPoint[];
	closed: boolean;
}

interface VectorizeRasterOptions {
	maxSampleDimension?: number;
	maxColors?: number;
}

const DEFAULT_OPTIONS: Required<VectorizeRasterOptions> = {
	maxSampleDimension: 256,
	maxColors: 5,
};

// ─── Color utilities ──────────────────────────────────────────────────────────

function clampByte(v: number) {
	return Math.max(0, Math.min(255, Math.round(v)));
}

function colorToHex({ r, g, b }: RgbaColor) {
	return `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, '0')).join('')}`;
}

function luminance({ r, g, b }: RgbaColor) {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation({ r, g, b }: RgbaColor) {
	return Math.max(r, g, b) - Math.min(r, g, b);
}

function pointKey(p: SvgPoint) {
	return `${p.x},${p.y}`;
}

function computeSignedArea(points: SvgPoint[]) {
	let total = 0;
	for (let i = 0; i < points.length - 1; i += 1) {
		total += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
	}
	return total / 2;
}

function pathLength(points: SvgPoint[]) {
	let total = 0;
	for (let i = 0; i < points.length - 1; i += 1) {
		total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
	}
	return total;
}

// ─── Bilateral filter ─────────────────────────────────────────────────────────

/**
 * Edge-preserving smoothing: flattens color noise within flat regions while
 * keeping luminance boundaries sharp — critical for clean segmentation.
 */
function applyBilateralFilter(imageData: ImageData): ImageData {
	const { data, width, height } = imageData;
	const result = new Uint8ClampedArray(data);
	const SIGMA_COLOR2 = 2 * 40 * 40;
	const SIGMA_SPACE2 = 2 * 2 * 2;

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

			for (let dy = -1; dy <= 1; dy += 1) {
				for (let dx = -1; dx <= 1; dx += 1) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
					const ni = (ny * width + nx) * 4;
					const nr = data[ni];
					const ng = data[ni + 1];
					const nb = data[ni + 2];
					const w = Math.exp(
						-(dx * dx + dy * dy) / SIGMA_SPACE2 -
							((cr - nr) ** 2 + (cg - ng) ** 2 + (cb - nb) ** 2) / SIGMA_COLOR2,
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

// ─── K-Means++ quantization ───────────────────────────────────────────────────

/**
 * K-Means++ clustering: distance-proportional initialization and iterative
 * refinement produce more accurate color groupings than histogram binning,
 * especially on gradients and soft-edged AI-generated images.
 */
function kmeansQuantize(imageData: ImageData, k: number) {
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
			centers: [{ r: 255, g: 255, b: 255, a: 255 }] as RgbaColor[],
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
		centers = sums.map((s, j) =>
			s[3] > 0 ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[j],
		);
	}

	const colorCenters: RgbaColor[] = centers.map(([r, g, b]) => ({ r, g, b, a: 255 }));
	const labels = new Int32Array(n);
	for (let i = 0; i < n; i += 1) {
		const si = pixelToSample[i];
		if (si >= 0) labels[i] = sampleLabels[si];
	}

	return { centers: colorCenters, labels };
}

// ─── Morphological operations ─────────────────────────────────────────────────

function morphDilate(mask: Uint8Array, width: number, height: number): Uint8Array {
	const result = new Uint8Array(mask.length);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			if (mask[y * width + x]) {
				result[y * width + x] = 1;
				continue;
			}
			outer: for (let dy = -1; dy <= 1; dy += 1) {
				for (let dx = -1; dx <= 1; dx += 1) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
						result[y * width + x] = 1;
						break outer;
					}
				}
			}
		}
	}
	return result;
}

function morphErode(mask: Uint8Array, width: number, height: number): Uint8Array {
	const result = new Uint8Array(mask.length);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			if (!mask[y * width + x]) continue;
			let ok = true;
			outer: for (let dy = -1; dy <= 1; dy += 1) {
				for (let dx = -1; dx <= 1; dx += 1) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || nx >= width || ny < 0 || ny >= height || !mask[ny * width + nx]) {
						ok = false;
						break outer;
					}
				}
			}
			if (ok) result[y * width + x] = 1;
		}
	}
	return result;
}

// Fills small gaps within regions. Guards against tiny images where erosion removes everything.
function morphClose(mask: Uint8Array, width: number, height: number): Uint8Array {
	if (width < 5 || height < 5) return new Uint8Array(mask);
	return morphErode(morphDilate(mask, width, height), width, height);
}

// Removes isolated speckle noise. Guards against tiny images.
function morphOpen(mask: Uint8Array, width: number, height: number): Uint8Array {
	if (width < 5 || height < 5) return new Uint8Array(mask);
	return morphDilate(morphErode(mask, width, height), width, height);
}

// ─── Component pruning ────────────────────────────────────────────────────────

function pruneSmallComponents(
	mask: Uint8Array,
	width: number,
	_height: number,
	minArea: number,
): Uint8Array {
	const result = new Uint8Array(mask);
	const visited = new Uint8Array(mask.length);

	for (let start = 0; start < mask.length; start += 1) {
		if (!mask[start] || visited[start]) continue;

		const component: number[] = [];
		const queue = [start];
		visited[start] = 1;

		while (queue.length > 0) {
			const idx = queue.pop() ?? start;
			component.push(idx);
			const x = idx % width;
			const neighbors = [
				idx - width,
				idx + width,
				x > 0 ? idx - 1 : -1,
				x < width - 1 ? idx + 1 : -1,
			];
			for (const neighbor of neighbors) {
				if (neighbor >= 0 && neighbor < mask.length && !visited[neighbor] && mask[neighbor]) {
					visited[neighbor] = 1;
					queue.push(neighbor);
				}
			}
		}

		if (component.length < minArea) {
			for (const idx of component) result[idx] = 0;
		}
	}

	return result;
}

// ─── Dominant region extraction ───────────────────────────────────────────────

/**
 * Returns a mask containing only the single largest connected component.
 * Discards shadows, reflections, and disconnected anti-aliasing artifacts so
 * each color cluster produces exactly one dominant spatial shape.
 */
function largestComponent(mask: Uint8Array, width: number, _height: number): Uint8Array {
	const result = new Uint8Array(mask.length);
	const visited = new Uint8Array(mask.length);
	let best: number[] = [];

	for (let start = 0; start < mask.length; start += 1) {
		if (!mask[start] || visited[start]) continue;
		const component: number[] = [];
		const stack = [start];
		visited[start] = 1;
		while (stack.length > 0) {
			const idx = stack.pop() ?? start;
			component.push(idx);
			const x = idx % width;
			const neighbors = [
				idx - width,
				idx + width,
				x > 0 ? idx - 1 : -1,
				x < width - 1 ? idx + 1 : -1,
			];
			for (const n of neighbors) {
				if (n >= 0 && n < mask.length && !visited[n] && mask[n]) {
					visited[n] = 1;
					stack.push(n);
				}
			}
		}
		if (component.length > best.length) best = component;
	}

	for (const idx of best) result[idx] = 1;
	return result;
}

/**
 * Computes the convex hull of all set pixels in a mask using only
 * row-boundary candidates (leftmost + rightmost pixel per row).
 * Row-boundary pixels fully determine the convex hull — no interior pixel
 * can be a hull vertex — so this is both exact and O(height) in candidate count.
 */
function maskConvexHull(mask: Uint8Array, width: number, height: number): SvgPoint[] {
	const candidates: SvgPoint[] = [];
	for (let y = 0; y < height; y += 1) {
		let left = -1;
		let right = -1;
		for (let x = 0; x < width; x += 1) {
			if (mask[y * width + x]) {
				if (left < 0) left = x;
				right = x;
			}
		}
		if (left >= 0) {
			candidates.push({ x: left + 0.5, y: y + 0.5 });
			if (right !== left) candidates.push({ x: right + 0.5, y: y + 0.5 });
		}
	}
	if (candidates.length < 3) return candidates;

	// Graham scan
	let lo = 0;
	for (let i = 1; i < candidates.length; i += 1) {
		if (
			candidates[i].y > candidates[lo].y ||
			(candidates[i].y === candidates[lo].y && candidates[i].x < candidates[lo].x)
		) {
			lo = i;
		}
	}
	const pivot = candidates[lo];
	const rest = candidates.filter((_, i) => i !== lo).sort((a, b) => {
		const cross =
			(a.x - pivot.x) * (b.y - pivot.y) - (a.y - pivot.y) * (b.x - pivot.x);
		if (Math.abs(cross) > 1e-9) return cross > 0 ? -1 : 1;
		return (
			(a.x - pivot.x) ** 2 +
			(a.y - pivot.y) ** 2 -
			((b.x - pivot.x) ** 2 + (b.y - pivot.y) ** 2)
		);
	});
	const hull: SvgPoint[] = [pivot];
	for (const p of rest) {
		while (hull.length >= 2) {
			const a = hull[hull.length - 2];
			const b = hull[hull.length - 1];
			const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
			if (cross <= 0) hull.pop();
			else break;
		}
		hull.push(p);
	}
	return hull.length >= 3 ? hull : candidates;
}

// ─── Contour tracing (marching squares) ──────────────────────────────────────

function traceMaskContours(mask: Uint8Array, width: number, height: number): SvgPoint[][] {
	const segments: Array<{ start: SvgPoint; end: SvgPoint }> = [];
	const inside = (x: number, y: number) =>
		x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] === 1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			if (!inside(x, y)) continue;
			if (!inside(x, y - 1)) segments.push({ start: { x, y }, end: { x: x + 1, y } });
			if (!inside(x + 1, y)) segments.push({ start: { x: x + 1, y }, end: { x: x + 1, y: y + 1 } });
			if (!inside(x, y + 1)) segments.push({ start: { x: x + 1, y: y + 1 }, end: { x, y: y + 1 } });
			if (!inside(x - 1, y)) segments.push({ start: { x, y: y + 1 }, end: { x, y } });
		}
	}

	const outgoing = new Map<string, number[]>();
	for (let i = 0; i < segments.length; i += 1) {
		const key = pointKey(segments[i].start);
		const existing = outgoing.get(key);
		if (existing) {
			existing.push(i);
		} else {
			outgoing.set(key, [i]);
		}
	}

	const used = new Array(segments.length).fill(false);
	const loops: SvgPoint[][] = [];

	for (let si = 0; si < segments.length; si += 1) {
		if (used[si]) continue;
		const loop: SvgPoint[] = [segments[si].start];
		let curr = si;
		used[curr] = true;

		while (true) {
			const seg = segments[curr];
			loop.push(seg.end);
			if (pointKey(seg.end) === pointKey(loop[0])) break;
			const next = (outgoing.get(pointKey(seg.end)) ?? []).find((c) => !used[c]);
			if (next === undefined) break;
			used[next] = true;
			curr = next;
		}

		if (loop.length >= 4 && pointKey(loop[0]) === pointKey(loop[loop.length - 1])) {
			loops.push(loop);
		}
	}

	return loops;
}

// ─── Skeleton thinning (Zhang-Su) and path tracing ───────────────────────────

function thinMask(mask: Uint8Array, width: number, height: number): Uint8Array {
	if (width < 3 || height < 3) return new Uint8Array(mask);

	const next = new Uint8Array(mask);
	const offsets = [
		[0, -1], [1, -1], [1, 0], [1, 1],
		[0, 1], [-1, 1], [-1, 0], [-1, -1],
	] as const;
	let changed = true;

	const getNeighbors = (x: number, y: number) =>
		offsets.map(([ox, oy]) => next[(y + oy) * width + (x + ox)] ?? 0);

	while (changed) {
		changed = false;
		for (const phase of [0, 1] as const) {
			const toRemove: number[] = [];
			for (let y = 1; y < height - 1; y += 1) {
				for (let x = 1; x < width - 1; x += 1) {
					const idx = y * width + x;
					if (!next[idx]) continue;
					const nb = getNeighbors(x, y);
					const occupied = nb.reduce((t, v) => t + v, 0);
					if (occupied < 2 || occupied > 6) continue;
					let transitions = 0;
					for (let i = 0; i < nb.length; i += 1) {
						if (nb[i] === 0 && nb[(i + 1) % nb.length] === 1) transitions += 1;
					}
					if (transitions !== 1) continue;
					const [p2, , p4, , p6, , p8] = nb;
					const ok =
						phase === 0
							? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0
							: p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0;
					if (ok) toRemove.push(idx);
				}
			}
			if (toRemove.length > 0) {
				changed = true;
				for (const idx of toRemove) next[idx] = 0;
			}
		}
	}

	return next;
}

function traceSkeletonPaths(mask: Uint8Array, width: number, height: number): TracedPath[] {
	const neighborCache = new Map<number, number[]>();
	const activeNeighbors = (idx: number) => {
		const cached = neighborCache.get(idx);
		if (cached) return cached;
		const x = idx % width;
		const y = Math.floor(idx / width);
		const result: number[] = [];
		for (let oy = -1; oy <= 1; oy += 1) {
			for (let ox = -1; ox <= 1; ox += 1) {
				if (ox === 0 && oy === 0) continue;
				const nx = x + ox;
				const ny = y + oy;
				if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
					result.push(ny * width + nx);
				}
			}
		}
		neighborCache.set(idx, result);
		return result;
	};

	const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
	const toPoint = (idx: number): SvgPoint => ({
		x: (idx % width) + 0.5,
		y: Math.floor(idx / width) + 0.5,
	});
	const visitedEdges = new Set<string>();
	const paths: TracedPath[] = [];

	// Trace from junction and endpoint seeds
	for (let idx = 0; idx < mask.length; idx += 1) {
		if (!mask[idx]) continue;
		const neighbors = activeNeighbors(idx);
		if (neighbors.length === 0 || neighbors.length === 2) continue;
		for (const neighbor of neighbors) {
			const ek = edgeKey(idx, neighbor);
			if (visitedEdges.has(ek)) continue;
			visitedEdges.add(ek);
			const points = [toPoint(idx)];
			let prev = idx;
			let curr = neighbor;
			while (true) {
				points.push(toPoint(curr));
				const nb = activeNeighbors(curr);
				if (nb.length !== 2) break;
				const next = nb.find((n) => n !== prev);
				if (next === undefined) break;
				const nk = edgeKey(curr, next);
				if (visitedEdges.has(nk)) break;
				visitedEdges.add(nk);
				prev = curr;
				curr = next;
			}
			if (points.length >= 2) paths.push({ points, closed: false });
		}
	}

	// Trace isolated loops
	for (let idx = 0; idx < mask.length; idx += 1) {
		if (!mask[idx]) continue;
		const neighbors = activeNeighbors(idx);
		if (neighbors.length !== 2) continue;
		const ek = edgeKey(idx, neighbors[0]);
		if (visitedEdges.has(ek)) continue;
		visitedEdges.add(ek);
		const points = [toPoint(idx)];
		let prev = idx;
		let curr = neighbors[0];
		let closed = false;
		while (true) {
			points.push(toPoint(curr));
			const nb = activeNeighbors(curr);
			const next = nb.find((n) => n !== prev);
			if (next === undefined) break;
			if (next === idx) {
				closed = true;
				break;
			}
			const nk = edgeKey(curr, next);
			if (visitedEdges.has(nk)) break;
			visitedEdges.add(nk);
			prev = curr;
			curr = next;
		}
		if (points.length >= 3) paths.push({ points, closed });
	}

	return paths;
}

// ─── Path serialization ───────────────────────────────────────────────────────

function simplifyLoop(points: SvgPoint[], scaleX: number, scaleY: number) {
	const scaled = points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
	const simplified = simplifyPoints(scaled, Math.max(0.75, Math.min(scaleX, scaleY) * 0.85));
	return simplified.length >= 3 ? simplified : scaled;
}

function polygonPath(points: SvgPoint[]) {
	return `M ${points.map((p) => `${Math.round(p.x * 100) / 100} ${Math.round(p.y * 100) / 100}`).join(' L ')} Z`;
}

function openPolylinePath(points: SvgPoint[]) {
	return `M ${points.map((p) => `${Math.round(p.x * 100) / 100} ${Math.round(p.y * 100) / 100}`).join(' L ')}`;
}

// ─── Image loading ────────────────────────────────────────────────────────────

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
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('Canvas 2D context unavailable for vectorization.');
	// Composite onto white to handle transparency before pixel analysis
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, width, height);
	ctx.drawImage(image, 0, 0, width, height);
	return { width, height, imageData: ctx.getImageData(0, 0, width, height) };
}

// ─── Color cluster merging ────────────────────────────────────────────────────

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
		while (parent[x] !== x) {
			parent[x] = parent[parent[x]];
			x = parent[x];
		}
		return x;
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

// ─── Core vectorization ───────────────────────────────────────────────────────

export function vectorizeImageDataToSvg(
	imageData: ImageData,
	options?: VectorizeRasterOptions,
): string {
	const { width, height } = imageData;
	const maxColors = options?.maxColors ?? DEFAULT_OPTIONS.maxColors;

	// Bilateral filter: edge-preserving denoising before quantization
	const filtered = applyBilateralFilter(imageData);

	// K-Means++ quantization, then merge perceptually near-identical clusters.
	// A merge threshold of 30 RGB units collapses slight color variants (e.g.
	// a black bezel at #050505 and a near-black shadow at #1a1818) into one
	// region, naturally reducing element count without losing visible structure.
	const quantized = kmeansQuantize(filtered, maxColors);
	const { centers, labels } = mergeSimilarCenters(quantized.centers, quantized.labels, 30);

	// Background: lightest cluster with luminance > 220 (genuine light/white bg).
	// If none qualifies, bgIndex = -1 and all clusters become foreground.
	let bgIndex = -1;
	let bgLuminance = 255;
	for (let i = 0; i < centers.length; i += 1) {
		const lum = luminance(centers[i]);
		if (lum > 220 && (bgIndex === -1 || lum > bgLuminance)) {
			bgIndex = i;
			bgLuminance = lum;
		}
	}
	if (bgIndex === -1) {
		bgLuminance = Math.max(...centers.map(luminance));
	}

	// Monochrome detection: ALL foreground clusters must be genuinely achromatic
	// (saturation < 15) — this is true for scanned pen sketches but NOT for
	// colored digital renders like a tablet with a blue/gray screen.
	// The old threshold of 30 incorrectly classified tablet images as monochrome,
	// routing them through skeleton tracing and producing 80+ elements.
	const fgCenters = bgIndex >= 0 ? centers.filter((_, i) => i !== bgIndex) : centers;
	const isMostlyMonochrome =
		fgCenters.length > 0 &&
		fgCenters.every((c) => saturation(c) < 15) &&
		fgCenters.some((c) => luminance(c) < bgLuminance - 50);

	// Prune components smaller than ~0.4% of total pixels — aggressively removes
	// anti-aliasing fragments and JPEG noise at color boundaries.
	const minArea = Math.max(4, Math.round(width * height * 0.004));

	if (isMostlyMonochrome) {
		const rawMask = new Uint8Array(width * height);
		for (let i = 0; i < rawMask.length; i += 1) {
			if (labels[i] !== bgIndex && luminance(centers[labels[i]]) < bgLuminance - 30) {
				rawMask[i] = 1;
			}
		}

		// Morphological opening removes isolated noise without positional assumptions
		const opened = morphOpen(rawMask, width, height);
		const pruned = pruneSmallComponents(opened, width, height, minArea);
		const thinned = thinMask(pruned, width, height);

		// Cap at 20 paths to prevent element explosion on complex dark silhouettes.
		// Skeleton tracing of a rounded rectangle body can produce hundreds of tiny
		// segments; keeping the longest paths preserves the main structure.
		let paths: TracedPath[] = traceSkeletonPaths(thinned, width, height)
			.map((p) => ({ ...p, points: simplifyLoop(p.points, 1, 1) }))
			.filter((p) => p.points.length >= 2 && pathLength(p.points) >= 3)
			.sort((a, b) => b.points.length - a.points.length)
			.slice(0, 20);

		if (paths.length === 0) {
			paths = traceMaskContours(pruned, width, height)
				.map((loop) => ({ points: simplifyLoop(loop, 1, 1), closed: true }))
				.filter((p) => p.points.length >= 3 && Math.abs(computeSignedArea(p.points)) >= 1);
		}

		if (paths.length === 0) {
			throw new Error('No vectorizable stroke paths detected in this sketch.');
		}

		const inkColor = colorToHex(
			fgCenters.reduce((darkest, c) => (luminance(c) < luminance(darkest) ? c : darkest)),
		);

		const pathElems = paths
			.map((p) => {
				const d = p.closed ? polygonPath(p.points) : openPolylinePath(p.points);
				return `<path d="${d}" fill="none" stroke="${inkColor}" stroke-width="1.6" />`;
			})
			.join('\n');

		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n${pathElems}\n</svg>`;
	}

	// Pre-count pixels per cluster for painter's-algorithm layer ordering.
	// Larger regions (more pixels) are base/background fills → rendered first (behind).
	// Smaller regions are detail fills → rendered last (in front).
	const pixelCounts = new Array(centers.length).fill(0) as number[];
	for (let i = 0; i < labels.length; i += 1) pixelCounts[labels[i]]++;

	// Colored image: one fill layer per foreground cluster
	const layers: TraceLayer[] = [];

	for (let ci = 0; ci < centers.length; ci += 1) {
		if (ci === bgIndex) continue;

		const rawMask = new Uint8Array(width * height);
		for (let i = 0; i < rawMask.length; i += 1) rawMask[i] = labels[i] === ci ? 1 : 0;

		// Double morphClose closes 2-pixel gaps from anti-aliasing; then keep only
		// the single largest connected component to eliminate disconnected fragments.
		const closedMask = morphClose(morphClose(rawMask, width, height), width, height);
		const dominantMask = largestComponent(closedMask, width, height);

		let dominantPixels = 0;
		for (let i = 0; i < dominantMask.length; i += 1) dominantPixels += dominantMask[i];
		if (dominantPixels < minArea) continue;

		// Convex hull of dominant mask pixels → exactly one convex polygon per color.
		// Convex polygons are guaranteed safe for Rough.js and never go transparent.
		const hullPoints = maskConvexHull(dominantMask, width, height);
		if (hullPoints.length < 3) continue;

		const simplified = simplifyPoints(hullPoints, 0.5);
		if (simplified.length >= 3) {
			layers.push({ fill: colorToHex(centers[ci]), paths: [polygonPath(simplified)], pixelCount: dominantPixels });
		}
	}

	if (layers.length === 0) {
		throw new Error('No vectorizable regions detected in this image.');
	}

	// Painter's algorithm: largest region first (base/body fills render behind),
	// smallest region last (detail fills render in front). This correctly places a
	// large dark body behind a smaller lighter screen regardless of luminance.
	layers.sort((a, b) => b.pixelCount - a.pixelCount);

	const pathElems = layers
		.flatMap((layer) =>
			layer.paths.map((path) => `<path d="${path}" fill="${layer.fill}" stroke="transparent" />`),
		)
		.join('\n');

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n${pathElems}\n</svg>`;
}

export async function vectorizeRasterBlobToSvg(
	blob: Blob,
	options?: VectorizeRasterOptions,
): Promise<string> {
	const image = await loadImageFromBlob(blob);
	const { imageData } = renderImageToCanvas(image, options);
	return vectorizeImageDataToSvg(imageData, options);
}
