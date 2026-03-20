import type { PathTraceOptions } from './types';

// ─── Default Trace Options ──────────────────────────────────────────────────────

export const DEFAULT_TRACE_OPTIONS: PathTraceOptions = {
	maxSampleDimension: 256,
	maxColors: 5,
	colorMergeThreshold: 30,
	bgLuminanceThreshold: 220,
	monochromeSaturationThreshold: 15,
	minAreaRatio: 0.004,
	simplificationTolerance: 0.85,
	maxSkeletonPaths: 20,
	minPathLength: 3,
	minPointCount: 3,
};

// ─── Bilateral Filter Constants ─────────────────────────────────────────────────

export const BILATERAL_FILTER = {
	/** Sigma color squared (2 * 40²) */
	SIGMA_COLOR_2: 2 * 40 * 40,
	/** Sigma space squared (2 * 2²) */
	SIGMA_SPACE_2: 2 * 2 * 2,
	/** Neighborhood radius */
	RADIUS: 1,
} as const;

// ─── K-Means Constants ──────────────────────────────────────────────────────────

export const KMEANS = {
	/** Maximum iterations for convergence */
	MAX_ITERATIONS: 15,
	/** Minimum alpha value to include pixel (0-255) */
	MIN_ALPHA: 16,
} as const;

// ─── Morphological Operation Constants ──────────────────────────────────────────

export const MORPHOLOGY = {
	/** Minimum width/height for morphological operations */
	MIN_DIMENSION: 5,
} as const;

// ─── Skeleton Thinning Constants ────────────────────────────────────────────────

export const SKELETON = {
	/** Minimum width/height for skeleton thinning */
	MIN_DIMENSION: 3,
} as const;

// ─── Convex Hull Constants ──────────────────────────────────────────────────────

export const CONVEX_HULL = {
	/** Minimum points required for convex hull computation */
	MIN_POINTS: 3,
	/** Cross product tolerance for collinearity check */
	CROSS_TOLERANCE: 1e-9,
} as const;

// ─── Contour Tracing Constants ──────────────────────────────────────────────────

export const CONTOUR = {
	/** Minimum loop length to be considered valid */
	MIN_LOOP_LENGTH: 4,
} as const;

// ─── Path Simplification Defaults ───────────────────────────────────────────────

export const SIMPLIFICATION = {
	/** Base tolerance value */
	BASE_TOLERANCE: 0.75,
	/** Decimal precision for coordinate output */
	DECIMAL_PRECISION: 100,
} as const;
