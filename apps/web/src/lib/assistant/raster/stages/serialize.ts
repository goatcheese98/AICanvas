import type { SvgPoint } from '../../svg-path-utils';
import { SIMPLIFICATION } from '../config';
import type { SerializeInput, SerializeOutput, TraceLayer, TracedPath } from '../types';

// ─── Path Serialization ─────────────────────────────────────────────────────────

function formatCoordinate(n: number): string {
	return String(
		Math.round(n * SIMPLIFICATION.DECIMAL_PRECISION) / SIMPLIFICATION.DECIMAL_PRECISION,
	);
}

function polygonPath(points: SvgPoint[]): string {
	const coords = points.map((p) => `${formatCoordinate(p.x)} ${formatCoordinate(p.y)}`);
	return `M ${coords.join(' L ')} Z`;
}

function openPolylinePath(points: SvgPoint[]): string {
	const coords = points.map((p) => `${formatCoordinate(p.x)} ${formatCoordinate(p.y)}`);
	return `M ${coords.join(' L ')}`;
}

// ─── Monochrome SVG Serialization ───────────────────────────────────────────────

function serializeMonochrome(
	width: number,
	height: number,
	paths: TracedPath[],
	inkColor: string,
): string {
	const pathElems = paths
		.map((p) => {
			const d = p.closed ? polygonPath(p.points) : openPolylinePath(p.points);
			return `<path d="${d}" fill="none" stroke="${inkColor}" stroke-width="1.6" />`;
		})
		.join('\n');

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n${pathElems}\n</svg>`;
}

// ─── Color SVG Serialization ────────────────────────────────────────────────────

function serializeColor(width: number, height: number, layers: TraceLayer[]): string {
	const pathElems = layers
		.flatMap((layer) =>
			layer.paths.map((path) => `<path d="${path}" fill="${layer.fill}" stroke="transparent" />`),
		)
		.join('\n');

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n${pathElems}\n</svg>`;
}

// ─── Main Serialize Function ────────────────────────────────────────────────────

export function serialize(input: SerializeInput): SerializeOutput {
	const { width, height, paths, layers, inkColor } = input;

	// Monochrome mode
	if (paths.length > 0) {
		if (!inkColor) {
			throw new Error('Ink color required for monochrome serialization');
		}
		const svg = serializeMonochrome(width, height, paths, inkColor);
		return { svg };
	}

	// Color mode
	if (layers.length === 0) {
		throw new Error('No layers to serialize');
	}

	// Convert layer hullPoints to path strings
	const layersWithPaths: TraceLayer[] = layers.map((layer) => {
		if (!layer.hullPoints || layer.hullPoints.length < 3) {
			return { ...layer, paths: [] };
		}
		return {
			fill: layer.fill,
			paths: [polygonPath(layer.hullPoints)],
			pixelCount: layer.pixelCount,
		};
	});

	const svg = serializeColor(width, height, layersWithPaths);
	return { svg };
}
