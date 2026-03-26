import { CONTAINMENT_MARGIN, MAX_CHAIKIN_ITERATIONS } from '../config.js';
import type { Point, PolygonElementCandidate, RGB } from '../types.js';

/** Check if two points are equal */
function pointEquals(a: Point, b: Point): boolean {
	return a[0] === b[0] && a[1] === b[1];
}

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Calculate perpendicular distance from a point to a line segment */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
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

/**
 * Ramer-Douglas-Peucker algorithm for polyline simplification
 *
 * @param points - Array of points to simplify
 * @param epsilon - Distance threshold for point removal
 * @returns Simplified array of points
 */
export function rdp(points: Point[], epsilon: number): Point[] {
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

/**
 * Simplify a closed polygon using RDP algorithm
 *
 * @param points - Closed polygon points (first and last should be equal)
 * @param epsilon - Distance threshold for point removal
 * @returns Simplified closed polygon or empty array if too few points
 */
export function simplifyClosedPolygon(points: Point[], epsilon: number): Point[] {
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

/**
 * Apply Chaikin smoothing to a closed polygon
 *
 * @param points - Closed polygon points
 * @param iterations - Number of smoothing iterations
 * @returns Smoothed closed polygon
 */
export function chaikinSmoothClosed(points: Point[], iterations = 1): Point[] {
	if (points.length < 4 || iterations <= 0) {
		return points;
	}

	let ring = pointEquals(points[0], points[points.length - 1]) ? points.slice(0, -1) : [...points];
	if (ring.length < 3) {
		return points;
	}

	for (let iteration = 0; iteration < iterations; iteration += 1) {
		const next: Point[] = [];
		for (let index = 0; index < ring.length; index += 1) {
			const pointA = ring[index];
			const pointB = ring[(index + 1) % ring.length];
			next.push(
				[pointA[0] * 0.75 + pointB[0] * 0.25, pointA[1] * 0.75 + pointB[1] * 0.25],
				[pointA[0] * 0.25 + pointB[0] * 0.75, pointA[1] * 0.25 + pointB[1] * 0.75],
			);
		}
		ring = next;
		if (ring.length > MAX_CHAIKIN_ITERATIONS) {
			break;
		}
	}

	if (!pointEquals(ring[0], ring[ring.length - 1])) {
		ring.push(ring[0]);
	}
	return ring;
}

/** Calculate brightness of an RGB color */
function brightness(color: RGB): number {
	return color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
}

/**
 * Calculate containment depth for each candidate polygon.
 * Higher score = more deeply nested = should render later (on top).
 */
function calculateContainmentDepths(
	candidates: PolygonElementCandidate[],
): Map<PolygonElementCandidate, number> {
	const depths = new Map<PolygonElementCandidate, number>();

	for (const candidate of candidates) {
		let depth = 0;
		const { minX, minY, maxX, maxY } = candidate.bbox;

		for (const other of candidates) {
			if (other === candidate) continue;

			// Use margin so boundaries resting against edges are still "contained"
			if (
				minX >= other.bbox.minX - CONTAINMENT_MARGIN &&
				maxX <= other.bbox.maxX + CONTAINMENT_MARGIN &&
				minY >= other.bbox.minY - CONTAINMENT_MARGIN &&
				maxY <= other.bbox.maxY + CONTAINMENT_MARGIN
			) {
				depth++;
			}
		}

		depths.set(candidate, depth);
	}

	return depths;
}

/**
 * Sort candidates by render order:
 * 1. Containment depth ascending (outer elements first)
 * 2. Area descending (larger elements first)
 *
 * @param candidates - Array of polygon element candidates
 * @returns Sorted array (input is not mutated)
 */
export function sortByRenderOrder(
	candidates: PolygonElementCandidate[],
): PolygonElementCandidate[] {
	const depths = calculateContainmentDepths(candidates);

	return [...candidates].sort((left, right) => {
		// 1. Containment depth: outer layers (depth 0) draw before inner layers
		const depthLeft = depths.get(left) ?? 0;
		const depthRight = depths.get(right) ?? 0;
		if (depthLeft !== depthRight) return depthLeft - depthRight;

		// 2. Pixel area: larger elements draw before smaller details
		return right.area - left.area;
	});
}
