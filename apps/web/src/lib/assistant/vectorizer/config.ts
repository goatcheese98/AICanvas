import type { SketchVectorComplexity, SketchVectorControls, SketchVectorStyle } from './types.js';

/** Default values for user-facing controls */
export const DEFAULT_CONTROLS: SketchVectorControls = {
	style: 'clean',
	complexity: 'medium',
	colorPalette: 12,
	detailLevel: 0.78,
	edgeSensitivity: 20,
};

/** Base working size for each complexity level */
export const BASE_SIZE_BY_COMPLEXITY: Record<SketchVectorComplexity, number> = {
	low: 420,
	medium: 640,
	high: 860,
};

/** Maximum element count for each complexity level */
export const MAX_ELEMENTS_BY_COMPLEXITY: Record<SketchVectorComplexity, number> = {
	low: 320,
	medium: 760,
	high: 1400,
};

/** Roughness value for each style preset */
export const STYLE_ROUGHNESS: Record<SketchVectorStyle, number> = {
	clean: 0,
	technical: 0,
	'hand-drawn': 1,
	organic: 2,
};

/** Brightness cutoff to protect near-white colors from merging */
export const MERGE_BRIGHT_CUTOFF = 185;

/** Dark cutoff to protect near-black colors from merging */
export const MERGE_DARK_CUTOFF = 55;

/** Maximum squared RGB distance for color cluster merging */
export const MERGE_MAX_DIST_SQ = 40 * 40;

/** Maximum samples for K-means clustering */
export const MAX_KMEANS_SAMPLES = 180_000;

/** Maximum iterations for K-means convergence */
export const KMEANS_MAX_ITERATIONS = 18;

/** Minimum cluster count for K-means */
export const KMEANS_MIN_CLUSTERS = 2;

/** Maximum cluster count for K-means */
export const KMEANS_MAX_CLUSTERS = 24;

/** Bilateral filter color sigma */
export const BILATERAL_SIGMA_COLOR = 45;

/** Bilateral filter space sigma */
export const BILATERAL_SIGMA_SPACE = 2;

/** Minimum working dimension */
export const MIN_WORKING_SIZE = 1;

/** Maximum working dimension */
export const MAX_WORKING_SIZE = 1024;

/** Dark cluster brightness threshold */
export const DARK_CLUSTER_THRESHOLD = 80;

/** Background brightness threshold for detection */
export const BACKGROUND_BRIGHTNESS_THRESHOLD = 220;

/** Maximum Chaikin smooth iterations before early termination */
export const MAX_CHAIKIN_ITERATIONS = 2400;

/** Containment margin for spatial nesting detection */
export const CONTAINMENT_MARGIN = 10;
