import type { RasterToSvgOptions } from './raster/types';
import { DEFAULT_TRACE_OPTIONS } from './raster/config';
import { preprocess, trace, optimize, optimizeLayers, serialize } from './raster/stages';
import type { PreprocessOutput, TraceOutput, OptimizeOutput, SerializeOutput, TraceLayer } from './raster/types';
import { vectorizeImageDataToSvg as vectorizeImageData } from './raster/imagedata';

// ─── Re-exports ─────────────────────────────────────────────────────────────────

export type { RasterToSvgOptions } from './raster/types';

// ─── Options Merging ────────────────────────────────────────────────────────────

function mergeOptions(options?: RasterToSvgOptions) {
	return {
		...DEFAULT_TRACE_OPTIONS,
		...(options?.maxSampleDimension !== undefined && { maxSampleDimension: options.maxSampleDimension }),
		...(options?.maxColors !== undefined && { maxColors: options.maxColors }),
	};
}

// ─── ImageData Path (Legacy Support) ────────────────────────────────────────────

/**
 * Converts raster ImageData to SVG string.
 * This is a simplified path that maintains backward compatibility for tests.
 * For production use, prefer rasterBlobToSvg.
 */
export function vectorizeImageDataToSvg(imageData: ImageData, options?: RasterToSvgOptions): string {
	const mergedOptions = mergeOptions(options);
	return vectorizeImageData(imageData, mergedOptions);
}

// ─── Blob Path (Primary API) ────────────────────────────────────────────────────

/**
 * Main entry point: converts a raster image Blob to an SVG string.
 *
 * Pipeline stages:
 * 1. Preprocess: Load image, apply bilateral filter, quantize colors, detect background
 * 2. Trace: Extract contours or skeleton paths based on image type (monochrome vs color)
 * 3. Optimize: Simplify paths, reduce points, filter small components
 * 4. Serialize: Build final SVG string with proper formatting
 */
export async function rasterBlobToSvg(blob: Blob, options?: RasterToSvgOptions): Promise<string> {
	const mergedOptions = mergeOptions(options);

	// Stage 1: Preprocess
	const preprocessResult: PreprocessOutput = await preprocess({ blob, options: mergedOptions });

	// Stage 2: Trace
	const traceResult: TraceOutput = trace({
		width: preprocessResult.width,
		height: preprocessResult.height,
		labels: preprocessResult.quantized.labels,
		centers: preprocessResult.quantized.centers,
		bgIndex: preprocessResult.bgIndex,
		bgLuminance: preprocessResult.bgLuminance,
		isMonochrome: preprocessResult.isMonochrome,
		minArea: preprocessResult.minArea,
	});

	// Stage 3: Optimize
	let optimizedLayers: TraceLayer[] = [];
	if (traceResult.paths.length > 0) {
		// Monochrome mode
		const optimizeResult: OptimizeOutput = optimize({
			paths: traceResult.paths,
			width: traceResult.width,
			height: traceResult.height,
			options: mergedOptions,
		});
		traceResult.paths = optimizeResult.paths;
	} else {
		// Color mode
		optimizedLayers = optimizeLayers(traceResult.layers, mergedOptions);
	}

	// Stage 4: Serialize
	const serializeResult: SerializeOutput = serialize({
		width: traceResult.width,
		height: traceResult.height,
		paths: traceResult.paths,
		layers: optimizedLayers,
		inkColor: traceResult.inkColor,
	});

	return serializeResult.svg;
}

// ─── Legacy Export ──────────────────────────────────────────────────────────────

/**
 * @deprecated Use rasterBlobToSvg instead.
 */
export async function vectorizeRasterBlobToSvg(blob: Blob, options?: RasterToSvgOptions): Promise<string> {
	return rasterBlobToSvg(blob, options);
}
