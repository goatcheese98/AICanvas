import type { SvgPoint } from '../svg-path-utils';

// ─── Color Types ──────────────────────────────────────────────────────────────

export interface RgbaColor {
	r: number;
	g: number;
	b: number;
	a: number;
}

// ─── Path Types ─────────────────────────────────────────────────────────────────

export interface TracedPath {
	points: SvgPoint[];
	closed: boolean;
}

// ─── Layer Types ────────────────────────────────────────────────────────────────

export interface TraceLayer {
	fill: string;
	paths: string[];
	pixelCount: number;
	/** Hull points used during tracing, removed during optimization */
	hullPoints?: import('../svg-path-utils').SvgPoint[];
}

// ─── Quantization Types ─────────────────────────────────────────────────────────

export interface ColorQuantizationResult {
	centers: RgbaColor[];
	labels: Int32Array;
}

// ─── Options Types ──────────────────────────────────────────────────────────────

export interface PathTraceOptions {
	/** Max dimension for sampling (default: 256) */
	maxSampleDimension: number;
	/** Maximum number of colors to extract (default: 5) */
	maxColors: number;
	/** Threshold for merging similar color centers (default: 30) */
	colorMergeThreshold: number;
	/** Minimum luminance to consider as background (default: 220) */
	bgLuminanceThreshold: number;
	/** Saturation threshold for monochrome detection (default: 15) */
	monochromeSaturationThreshold: number;
	/** Minimum area ratio for component pruning (default: 0.004) */
	minAreaRatio: number;
	/** Simplification tolerance multiplier (default: 0.85) */
	simplificationTolerance: number;
	/** Maximum number of skeleton paths to keep (default: 20) */
	maxSkeletonPaths: number;
	/** Minimum path length to keep (default: 3) */
	minPathLength: number;
	/** Minimum points for a valid path (default: 3) */
	minPointCount: number;
}

export interface RasterToSvgOptions {
	maxSampleDimension?: number;
	maxColors?: number;
}

// ─── Pipeline Stage Types ───────────────────────────────────────────────────────

export interface PreprocessInput {
	blob: Blob;
	options: PathTraceOptions;
}

export interface PreprocessOutput {
	width: number;
	height: number;
	imageData: ImageData;
	quantized: ColorQuantizationResult;
	bgIndex: number;
	bgLuminance: number;
	isMonochrome: boolean;
	minArea: number;
}

export interface TraceInput {
	width: number;
	height: number;
	labels: Int32Array;
	centers: RgbaColor[];
	bgIndex: number;
	bgLuminance: number;
	isMonochrome: boolean;
	minArea: number;
}

export interface TraceOutput {
	width: number;
	height: number;
	paths: TracedPath[];
	layers: TraceLayer[];
	inkColor?: string;
}

export interface OptimizeInput {
	paths: TracedPath[];
	width: number;
	height: number;
	options: PathTraceOptions;
}

export interface OptimizeOutput {
	paths: TracedPath[];
}

export interface SerializeInput {
	width: number;
	height: number;
	paths: TracedPath[];
	layers: TraceLayer[];
	inkColor?: string;
}

export interface SerializeOutput {
	svg: string;
}
