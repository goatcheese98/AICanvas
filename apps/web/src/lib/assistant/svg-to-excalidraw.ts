import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { parseSvgDimensions } from './diagram-renderer';
import {
	IDENTITY_MATRIX,
	type SvgMatrix,
	type SvgPathContour,
	type SvgPoint,
	createEllipsePoints,
	createRectanglePoints,
	distributePoints,
	getPointBounds,
	multiplySvgMatrices,
	parseSvgPathContours,
	parseSvgPoints,
	parseSvgTransform,
	simplifyPoints,
	transformPointCloud,
} from './svg-path-utils';

interface CompiledSvgStyle {
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	fillOpacity: number;
	strokeOpacity: number;
	strokeDasharray: string | null;
}

interface CompileContext {
	scale: number;
	groupId: string;
	customData: Record<string, unknown>;
	maxPointsPerElement: number;
}

interface SvgCompileOptions {
	maxDimension?: number;
	minDimension?: number;
	maxElementCount?: number;
	maxPointsPerElement?: number;
	customData?: Record<string, unknown>;
}

export interface SvgCompileResult {
	elements: ExcalidrawElement[];
	width: number;
	height: number;
}

const DEFAULT_STYLE: CompiledSvgStyle = {
	fill: '#000000',
	stroke: 'transparent',
	strokeWidth: 1,
	opacity: 1,
	fillOpacity: 1,
	strokeOpacity: 1,
	strokeDasharray: null,
};

function constrainVectorSize(
	input: { width: number; height: number },
	options?: Pick<SvgCompileOptions, 'maxDimension' | 'minDimension'>,
) {
	const maxDimension = options?.maxDimension ?? 480;
	const minDimension = options?.minDimension ?? 160;
	const width = Math.max(1, Math.round(input.width));
	const height = Math.max(1, Math.round(input.height));
	const maxScale = maxDimension / Math.max(width, height);
	const minScale = minDimension / Math.max(1, Math.min(width, height));
	const scale = Math.min(maxScale, Math.max(1, minScale));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
		scale,
	};
}

function parseStyleAttribute(style: string | null) {
	const result: Record<string, string> = {};
	if (!style) {
		return result;
	}
	for (const part of style.split(';')) {
		const [rawKey, rawValue] = part.split(':', 2);
		const key = rawKey?.trim();
		const value = rawValue?.trim();
		if (key && value) {
			result[key] = value;
		}
	}
	return result;
}

function readStyleValue(element: Element, inlineStyle: Record<string, string>, property: string) {
	const direct = element.getAttribute(property);
	if (typeof direct === 'string' && direct.length > 0) {
		return direct;
	}
	return inlineStyle[property] ?? null;
}

function normalizeColor(value: string | null | undefined, fallback: string) {
	if (!value) {
		return fallback;
	}
	const normalized = value.trim();
	if (!normalized || normalized.toLowerCase() === 'none') {
		return 'transparent';
	}
	return normalized;
}

