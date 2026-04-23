// Re-exports from organized svg modules for backward compatibility
// See svg/math/ and svg/path/ for implementation details

export type { SvgPoint, SvgMatrix } from './svg/math/types';
export type { SvgPathContour } from './svg/path/parsing';

export { IDENTITY_MATRIX } from './svg/math/matrices';

export {
	createEllipsePoints,
	createRectanglePoints,
} from './svg/path/shapes';

export {
	distributePoints,
	getPointBounds,
	simplifyPoints,
	transformPointCloud,
} from './svg/math/points';

export {
	multiplySvgMatrices,
	parseSvgTransform,
} from './svg/math/matrices';

export {
	parseSvgPathContours,
	parseSvgPoints,
} from './svg/path/parsing';
