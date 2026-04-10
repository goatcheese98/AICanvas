import type { SvgMatrix } from './matrices';
import { applySvgMatrix } from './matrices';

export interface SvgPoint {
	x: number;
	y: number;
}

export function distance(a: SvgPoint, b: SvgPoint): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function getPointBounds(points: SvgPoint[]) {
	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	return {
		left: Math.min(...xs),
		top: Math.min(...ys),
		right: Math.max(...xs),
		bottom: Math.max(...ys),
	};
}

export function simplifyPoints(points: SvgPoint[], tolerance: number): SvgPoint[] {
	if (points.length <= 2 || tolerance <= 0) {
		return [...points];
	}

	const sqTolerance = tolerance * tolerance;

	const getSqSegmentDistance = (point: SvgPoint, start: SvgPoint, end: SvgPoint) => {
		let x = start.x;
		let y = start.y;
		let dx = end.x - x;
		let dy = end.y - y;

		if (dx !== 0 || dy !== 0) {
			const t = ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy);
			if (t > 1) {
				x = end.x;
				y = end.y;
			} else if (t > 0) {
				x += dx * t;
				y += dy * t;
			}
		}

		dx = point.x - x;
		dy = point.y - y;
		return dx * dx + dy * dy;
	};

	const simplifyDPStep = (input: SvgPoint[], first: number, last: number, result: SvgPoint[]) => {
		let maxSqDistance = sqTolerance;
		let index = 0;

		for (let i = first + 1; i < last; i += 1) {
			const sqDistance = getSqSegmentDistance(input[i], input[first], input[last]);
			if (sqDistance > maxSqDistance) {
				index = i;
				maxSqDistance = sqDistance;
			}
		}

		if (maxSqDistance > sqTolerance) {
			if (index - first > 1) {
				simplifyDPStep(input, first, index, result);
			}
			result.push(input[index]);
			if (last - index > 1) {
				simplifyDPStep(input, index, last, result);
			}
		}
	};

	const simplified = [points[0]];
	simplifyDPStep(points, 0, points.length - 1, simplified);
	simplified.push(points[points.length - 1]);
	return simplified;
}

export function distributePoints(points: SvgPoint[], maxPoints: number) {
	if (points.length <= maxPoints) {
		return points;
	}

	const step = (points.length - 1) / Math.max(1, maxPoints - 1);
	const sampled: SvgPoint[] = [];
	for (let index = 0; index < maxPoints; index += 1) {
		const position = step * index;
		const lower = Math.floor(position);
		const upper = Math.min(points.length - 1, Math.ceil(position));
		const t = position - lower;
		const start = points[lower];
		const end = points[upper];
		sampled.push({
			x: lerp(start.x, end.x, t),
			y: lerp(start.y, end.y, t),
		});
	}
	return sampled;
}

export function transformPointCloud(points: SvgPoint[], matrix: SvgMatrix) {
	return points.map((point) => applySvgMatrix(point, matrix));
}

function scalePointCloud(points: SvgPoint[], scale: number) {
	return points.map((point) => ({
		x: point.x * scale,
		y: point.y * scale,
	}));
}
