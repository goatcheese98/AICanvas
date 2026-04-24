import { estimateCurveSegments } from '../math/bezier';
import type { SvgPoint } from '../math/types';

export function createRectanglePoints(x: number, y: number, width: number, height: number) {
	return [
		{ x, y },
		{ x: x + width, y },
		{ x: x + width, y: y + height },
		{ x, y: y + height },
		{ x, y },
	];
}

export function createEllipsePoints(cx: number, cy: number, rx: number, ry: number, scale = 1) {
	const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
	const segments = Math.max(16, Math.min(64, estimateCurveSegments(perimeter, scale)));
	const points: SvgPoint[] = [];
	for (let i = 0; i <= segments; i += 1) {
		const angle = (Math.PI * 2 * i) / segments;
		points.push({
			x: cx + Math.cos(angle) * rx,
			y: cy + Math.sin(angle) * ry,
		});
	}
	return points;
}
