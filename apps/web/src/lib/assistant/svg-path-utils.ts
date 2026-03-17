export interface SvgPoint {
	x: number;
	y: number;
}

export interface SvgPathContour {
	points: SvgPoint[];
	closed: boolean;
}

export type SvgMatrix = [number, number, number, number, number, number];

const COMMAND_RE = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;
const SAMPLE_LENGTH = 8;
const MIN_CURVE_SEGMENTS = 6;
const MAX_CURVE_SEGMENTS = 48;

export const IDENTITY_MATRIX: SvgMatrix = [1, 0, 0, 1, 0, 0];

function distance(a: SvgPoint, b: SvgPoint) {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

function cubicBezierPoint(
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

function quadraticBezierPoint(
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

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

function estimateCurveSegments(length: number, scale: number) {
	return Math.max(
		MIN_CURVE_SEGMENTS,
		Math.min(MAX_CURVE_SEGMENTS, Math.ceil((length * scale) / SAMPLE_LENGTH)),
	);
}

function addPoint(points: SvgPoint[], point: SvgPoint) {
	const last = points[points.length - 1];
	if (!last || Math.abs(last.x - point.x) > 0.01 || Math.abs(last.y - point.y) > 0.01) {
		points.push(point);
	}
}

function reflect(point: SvgPoint, around: SvgPoint): SvgPoint {
	return {
		x: 2 * around.x - point.x,
		y: 2 * around.y - point.y,
	};
}

function arcToCenterParameters(
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

function tokenizePathData(pathData: string): string[] {
	return pathData.match(COMMAND_RE) ?? [];
}

function isCommandToken(token: string | undefined) {
	return Boolean(token && /^[a-zA-Z]$/.test(token));
}

function readNumber(tokens: string[], index: { value: number }) {
	const token = tokens[index.value];
	if (!token || isCommandToken(token)) {
		return null;
	}
	index.value += 1;
	const value = Number(token);
	return Number.isFinite(value) ? value : null;
}

export function multiplySvgMatrices(a: SvgMatrix, b: SvgMatrix): SvgMatrix {
	return [
		a[0] * b[0] + a[2] * b[1],
		a[1] * b[0] + a[3] * b[1],
		a[0] * b[2] + a[2] * b[3],
		a[1] * b[2] + a[3] * b[3],
		a[0] * b[4] + a[2] * b[5] + a[4],
		a[1] * b[4] + a[3] * b[5] + a[5],
	];
}

export function applySvgMatrix(point: SvgPoint, matrix: SvgMatrix): SvgPoint {
	return {
		x: point.x * matrix[0] + point.y * matrix[2] + matrix[4],
		y: point.x * matrix[1] + point.y * matrix[3] + matrix[5],
	};
}

export function parseSvgTransform(transform: string | null | undefined): SvgMatrix {
	if (!transform) {
		return IDENTITY_MATRIX;
	}

	const entries = transform.match(/[a-zA-Z]+\([^)]*\)/g) ?? [];
	let current = IDENTITY_MATRIX;

	for (const entry of entries) {
		const nameMatch = entry.match(/^([a-zA-Z]+)\(([^)]*)\)$/);
		if (!nameMatch) {
			continue;
		}

		const name = nameMatch[1].toLowerCase();
		const rawArgs = nameMatch[2]
			.split(/[\s,]+/)
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => Number(part));
		let next = IDENTITY_MATRIX;

		switch (name) {
			case 'matrix':
				if (rawArgs.length >= 6) {
					next = [
						rawArgs[0],
						rawArgs[1],
						rawArgs[2],
						rawArgs[3],
						rawArgs[4],
						rawArgs[5],
					];
				}
				break;
			case 'translate':
				next = [1, 0, 0, 1, rawArgs[0] ?? 0, rawArgs[1] ?? 0];
				break;
			case 'scale':
				next = [rawArgs[0] ?? 1, 0, 0, rawArgs[1] ?? rawArgs[0] ?? 1, 0, 0];
				break;
			case 'rotate': {
				const angle = ((rawArgs[0] ?? 0) * Math.PI) / 180;
				const cos = Math.cos(angle);
				const sin = Math.sin(angle);
				if (rawArgs.length >= 3) {
					const [_, cx, cy] = rawArgs;
					next = multiplySvgMatrices(
						multiplySvgMatrices([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]),
						[1, 0, 0, 1, -cx, -cy],
					);
				} else {
					next = [cos, sin, -sin, cos, 0, 0];
				}
				break;
			}
			case 'skewx': {
				const angle = ((rawArgs[0] ?? 0) * Math.PI) / 180;
				next = [1, 0, Math.tan(angle), 1, 0, 0];
				break;
			}
			case 'skewy': {
				const angle = ((rawArgs[0] ?? 0) * Math.PI) / 180;
				next = [1, Math.tan(angle), 0, 1, 0, 0];
				break;
			}
		}

		current = multiplySvgMatrices(current, next);
	}

	return current;
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

	const simplifyDPStep = (
		input: SvgPoint[],
		first: number,
		last: number,
		result: SvgPoint[],
	) => {
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

export function scalePointCloud(points: SvgPoint[], scale: number) {
	return points.map((point) => ({
		x: point.x * scale,
		y: point.y * scale,
	}));
}

export function parseSvgPoints(points: string): SvgPoint[] {
	const values = points
		.trim()
		.split(/[\s,]+/)
		.map((entry) => Number(entry))
		.filter((value) => Number.isFinite(value));
	const result: SvgPoint[] = [];
	for (let i = 0; i < values.length - 1; i += 2) {
		result.push({ x: values[i], y: values[i + 1] });
	}
	return result;
}

export function parseSvgPathContours(pathData: string, scale = 1): SvgPathContour[] {
	const tokens = tokenizePathData(pathData);
	const index = { value: 0 };
	const contours: SvgPathContour[] = [];
	let command = '';
	let current = { x: 0, y: 0 };
	let subpathStart = { x: 0, y: 0 };
	let activeContour: SvgPoint[] | null = null;
	let previousCubicControl: SvgPoint | null = null;
	let previousQuadraticControl: SvgPoint | null = null;

	const ensureContour = () => {
		if (!activeContour) {
			activeContour = [{ ...current }];
		}
		return activeContour;
	};

	const finalizeContour = (closed: boolean) => {
		if (!activeContour || activeContour.length < 2) {
			activeContour = null;
			return;
		}
		const simplified = simplifyPoints(activeContour, Math.max(0.35, 1 / Math.max(scale, 0.001)));
		if (closed) {
			addPoint(simplified, simplified[0]);
		}
		contours.push({
			points: simplified,
			closed,
		});
		activeContour = null;
	};

	while (index.value < tokens.length) {
		const token = tokens[index.value];
		if (isCommandToken(token)) {
			command = token;
			index.value += 1;
		} else if (!command) {
			index.value += 1;
			continue;
		}

		const absolute = command === command.toUpperCase();
		switch (command.toUpperCase()) {
			case 'M': {
				const x = readNumber(tokens, index);
				const y = readNumber(tokens, index);
				if (x == null || y == null) {
					break;
				}
				if (activeContour) {
					finalizeContour(false);
				}
				current = {
					x: absolute ? x : current.x + x,
					y: absolute ? y : current.y + y,
				};
				subpathStart = { ...current };
				activeContour = [{ ...current }];
				previousCubicControl = null;
				previousQuadraticControl = null;
				command = absolute ? 'L' : 'l';
				break;
			}
			case 'L': {
				const contour = ensureContour();
				while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
					const x = readNumber(tokens, index);
					const y = readNumber(tokens, index);
					if (x == null || y == null) {
						break;
					}
					current = {
						x: absolute ? x : current.x + x,
						y: absolute ? y : current.y + y,
					};
					addPoint(contour, current);
				}
				previousCubicControl = null;
				previousQuadraticControl = null;
				break;
			}
			case 'H': {
				const contour = ensureContour();
				while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
					const x = readNumber(tokens, index);
					if (x == null) {
						break;
					}
					current = { x: absolute ? x : current.x + x, y: current.y };
					addPoint(contour, current);
				}
				previousCubicControl = null;
				previousQuadraticControl = null;
				break;
			}
			case 'V': {
				const contour = ensureContour();
				while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
					const y = readNumber(tokens, index);
					if (y == null) {
						break;
					}
					current = { x: current.x, y: absolute ? y : current.y + y };
					addPoint(contour, current);
				}
				previousCubicControl = null;
				previousQuadraticControl = null;
				break;
			}
			case 'C': {
				const contour = ensureContour();
				while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
					const values = [readNumber(tokens, index), readNumber(tokens, index), readNumber(tokens, index), readNumber(tokens, index), readNumber(tokens, index), readNumber(tokens, index)];
					if (values.some((value) => value == null)) {
						break;
					}
					const control1 = {
						x: absolute ? values[0]! : current.x + values[0]!,
						y: absolute ? values[1]! : current.y + values[1]!,
					};
					const control2 = {
						x: absolute ? values[2]! : current.x + values[2]!,
						y: absolute ? values[3]! : current.y + values[3]!,
					};
					const end = {
						x: absolute ? values[4]! : current.x + values[4]!,
						y: absolute ? values[5]! : current.y + values[5]!,
					};
					const estimate = distance(current, control1) + distance(control1, control2) + distance(control2, end);
					const segments = estimateCurveSegments(estimate, scale);
					for (let segment = 1; segment <= segments; segment += 1) {
						addPoint(contour, cubicBezierPoint(current, control1, control2, end, segment / segments));
					}
					current = end;
					previousCubicControl = control2;
					previousQuadraticControl = null;
				}
				break;
			}
			case 'S': {
				const contour = ensureContour();
				while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
					const values = [readNumber(tokens, index), readNumber(tokens, index), readNumber(tokens, index), readNumber(tokens, index)];
					if (values.some((value) => value == null)) {
						break;
					}
					const control1 = previousCubicControl ? reflect(previousCubicControl, current) : { ...current };
					const control2 = {
						x: absolute ? values[0]! : current.x + values[0]!,
						y: absolute ? values[1]! : current.y + values[1]!,
					};
					const end = {
						x: absolute ? values[2]! : current.x + values[2]!,
						y: absolute ? values[3]! : current.y + values[3]!,
					};
					const estimate = distance(current, control1) + distance(control1, control2) + distance(control2, end);
					const segments = estimateCurveSegments(estimate, scale);
					for (let segment = 1; segment <= segments; segment += 1) {
						addPoint(contour, cubicBezierPoint(current, control1, control2, end, segment / segments));
					}
					current = end;
					previousCubicControl = control2;
					previousQuadraticControl = null;
				}
				break;
			}
			case 'Q': {
				const contour = ensureContour();
				while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
					const values = [readNumber(tokens, index), readNumber(tokens, index), readNumber(tokens, index), readNumber(tokens, index)];
					if (values.some((value) => value == null)) {
						break;
					}
					const control = {
						x: absolute ? values[0]! : current.x + values[0]!,
						y: absolute ? values[1]! : current.y + values[1]!,
					};
					const end = {
						x: absolute ? values[2]! : current.x + values[2]!,
						y: absolute ? values[3]! : current.y + values[3]!,
					};
					const estimate = distance(current, control) + distance(control, end);
					const segments = estimateCurveSegments(estimate, scale);
					for (let segment = 1; segment <= segments; segment += 1) {
						addPoint(contour, quadraticBezierPoint(current, control, end, segment / segments));
					}
					current = end;
					previousQuadraticControl = control;
					previousCubicControl = null;
				}
				break;
			}
			case 'T': {
				const contour = ensureContour();
				while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
					const x = readNumber(tokens, index);
					const y = readNumber(tokens, index);
					if (x == null || y == null) {
						break;
					}
						const control: SvgPoint = previousQuadraticControl
							? reflect(previousQuadraticControl, current)
							: { ...current };
					const end = {
						x: absolute ? x : current.x + x,
						y: absolute ? y : current.y + y,
					};
					const estimate = distance(current, control) + distance(control, end);
					const segments = estimateCurveSegments(estimate, scale);
					for (let segment = 1; segment <= segments; segment += 1) {
						addPoint(contour, quadraticBezierPoint(current, control, end, segment / segments));
					}
					current = end;
					previousQuadraticControl = control;
					previousCubicControl = null;
				}
				break;
			}
			case 'A': {
				const contour = ensureContour();
				while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
					const values = [
						readNumber(tokens, index),
						readNumber(tokens, index),
						readNumber(tokens, index),
						readNumber(tokens, index),
						readNumber(tokens, index),
						readNumber(tokens, index),
						readNumber(tokens, index),
					];
					if (values.some((value) => value == null)) {
						break;
					}
					const end = {
						x: absolute ? values[5]! : current.x + values[5]!,
						y: absolute ? values[6]! : current.y + values[6]!,
					};
					const params = arcToCenterParameters(
						current,
						end,
						values[0]!,
						values[1]!,
						values[2]!,
						values[3]!,
						values[4]!,
					);
					if (!params) {
						addPoint(contour, end);
						current = end;
						continue;
					}
					const arcLength =
						Math.max(params.rx, params.ry) * Math.abs(params.deltaAngle);
					const segments = estimateCurveSegments(arcLength, scale);
					for (let segment = 1; segment <= segments; segment += 1) {
						const angle = params.startAngle + (params.deltaAngle * segment) / segments;
						const cosAngle = Math.cos(angle);
						const sinAngle = Math.sin(angle);
						const cosPhi = Math.cos(params.phi);
						const sinPhi = Math.sin(params.phi);
						addPoint(contour, {
							x: params.cx + params.rx * cosAngle * cosPhi - params.ry * sinAngle * sinPhi,
							y: params.cy + params.rx * cosAngle * sinPhi + params.ry * sinAngle * cosPhi,
						});
					}
					current = end;
					previousCubicControl = null;
					previousQuadraticControl = null;
				}
				break;
			}
			case 'Z':
				current = { ...subpathStart };
				finalizeContour(true);
				previousCubicControl = null;
				previousQuadraticControl = null;
				break;
			default:
				index.value += 1;
				break;
		}
	}

	if (activeContour) {
		finalizeContour(false);
	}

	return contours;
}

export function createRectanglePoints(x: number, y: number, width: number, height: number) {
	return [
		{ x, y },
		{ x: x + width, y },
		{ x: x + width, y: y + height },
		{ x, y: y + height },
		{ x, y },
	];
}

export function createEllipsePoints(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	scale = 1,
) {
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

export function transformPointCloud(points: SvgPoint[], matrix: SvgMatrix) {
	return points.map((point) => applySvgMatrix(point, matrix));
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