function normalizeNumber(value: string | null | undefined, fallback: number) {
	if (!value) {
		return fallback;
	}
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function clampOpacity(value: number) {
	return Math.max(0, Math.min(1, value));
}

function resolveElementStyle(element: Element, parent: CompiledSvgStyle): CompiledSvgStyle {
	const inlineStyle = parseStyleAttribute(element.getAttribute('style'));
	const opacity = clampOpacity(
		normalizeNumber(readStyleValue(element, inlineStyle, 'opacity'), parent.opacity),
	);
	const fillOpacity = clampOpacity(
		normalizeNumber(readStyleValue(element, inlineStyle, 'fill-opacity'), parent.fillOpacity),
	);
	const strokeOpacity = clampOpacity(
		normalizeNumber(readStyleValue(element, inlineStyle, 'stroke-opacity'), parent.strokeOpacity),
	);

	return {
		fill: normalizeColor(readStyleValue(element, inlineStyle, 'fill'), parent.fill),
		stroke: normalizeColor(readStyleValue(element, inlineStyle, 'stroke'), parent.stroke),
		strokeWidth: Math.max(
			0,
			normalizeNumber(readStyleValue(element, inlineStyle, 'stroke-width'), parent.strokeWidth),
		),
		opacity,
		fillOpacity,
		strokeOpacity,
		strokeDasharray:
			readStyleValue(element, inlineStyle, 'stroke-dasharray') ?? parent.strokeDasharray,
	};
}

function toStrokeStyle(dashArray: string | null) {
	if (!dashArray || dashArray === 'none') {
		return 'solid' as const;
	}
	const values = dashArray
		.split(/[\s,]+/)
		.map((entry) => Number.parseFloat(entry))
		.filter((entry) => Number.isFinite(entry) && entry > 0);
	if (values.length === 0) {
		return 'solid' as const;
	}
	return values.every((value) => value <= 2.5) ? ('dotted' as const) : ('dashed' as const);
}

function roundNumber(value: number) {
	return Math.round(value * 100) / 100;
}

/**
 * Graham scan convex hull — guarantees a convex polygon output.
 * Used for all closed filled shapes so Rough.js never encounters concave or
 * self-intersecting geometry, which causes it to silently drop the fill on
 * any re-render (selection, point edit, or resize).
 */
function convexHull(points: SvgPoint[]): SvgPoint[] {
	if (points.length <= 3) return points;
	// Find bottommost-then-leftmost anchor point
	let lo = 0;
	for (let i = 1; i < points.length; i += 1) {
		if (
			points[i].y > points[lo].y ||
			(points[i].y === points[lo].y && points[i].x < points[lo].x)
		) {
			lo = i;
		}
	}
	const pivot = points[lo];
	const rest = points
		.filter((_, i) => i !== lo)
		.sort((a, b) => {
			// Sort CCW by polar angle, break ties by distance (keep farthest)
			const cross = (a.x - pivot.x) * (b.y - pivot.y) - (a.y - pivot.y) * (b.x - pivot.x);
			if (Math.abs(cross) > 1e-9) return cross > 0 ? -1 : 1;
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
	return hull.length >= 3 ? hull : points;
}

function isVisibleStyle(style: CompiledSvgStyle) {
	return (
		(style.fill !== 'transparent' && style.fillOpacity * style.opacity > 0.01) ||
		(style.stroke !== 'transparent' &&
			style.strokeWidth > 0 &&
			style.strokeOpacity * style.opacity > 0.01)
	);
}

function inferRoughness(_style: CompiledSvgStyle) {
	// Roughness=0 ensures deterministic rendering for computer-traced paths.
	// Non-zero roughness causes Rough.js to produce degenerate (invisible) fills
	// for tightly-packed contour polygons when elements are re-rendered on interaction.
	return 0;
}

function createLineSkeleton(
	points: SvgPoint[],
	closed: boolean,
	style: CompiledSvgStyle,
	context: CompileContext,
): ExcalidrawElementSkeleton | null {
	if (points.length < 2 || !isVisibleStyle(style)) {
		return null;
	}

	const isFilled = closed && style.fill !== 'transparent' && style.stroke === 'transparent';
	const simplifyTolerance = closed
		? Math.max(1.6, 2.4 / Math.max(context.scale, 0.01))
		: Math.max(1.2, 1.75 / Math.max(context.scale, 0.01));
	const simplified = simplifyPoints(points, simplifyTolerance);
	const distributed = distributePoints(
		simplified,
		closed ? Math.max(8, context.maxPointsPerElement - 1) : context.maxPointsPerElement,
	);
	if (distributed.length < 2) {
		return null;
	}

	// Closed filled polygons are enforced to their convex hull so Rough.js never
	// encounters concave or self-intersecting geometry. Non-convex polygons cause
	// Rough.js to silently drop the fill on any re-render triggered by selection,
	// point editing, or resize — producing the "goes transparent" effect.
	const finalPoints = isFilled ? convexHull(distributed) : distributed;
	if (finalPoints.length < (closed ? 3 : 2)) {
		return null;
	}

	const normalizedPoints =
		closed && finalPoints.length > 2 ? [...finalPoints.slice(0, -1), finalPoints[0]] : finalPoints;
	const bounds = getPointBounds(normalizedPoints);

	// Discard degenerate thin shapes that Rough.js cannot render as a meaningful fill.
	if (closed && (bounds.right - bounds.left < 3 || bounds.bottom - bounds.top < 3)) {
		return null;
	}
	const x = roundNumber(bounds.left);
	const y = roundNumber(bounds.top);
	const localPoints = normalizedPoints.map((point) => [
		roundNumber(point.x - x),
		roundNumber(point.y - y),
	]);

	const resolvedStrokeColor =
		closed && style.fill !== 'transparent' && style.stroke === 'transparent'
			? style.fill
			: style.stroke;
	const resolvedStrokeWidth =
		closed && style.fill !== 'transparent' && style.stroke === 'transparent'
			? 1
			: Math.max(1, roundNumber(style.strokeWidth));

	return {
		type: 'line',
		x,
		y,
		points: localPoints,
		strokeColor: resolvedStrokeColor,
		backgroundColor: closed ? style.fill : 'transparent',
		fillStyle: 'solid',
		strokeWidth: resolvedStrokeWidth,
		strokeStyle: toStrokeStyle(style.strokeDasharray),
		roughness: inferRoughness(style),
		opacity: Math.max(
			1,
			Math.round(
				100 * Math.max(style.opacity * style.fillOpacity, style.opacity * style.strokeOpacity),
			),
		),
		groupIds: [context.groupId],
		customData: context.customData,
	} as never;
}

function createRectangleSkeleton(
	x: number,
	y: number,
	width: number,
	height: number,
	style: CompiledSvgStyle,
	context: CompileContext,
	roundness?: { type: 3; value: number } | null,
): ExcalidrawElementSkeleton | null {
	if (!isVisibleStyle(style) || width <= 0 || height <= 0) {
		return null;
	}

	return {
		type: 'rectangle',
		x: roundNumber(x),
		y: roundNumber(y),
		width: roundNumber(width),
		height: roundNumber(height),
		strokeColor: style.stroke,
		backgroundColor: style.fill,
		fillStyle: 'solid',
		strokeWidth: Math.max(1, roundNumber(style.strokeWidth)),
		strokeStyle: toStrokeStyle(style.strokeDasharray),
		roughness: inferRoughness(style),
		opacity: Math.max(
			1,
			Math.round(
				100 * Math.max(style.opacity * style.fillOpacity, style.opacity * style.strokeOpacity),
			),
		),
		roundness,
		groupIds: [context.groupId],
		customData: context.customData,
	} as never;
}

function createEllipseSkeleton(
	x: number,
	y: number,
	width: number,
	height: number,
	style: CompiledSvgStyle,
	context: CompileContext,
): ExcalidrawElementSkeleton | null {
	if (!isVisibleStyle(style) || width <= 0 || height <= 0) {
		return null;
	}

	return {
		type: 'ellipse',
		x: roundNumber(x),
		y: roundNumber(y),
		width: roundNumber(width),
		height: roundNumber(height),
		strokeColor: style.stroke,
		backgroundColor: style.fill,
		fillStyle: 'solid',
		strokeWidth: Math.max(1, roundNumber(style.strokeWidth)),
		strokeStyle: toStrokeStyle(style.strokeDasharray),
		roughness: inferRoughness(style),
		opacity: Math.max(
			1,
			Math.round(
				100 * Math.max(style.opacity * style.fillOpacity, style.opacity * style.strokeOpacity),
			),
		),
		groupIds: [context.groupId],
		customData: context.customData,
	} as never;
}

function isAxisAligned(matrix: SvgMatrix) {
	return Math.abs(matrix[1]) < 0.0001 && Math.abs(matrix[2]) < 0.0001;
}

function compileContourSet(
	contours: SvgPathContour[],
	style: CompiledSvgStyle,
	matrix: SvgMatrix,
	context: CompileContext,
) {
	const elements: ExcalidrawElementSkeleton[] = [];
	const scaledMatrix = multiplySvgMatrices([context.scale, 0, 0, context.scale, 0, 0], matrix);
	for (const contour of contours) {
		const transformed = transformPointCloud(contour.points, scaledMatrix);
		const element = createLineSkeleton(transformed, contour.closed, style, context);
		if (element) {
			elements.push(element);
		}
	}
	return elements;
}

function compileElementNode(
	element: Element,
	parentStyle: CompiledSvgStyle,
	parentMatrix: SvgMatrix,
	context: CompileContext,
): ExcalidrawElementSkeleton[] {
	const style = resolveElementStyle(element, parentStyle);
	const matrix = multiplySvgMatrices(
		parentMatrix,
		parseSvgTransform(element.getAttribute('transform')),
	);
	const tagName = element.tagName.toLowerCase();

	switch (tagName) {
		case 'g':
		case 'svg':
			return [...element.children].flatMap((child) =>
				compileElementNode(child, style, matrix, context),
			);
		case 'path': {
			const pathData = element.getAttribute('d');
			if (!pathData) {
				return [];
			}
			return compileContourSet(
				parseSvgPathContours(pathData, context.scale),
				style,
				matrix,
				context,
			);
		}
		case 'polyline':
		case 'polygon': {
			const pointsAttribute = element.getAttribute('points');
			if (!pointsAttribute) {
				return [];
			}
			const points = parseSvgPoints(pointsAttribute);
			if (points.length < 2) {
				return [];
			}
			const closed = tagName === 'polygon';
			const normalized = closed ? [...points, points[0]] : points;
			return compileContourSet([{ points: normalized, closed }], style, matrix, context);
		}
		case 'line': {
			const x1 = normalizeNumber(element.getAttribute('x1'), 0);
			const y1 = normalizeNumber(element.getAttribute('y1'), 0);
			const x2 = normalizeNumber(element.getAttribute('x2'), 0);
			const y2 = normalizeNumber(element.getAttribute('y2'), 0);
			return compileContourSet(
				[
					{
						points: [
							{ x: x1, y: y1 },
							{ x: x2, y: y2 },
						],
						closed: false,
					},
				],
				style,
				matrix,
				context,
			);
		}
		case 'rect': {
			const x = normalizeNumber(element.getAttribute('x'), 0);
			const y = normalizeNumber(element.getAttribute('y'), 0);
			const width = normalizeNumber(element.getAttribute('width'), 0);
			const height = normalizeNumber(element.getAttribute('height'), 0);
			const rx = normalizeNumber(element.getAttribute('rx'), 0);
			const ry = normalizeNumber(element.getAttribute('ry'), 0);
			const scaledMatrix = multiplySvgMatrices([context.scale, 0, 0, context.scale, 0, 0], matrix);
			if (isAxisAligned(scaledMatrix) && scaledMatrix[0] > 0 && scaledMatrix[3] > 0) {
				return [
					createRectangleSkeleton(
						x * scaledMatrix[0] + scaledMatrix[4],
						y * scaledMatrix[3] + scaledMatrix[5],
						width * scaledMatrix[0],
						height * scaledMatrix[3],
						style,
						context,
						rx > 0 || ry > 0
							? { type: 3, value: roundNumber(Math.max(rx, ry) * context.scale) }
							: null,
					),
				].filter(Boolean) as ExcalidrawElementSkeleton[];
			}
			return compileContourSet(
				[{ points: createRectanglePoints(x, y, width, height), closed: true }],
				style,
				matrix,
				context,
			);
		}
		case 'circle':
		case 'ellipse': {
			const cx = normalizeNumber(element.getAttribute('cx'), 0);
			const cy = normalizeNumber(element.getAttribute('cy'), 0);
			const rx = normalizeNumber(element.getAttribute(tagName === 'circle' ? 'r' : 'rx'), 0);
			const ry = normalizeNumber(element.getAttribute(tagName === 'circle' ? 'r' : 'ry'), rx);
			const scaledMatrix = multiplySvgMatrices([context.scale, 0, 0, context.scale, 0, 0], matrix);
			if (isAxisAligned(scaledMatrix) && scaledMatrix[0] > 0 && scaledMatrix[3] > 0) {
				return [
					createEllipseSkeleton(
						(cx - rx) * scaledMatrix[0] + scaledMatrix[4],
						(cy - ry) * scaledMatrix[3] + scaledMatrix[5],
						rx * 2 * scaledMatrix[0],
						ry * 2 * scaledMatrix[3],
						style,
						context,
					),
				].filter(Boolean) as ExcalidrawElementSkeleton[];
			}
			return compileContourSet(
				[{ points: createEllipsePoints(cx, cy, rx, ry, context.scale), closed: true }],
				style,
				matrix,
				context,
			);
		}
		default:
			return [];
	}
}

export function compileSvgToExcalidraw(
	svgMarkup: string,
	options?: SvgCompileOptions,
): SvgCompileResult {
	const dimensions = parseSvgDimensions(svgMarkup);
	const constrained = constrainVectorSize(dimensions, options);
	const parser = new DOMParser();
	const document = parser.parseFromString(svgMarkup, 'image/svg+xml');
	const svg = document.documentElement;

	if (!svg || svg.tagName.toLowerCase() !== 'svg') {
		throw new Error('Invalid SVG document');
	}

	const viewBoxValues = (svg.getAttribute('viewBox') ?? '')
		.trim()
		.split(/[\s,]+/)
		.map((value) => Number.parseFloat(value))
		.filter((value) => Number.isFinite(value));
	const rootMatrix =
		viewBoxValues.length === 4
			? ([1, 0, 0, 1, -viewBoxValues[0], -viewBoxValues[1]] as SvgMatrix)
			: IDENTITY_MATRIX;

	const groupId = crypto.randomUUID();
	const context: CompileContext = {
		scale: constrained.scale,
		groupId,
		maxPointsPerElement: Math.max(12, Math.min(options?.maxPointsPerElement ?? 48, 96)),
		customData: {
			type: 'ai-generated-vector-elements',
			...(options?.customData ?? {}),
		},
	};
	const skeletons = compileElementNode(svg, DEFAULT_STYLE, rootMatrix, context);
	const trimmed = skeletons.slice(0, options?.maxElementCount ?? 120);
	if (trimmed.length === 0) {
		throw new Error('No supported vector shapes were found');
	}

	// convertToExcalidrawElements applies Excalidraw's own defaults which can
	// override the roughness: 0 we set in every skeleton. Force it back to 0
	// post-conversion so Rough.js never re-randomizes fills on interaction.
	const converted = convertToExcalidrawElements(trimmed);
	const elements = converted.map((el) => ({ ...el, roughness: 0 }) as ExcalidrawElement);

	return { elements, width: constrained.width, height: constrained.height };
}
