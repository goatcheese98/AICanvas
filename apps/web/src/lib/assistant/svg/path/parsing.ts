import {
	addPoint,
	arcToCenterParameters,
	cubicBezierPoint,
	estimateCurveSegments,
	quadraticBezierPoint,
	reflect,
} from '../math/bezier';
import type { SvgPoint } from '../math/points';
import { distance, simplifyPoints } from '../math/points';

export interface SvgPathContour {
	points: SvgPoint[];
	closed: boolean;
}

const COMMAND_RE = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;

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
					const values = [
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
					const estimate =
						distance(current, control1) + distance(control1, control2) + distance(control2, end);
					const segments = estimateCurveSegments(estimate, scale);
					for (let segment = 1; segment <= segments; segment += 1) {
						addPoint(
							contour,
							cubicBezierPoint(current, control1, control2, end, segment / segments),
						);
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
					const values = [
						readNumber(tokens, index),
						readNumber(tokens, index),
						readNumber(tokens, index),
						readNumber(tokens, index),
					];
					if (values.some((value) => value == null)) {
						break;
					}
					const control1 = previousCubicControl
						? reflect(previousCubicControl, current)
						: { ...current };
					const control2 = {
						x: absolute ? values[0]! : current.x + values[0]!,
						y: absolute ? values[1]! : current.y + values[1]!,
					};
					const end = {
						x: absolute ? values[2]! : current.x + values[2]!,
						y: absolute ? values[3]! : current.y + values[3]!,
					};
					const estimate =
						distance(current, control1) + distance(control1, control2) + distance(control2, end);
					const segments = estimateCurveSegments(estimate, scale);
					for (let segment = 1; segment <= segments; segment += 1) {
						addPoint(
							contour,
							cubicBezierPoint(current, control1, control2, end, segment / segments),
						);
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
					const values = [
						readNumber(tokens, index),
						readNumber(tokens, index),
						readNumber(tokens, index),
						readNumber(tokens, index),
					];
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
					const arcLength = Math.max(params.rx, params.ry) * Math.abs(params.deltaAngle);
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
