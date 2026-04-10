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

interface SvgPathParserState {
	activeContour: SvgPoint[] | null;
	contours: SvgPathContour[];
	current: SvgPoint;
	previousCubicControl: SvgPoint | null;
	previousQuadraticControl: SvgPoint | null;
	scale: number;
	subpathStart: SvgPoint;
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

function readNumbers(tokens: string[], index: { value: number }, count: number) {
	const values: number[] = [];
	for (let valueIndex = 0; valueIndex < count; valueIndex += 1) {
		const value = readNumber(tokens, index);
		if (value == null) {
			return null;
		}
		values.push(value);
	}
	return values;
}

function createParserState(scale: number): SvgPathParserState {
	return {
		activeContour: null,
		contours: [],
		current: { x: 0, y: 0 },
		previousCubicControl: null,
		previousQuadraticControl: null,
		scale,
		subpathStart: { x: 0, y: 0 },
	};
}

function resetCurveControls(state: SvgPathParserState) {
	state.previousCubicControl = null;
	state.previousQuadraticControl = null;
}

function ensureContour(state: SvgPathParserState) {
	if (!state.activeContour) {
		state.activeContour = [{ ...state.current }];
	}
	return state.activeContour;
}

function finalizeContour(state: SvgPathParserState, closed: boolean) {
	if (!state.activeContour || state.activeContour.length < 2) {
		state.activeContour = null;
		return;
	}

	const simplified = simplifyPoints(
		state.activeContour,
		Math.max(0.35, 1 / Math.max(state.scale, 0.001)),
	);
	if (closed) {
		addPoint(simplified, simplified[0]);
	}

	state.contours.push({
		points: simplified,
		closed,
	});
	state.activeContour = null;
}

function resolvePoint(current: SvgPoint, absolute: boolean, x: number, y: number): SvgPoint {
	return {
		x: absolute ? x : current.x + x,
		y: absolute ? y : current.y + y,
	};
}

function appendCubicCurve(
	contour: SvgPoint[],
	current: SvgPoint,
	control1: SvgPoint,
	control2: SvgPoint,
	end: SvgPoint,
	scale: number,
) {
	const estimate =
		distance(current, control1) + distance(control1, control2) + distance(control2, end);
	const segments = estimateCurveSegments(estimate, scale);
	for (let segment = 1; segment <= segments; segment += 1) {
		addPoint(contour, cubicBezierPoint(current, control1, control2, end, segment / segments));
	}
}

function appendQuadraticCurve(
	contour: SvgPoint[],
	current: SvgPoint,
	control: SvgPoint,
	end: SvgPoint,
	scale: number,
) {
	const estimate = distance(current, control) + distance(control, end);
	const segments = estimateCurveSegments(estimate, scale);
	for (let segment = 1; segment <= segments; segment += 1) {
		addPoint(contour, quadraticBezierPoint(current, control, end, segment / segments));
	}
}

function appendArcCurve(
	contour: SvgPoint[],
	current: SvgPoint,
	end: SvgPoint,
	values: number[],
	scale: number,
) {
	const params = arcToCenterParameters(
		current,
		end,
		values[0] ?? 0,
		values[1] ?? 0,
		values[2] ?? 0,
		values[3] ?? 0,
		values[4] ?? 0,
	);
	if (!params) {
		addPoint(contour, end);
		return;
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
}

function handleMoveTo(
	tokens: string[],
	index: { value: number },
	state: SvgPathParserState,
	absolute: boolean,
) {
	const values = readNumbers(tokens, index, 2);
	if (!values) {
		return null;
	}

	if (state.activeContour) {
		finalizeContour(state, false);
	}

	state.current = resolvePoint(state.current, absolute, values[0] ?? 0, values[1] ?? 0);
	state.subpathStart = { ...state.current };
	state.activeContour = [{ ...state.current }];
	resetCurveControls(state);
	return absolute ? 'L' : 'l';
}

function handleLineTo(
	tokens: string[],
	index: { value: number },
	state: SvgPathParserState,
	absolute: boolean,
) {
	const contour = ensureContour(state);
	while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
		const values = readNumbers(tokens, index, 2);
		if (!values) {
			break;
		}
		state.current = resolvePoint(state.current, absolute, values[0] ?? 0, values[1] ?? 0);
		addPoint(contour, state.current);
	}
	resetCurveControls(state);
}

function handleHorizontalLineTo(
	tokens: string[],
	index: { value: number },
	state: SvgPathParserState,
	absolute: boolean,
) {
	const contour = ensureContour(state);
	while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
		const x = readNumber(tokens, index);
		if (x == null) {
			break;
		}
		state.current = { x: absolute ? x : state.current.x + x, y: state.current.y };
		addPoint(contour, state.current);
	}
	resetCurveControls(state);
}

function handleVerticalLineTo(
	tokens: string[],
	index: { value: number },
	state: SvgPathParserState,
	absolute: boolean,
) {
	const contour = ensureContour(state);
	while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
		const y = readNumber(tokens, index);
		if (y == null) {
			break;
		}
		state.current = { x: state.current.x, y: absolute ? y : state.current.y + y };
		addPoint(contour, state.current);
	}
	resetCurveControls(state);
}

