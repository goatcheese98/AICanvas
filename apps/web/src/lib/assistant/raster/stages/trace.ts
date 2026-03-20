import type { SvgPoint } from '../../svg-path-utils';
import type {
	TraceInput,
	TraceOutput,
	TracedPath,
	TraceLayer,
	RgbaColor,
} from '../types';
import { MORPHOLOGY, SKELETON, CONVEX_HULL, CONTOUR } from '../config';

// ─── Color Utilities ────────────────────────────────────────────────────────────

function colorToHex({ r, g, b }: RgbaColor): string {
	const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	return `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, '0')).join('')}`;
}

function luminance({ r, g, b }: RgbaColor): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pointKey(p: SvgPoint): string {
	return `${p.x},${p.y}`;
}

// ─── Morphological Operations ───────────────────────────────────────────────────

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

/** Fills small gaps within regions. Guards against tiny images where erosion removes everything. */
function morphClose(mask: Uint8Array, width: number, height: number): Uint8Array {
	if (width < MORPHOLOGY.MIN_DIMENSION || height < MORPHOLOGY.MIN_DIMENSION) {
		return new Uint8Array(mask);
	}
	return morphErode(morphDilate(mask, width, height), width, height);
}

/** Removes isolated speckle noise. Guards against tiny images. */
function morphOpen(mask: Uint8Array, width: number, height: number): Uint8Array {
	if (width < MORPHOLOGY.MIN_DIMENSION || height < MORPHOLOGY.MIN_DIMENSION) {
		return new Uint8Array(mask);
	}
	return morphDilate(morphErode(mask, width, height), width, height);
}

// ─── Component Pruning ──────────────────────────────────────────────────────────

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

// ─── Dominant Region Extraction ─────────────────────────────────────────────────

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

// ─── Convex Hull Computation ────────────────────────────────────────────────────

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
	if (candidates.length < CONVEX_HULL.MIN_POINTS) return candidates;

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
	const rest = candidates
		.filter((_, i) => i !== lo)
		.sort((a, b) => {
			const cross = (a.x - pivot.x) * (b.y - pivot.y) - (a.y - pivot.y) * (b.x - pivot.x);
			if (Math.abs(cross) > CONVEX_HULL.CROSS_TOLERANCE) return cross > 0 ? -1 : 1;
			return (
				(a.x - pivot.x) ** 2 + (a.y - pivot.y) ** 2 - ((b.x - pivot.x) ** 2 + (b.y - pivot.y) ** 2)
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
	return hull.length >= CONVEX_HULL.MIN_POINTS ? hull : candidates;
}

// ─── Contour Tracing (Marching Squares) ─────────────────────────────────────────

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

		if (loop.length >= CONTOUR.MIN_LOOP_LENGTH && pointKey(loop[0]) === pointKey(loop[loop.length - 1])) {
			loops.push(loop);
		}
	}

	return loops;
}

// ─── Skeleton Thinning (Zhang-Su) ───────────────────────────────────────────────

function thinMask(mask: Uint8Array, width: number, height: number): Uint8Array {
	if (width < SKELETON.MIN_DIMENSION || height < SKELETON.MIN_DIMENSION) {
		return new Uint8Array(mask);
	}

	const next = new Uint8Array(mask);
	const offsets = [
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

// ─── Monochrome Tracing ─────────────────────────────────────────────────────────

function traceMonochrome(
	width: number,
	height: number,
	labels: Int32Array,
	centers: RgbaColor[],
	bgIndex: number,
	bgLuminance: number,
	minArea: number,
): { paths: TracedPath[]; inkColor: string } {
	// Create foreground mask
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

	// Trace skeleton paths
	let paths: TracedPath[] = traceSkeletonPaths(thinned, width, height);

	// Fallback to contours if no skeleton paths found
	if (paths.length === 0) {
		const loops = traceMaskContours(pruned, width, height);
		paths = loops.map((loop) => ({ points: loop, closed: true }));
	}

	// Compute ink color (darkest foreground color)
	const fgCenters = bgIndex >= 0 ? centers.filter((_, i) => i !== bgIndex) : centers;
	const inkColor = colorToHex(
		fgCenters.reduce((darkest, c) => (luminance(c) < luminance(darkest) ? c : darkest)),
	);

	return { paths, inkColor };
}

// ─── Color Tracing ──────────────────────────────────────────────────────────────

function traceColor(
	width: number,
	height: number,
	labels: Int32Array,
	centers: RgbaColor[],
	bgIndex: number,
	minArea: number,
): TraceLayer[] {
	// Pre-count pixels per cluster for painter's-algorithm layer ordering.
	// Larger regions (more pixels) are base/background fills → rendered first (behind).
	// Smaller regions are detail fills → rendered last (in front).
	const pixelCounts = new Array(centers.length).fill(0) as number[];
	for (let i = 0; i < labels.length; i += 1) pixelCounts[labels[i]]++;

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

		layers.push({
			fill: colorToHex(centers[ci]),
			paths: [], // Will be filled by optimize stage
			pixelCount: dominantPixels,
			hullPoints,
		});
	}

	// Painter's algorithm: largest region first (base/body fills render behind),
	// smallest region last (detail fills render in front).
	layers.sort((a, b) => b.pixelCount - a.pixelCount);

	return layers;
}

// ─── Main Trace Function ────────────────────────────────────────────────────────

export function trace(input: TraceInput): TraceOutput {
	const { width, height, labels, centers, bgIndex, bgLuminance, isMonochrome, minArea } = input;

	if (isMonochrome) {
		const { paths, inkColor } = traceMonochrome(
			width,
			height,
			labels,
			centers,
			bgIndex,
			bgLuminance,
			minArea,
		);
		return {
			width,
			height,
			paths,
			layers: [],
			inkColor,
		};
	}

	// Colored image: one fill layer per foreground cluster
	const layers = traceColor(width, height, labels, centers, bgIndex, minArea);

	return {
		width,
		height,
		paths: [],
		layers,
	};
}
