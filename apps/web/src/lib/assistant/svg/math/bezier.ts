import type { SvgPoint } from './points';

const SAMPLE_LENGTH = 8;
const MIN_CURVE_SEGMENTS = 6;
const MAX_CURVE_SEGMENTS = 48;

export function cubicBezierPoint(
	p0: SvgPoint,
	p1: SvgPoint,
	p2: SvgPoint,
	p3: SvgPoint,
	t: number,
): SvgPoint {
	const mt = 1 - t;
	const mt2 = mt * mt;
	const t2 = t * t;
	return {
		x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
		y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
	};
}

export function quadraticBezierPoint(
	p0: SvgPoint,
	p1: SvgPoint,
	p2: SvgPoint,
	t: number,
): SvgPoint {
	const mt = 1 - t;
	return {
		x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
		y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
	};
}

export function estimateCurveSegments(length: number, scale: number) {
	return Math.max(
		MIN_CURVE_SEGMENTS,
		Math.min(MAX_CURVE_SEGMENTS, Math.ceil((length * scale) / SAMPLE_LENGTH)),
	);
}

export function addPoint(points: SvgPoint[], point: SvgPoint) {
	const last = points[points.length - 1];
	if (!last || Math.abs(last.x - point.x) > 0.01 || Math.abs(last.y - point.y) > 0.01) {
		points.push(point);
	}
}

export function reflect(point: SvgPoint, around: SvgPoint): SvgPoint {
	return {
		x: 2 * around.x - point.x,
		y: 2 * around.y - point.y,
	};
}

export function arcToCenterParameters(
	start: SvgPoint,
	end: SvgPoint,
	rx: number,
	ry: number,
	rotation: number,
	largeArcFlag: number,
	sweepFlag: number,
) {
	if (rx === 0 || ry === 0) {
		return null;
	}

	const phi = (rotation * Math.PI) / 180;
	const cosPhi = Math.cos(phi);
	const sinPhi = Math.sin(phi);
	const dx = (start.x - end.x) / 2;
	const dy = (start.y - end.y) / 2;
	const x1p = cosPhi * dx + sinPhi * dy;
	const y1p = -sinPhi * dx + cosPhi * dy;

	let adjustedRx = Math.abs(rx);
	let adjustedRy = Math.abs(ry);
	const lambda = (x1p * x1p) / (adjustedRx * adjustedRx) + (y1p * y1p) / (adjustedRy * adjustedRy);
	if (lambda > 1) {
		const scale = Math.sqrt(lambda);
		adjustedRx *= scale;
		adjustedRy *= scale;
	}

	const rxSq = adjustedRx * adjustedRx;
	const rySq = adjustedRy * adjustedRy;
	const x1pSq = x1p * x1p;
	const y1pSq = y1p * y1p;
	const sign = largeArcFlag === sweepFlag ? -1 : 1;
	const numerator = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
	const denominator = rxSq * y1pSq + rySq * x1pSq;
	const coef = sign * Math.sqrt(Math.max(0, numerator / Math.max(denominator, Number.EPSILON)));
	const cxp = (coef * adjustedRx * y1p) / adjustedRy;
	const cyp = (-coef * adjustedRy * x1p) / adjustedRx;
	const cx = cosPhi * cxp - sinPhi * cyp + (start.x + end.x) / 2;
	const cy = sinPhi * cxp + cosPhi * cyp + (start.y + end.y) / 2;

	const angleBetween = (u: SvgPoint, v: SvgPoint) => {
		const dot = u.x * v.x + u.y * v.y;
		const mag = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
		const ratio = Math.min(1, Math.max(-1, dot / Math.max(mag, Number.EPSILON)));
		const direction = u.x * v.y - u.y * v.x < 0 ? -1 : 1;
		return direction * Math.acos(ratio);
	};

	const startVector = { x: (x1p - cxp) / adjustedRx, y: (y1p - cyp) / adjustedRy };
	const endVector = { x: (-x1p - cxp) / adjustedRx, y: (-y1p - cyp) / adjustedRy };
	let deltaAngle = angleBetween(startVector, endVector);
	if (!sweepFlag && deltaAngle > 0) {
		deltaAngle -= Math.PI * 2;
	} else if (sweepFlag && deltaAngle < 0) {
		deltaAngle += Math.PI * 2;
	}

	return {
		cx,
		cy,
		rx: adjustedRx,
		ry: adjustedRy,
		phi,
		startAngle: angleBetween({ x: 1, y: 0 }, startVector),
		deltaAngle,
	};
}