function handleCubicCurveTo(
	tokens: string[],
	index: { value: number },
	state: SvgPathParserState,
	absolute: boolean,
) {
	const contour = ensureContour(state);
	while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
		const values = readNumbers(tokens, index, 6);
		if (!values) {
			break;
		}

		const control1 = resolvePoint(state.current, absolute, values[0] ?? 0, values[1] ?? 0);
		const control2 = resolvePoint(state.current, absolute, values[2] ?? 0, values[3] ?? 0);
		const end = resolvePoint(state.current, absolute, values[4] ?? 0, values[5] ?? 0);

		appendCubicCurve(contour, state.current, control1, control2, end, state.scale);
		state.current = end;
		state.previousCubicControl = control2;
		state.previousQuadraticControl = null;
	}
}

function handleSmoothCubicCurveTo(
	tokens: string[],
	index: { value: number },
	state: SvgPathParserState,
	absolute: boolean,
) {
	const contour = ensureContour(state);
	while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
		const values = readNumbers(tokens, index, 4);
		if (!values) {
			break;
		}

		const control1 = state.previousCubicControl
			? reflect(state.previousCubicControl, state.current)
			: { ...state.current };
		const control2 = resolvePoint(state.current, absolute, values[0] ?? 0, values[1] ?? 0);
		const end = resolvePoint(state.current, absolute, values[2] ?? 0, values[3] ?? 0);

		appendCubicCurve(contour, state.current, control1, control2, end, state.scale);
		state.current = end;
		state.previousCubicControl = control2;
		state.previousQuadraticControl = null;
	}
}

function handleQuadraticCurveTo(
	tokens: string[],
	index: { value: number },
	state: SvgPathParserState,
	absolute: boolean,
) {
	const contour = ensureContour(state);
	while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
		const values = readNumbers(tokens, index, 4);
		if (!values) {
			break;
		}

		const control = resolvePoint(state.current, absolute, values[0] ?? 0, values[1] ?? 0);
		const end = resolvePoint(state.current, absolute, values[2] ?? 0, values[3] ?? 0);

		appendQuadraticCurve(contour, state.current, control, end, state.scale);
		state.current = end;
		state.previousQuadraticControl = control;
		state.previousCubicControl = null;
	}
}

function handleSmoothQuadraticCurveTo(
	tokens: string[],
	index: { value: number },
	state: SvgPathParserState,
	absolute: boolean,
) {
	const contour = ensureContour(state);
	while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
		const values = readNumbers(tokens, index, 2);
		if (!values) {
			break;
		}

		const control = state.previousQuadraticControl
			? reflect(state.previousQuadraticControl, state.current)
			: { ...state.current };
		const end = resolvePoint(state.current, absolute, values[0] ?? 0, values[1] ?? 0);

		appendQuadraticCurve(contour, state.current, control, end, state.scale);
		state.current = end;
		state.previousQuadraticControl = control;
		state.previousCubicControl = null;
	}
}

function handleArcTo(
	tokens: string[],
	index: { value: number },
	state: SvgPathParserState,
	absolute: boolean,
) {
	const contour = ensureContour(state);
	while (index.value < tokens.length && !isCommandToken(tokens[index.value])) {
		const values = readNumbers(tokens, index, 7);
		if (!values) {
			break;
		}

		const end = resolvePoint(state.current, absolute, values[5] ?? 0, values[6] ?? 0);
		appendArcCurve(contour, state.current, end, values, state.scale);
		state.current = end;
		resetCurveControls(state);
	}
}

function handleClosePath(state: SvgPathParserState) {
	state.current = { ...state.subpathStart };
	finalizeContour(state, true);
	resetCurveControls(state);
}

function handlePathCommand(
	command: string,
	tokens: string[],
	index: { value: number },
	state: SvgPathParserState,
) {
	const absolute = command === command.toUpperCase();

	switch (command.toUpperCase()) {
		case 'M':
			return handleMoveTo(tokens, index, state, absolute);
		case 'L':
			handleLineTo(tokens, index, state, absolute);
			return null;
		case 'H':
			handleHorizontalLineTo(tokens, index, state, absolute);
			return null;
		case 'V':
			handleVerticalLineTo(tokens, index, state, absolute);
			return null;
		case 'C':
			handleCubicCurveTo(tokens, index, state, absolute);
			return null;
		case 'S':
			handleSmoothCubicCurveTo(tokens, index, state, absolute);
			return null;
		case 'Q':
			handleQuadraticCurveTo(tokens, index, state, absolute);
			return null;
		case 'T':
			handleSmoothQuadraticCurveTo(tokens, index, state, absolute);
			return null;
		case 'A':
			handleArcTo(tokens, index, state, absolute);
			return null;
		case 'Z':
			handleClosePath(state);
			return null;
		default:
			index.value += 1;
			return null;
	}
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
	const state = createParserState(scale);
	let command = '';

	while (index.value < tokens.length) {
		const token = tokens[index.value];
		if (isCommandToken(token)) {
			command = token;
			index.value += 1;
		} else if (!command) {
			index.value += 1;
			continue;
		}

		const nextCommand = handlePathCommand(command, tokens, index, state);
		if (nextCommand) {
			command = nextCommand;
		}
	}

	if (state.activeContour) {
		finalizeContour(state, false);
	}

	return state.contours;
}
