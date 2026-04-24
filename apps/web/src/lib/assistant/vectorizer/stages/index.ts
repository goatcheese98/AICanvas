// Color quantization stage
export { quantize } from './quantize.js';

// Segmentation stage
export { processLabel } from './segment.js';

// Polygonization stage
export { buildBoundaryLoops, selectLargestLoop, createPolygonSkeleton } from './polygonize.js';

// Smoothing stage
export { simplifyClosedPolygon, chaikinSmoothClosed, sortByRenderOrder } from './smooth.js';
