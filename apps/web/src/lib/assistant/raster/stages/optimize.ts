import type { SvgPoint } from '../../svg-path-utils';
import { simplifyPoints } from '../../svg-path-utils';
import type { OptimizeInput, OptimizeOutput, TracedPath, TraceLayer } from '../types';
import { SIMPLIFICATION } from '../config';

// ─── Path Utilities ─────────────────────────────────────────────────────────────

function pathLength(points: SvgPoint[]): number {
	let total = 0;
	for (let i = 0; i < points.length - 1; i += 1) {
		total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
	}
	return total;
}

function computeSignedArea(points: SvgPoint[]): number {
	let total = 0;
	for (let i = 0; i < points.length - 1; i += 1) {
		total += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
	}
	return total / 2;
}

// ─── Monochrome Path Optimization ───────────────────────────────────────────────

function simplifyLoop(points: SvgPoint[], scaleX: number, scaleY: number): SvgPoint[] {
	const tolerance = Math.max(
		SIMPLIFICATION.BASE_TOLERANCE,
		Math.min(scaleX, scaleY) * 0.85,
	);
	const scaled = points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
	const simplified = simplifyPoints(scaled, tolerance);
	return simplified.length >= 3 ? simplified : scaled;
}

function optimizeMonochromePaths(
	paths: TracedPath[],
	options: OptimizeInput['options'],
): TracedPath[] {
	// Cap at max skeleton paths to prevent element explosion on complex dark silhouettes.
	// Skeleton tracing of a rounded rectangle body can produce hundreds of tiny
	// segments; keeping the longest paths preserves the main structure.
	const sortedPaths = paths
		.map((p) => ({ ...p, points: simplifyLoop(p.points, 1, 1) }))
		.filter((p) => p.points.length >= 2 && pathLength(p.points) >= options.minPathLength)
		.sort((a, b) => b.points.length - a.points.length);

	return sortedPaths.slice(0, options.maxSkeletonPaths);
}

// ─── Color Path Optimization ────────────────────────────────────────────────────

function optimizeColorLayers(
	layers: TraceLayer[],
	_options: OptimizeInput['options'],
): TraceLayer[] {
	return layers
		.map((layer) => {
			if (!layer.hullPoints || layer.hullPoints.length < 3) return null;

			const simplified = simplifyPoints(layer.hullPoints, 0.5);
			if (simplified.length < 3) return null;

			return {
				fill: layer.fill,
				paths: [] as string[], // Will be filled during serialization
				pixelCount: layer.pixelCount,
				hullPoints: simplified,
			};
		})
		.filter((layer): layer is NonNullable<typeof layer> => layer !== null);
}

// ─── Main Optimize Function ─────────────────────────────────────────────────────

export function optimize(input: OptimizeInput): OptimizeOutput {
	const { paths, width, height, options } = input;

	// If we have paths (monochrome mode), optimize them
	if (paths.length > 0) {
		const optimizedPaths = optimizeMonochromePaths(paths, options);

		if (optimizedPaths.length === 0) {
			throw new Error('No vectorizable stroke paths detected in this sketch.');
		}

		return { paths: optimizedPaths };
	}

	// No paths to optimize (color mode)
	return { paths: [] };
}

/**
 * Optimizes color layers separately since they have different structure.
 * This is called by the serialize stage for color images.
 */
export function optimizeLayers(
	layers: TraceLayer[],
	options: OptimizeInput['options'],
): TraceLayer[] {
	const optimizedLayers = optimizeColorLayers(layers, options);

	if (optimizedLayers.length === 0) {
		throw new Error('No vectorizable regions detected in this image.');
	}

	return optimizedLayers;
}
