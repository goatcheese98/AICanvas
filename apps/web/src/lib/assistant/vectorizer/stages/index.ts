// Color quantization stage
export { quantize } from './quantize.js';

// Segmentation stage
export { processLabel, extractComponents, binaryMaskForLabel, morphOpen, morphClose } from './segment.js';

// Polygonization stage
export { buildBoundaryLoops, selectLargestLoop, createPolygonSkeleton } from './polygonize.js';

// Smoothing stage
export { simplifyClosedPolygon, chaikinSmoothClosed, sortByRenderOrder, rdp } from './smooth.js';
