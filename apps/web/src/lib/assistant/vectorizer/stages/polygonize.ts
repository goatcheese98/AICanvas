import { STYLE_ROUGHNESS } from '../config.js';
import type { BoundaryEdge, Component, Point, PolygonElementCandidate, RGB } from '../types.js';
import type { SketchVectorControls } from '../types.js';

/** Check if two points are equal */
function pointEquals(a: Point, b: Point): boolean {
	return a[0] === b[0] && a[1] === b[1];
}

/** Create a unique key for a point */
function edgeKey(point: Point): string {
	return `${point[0]},${point[1]}`;
}

/** Calculate the signed area of a polygon */
function polygonArea(points: Point[]): number {
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

/** Build boundary loops from a component using edge following */
export function buildBoundaryLoops(
	component: Component,
	mask: Uint8Array,
	width: number,
	height: number,
): Point[][] {
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

	function takeUnusedEdge(start: Point): number | null {
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

/** Select the largest loop (by area) from a set of loops */
export function selectLargestLoop(loops: Point[][]): { loop: Point[]; area: number } | null {
	if (loops.length === 0) {
		return null;
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

	return { loop: chosenLoop, area: chosenArea };
}

/** Convert RGB to hex color string */
function rgbToHex(color: RGB): string {
	const toHex = (value: number) => value.toString(16).padStart(2, '0');
	return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Create a polygon element skeleton from boundary points
 *
 * @param polygon - Closed polygon points
 * @param color - Fill color for the polygon
 * @param area - Pixel area of the component
 * @param controls - User control parameters
 * @param customData - Custom data to attach to element
 * @param groupId - Group identifier for element grouping
 * @param layerIndex - Layer index for z-ordering
 * @param label - Color label index
 * @param overrides - Optional style overrides
 * @returns Polygon element candidate or null if invalid
 */
export function createPolygonSkeleton(
	polygon: Point[],
	color: RGB,
	area: number,
	controls: SketchVectorControls,
	customData: Record<string, unknown>,
	groupId: string,
	layerIndex: number,
	label: number,
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

	const originX = polygon[0][0];
	const originY = polygon[0][1];
	const normalizedPoints = polygon.map(([x, y]) => [x - originX, y - originY] as Point);
	if (!pointEquals(normalizedPoints[0], normalizedPoints[normalizedPoints.length - 1])) {
		normalizedPoints.push(normalizedPoints[0]);
	}

	const baseColor = rgbToHex(color);
	return {
		area,
		color,
		label,
		bbox: { minX, minY, maxX, maxY },
		polygon,
		skeleton: {
			type: 'line',
			x: Math.round(originX * 100) / 100,
			y: Math.round(originY * 100) / 100,
			points: normalizedPoints,
			strokeColor: overrides?.strokeColor ?? '#050505',
			backgroundColor: overrides?.backgroundColor ?? baseColor,
			fillStyle: 'solid',
			// Dark stroke centered on boundary — inward half hidden by fill, outward
			// half overwritten by adjacent solid-fill polygons. Eliminates seam gaps.
			strokeWidth: overrides?.strokeWidth ?? clamp(controls.edgeSensitivity / 12, 1.8, 3.5),
			strokeStyle: 'solid',
			roughness: overrides?.roughness ?? STYLE_ROUGHNESS[controls.style],
			opacity: 100,
			groupIds: [`${groupId}-layer-${layerIndex}`, groupId],
			customData,
		},
	};
}
