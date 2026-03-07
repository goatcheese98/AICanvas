export type WebEmbedViewMode = 'inline' | 'pip' | 'expanded';

const PIP_MIN_WIDTH = 260;
const PIP_MAX_WIDTH = 420;
const PIP_WIDTH_RATIO = 0.28;
const PIP_ASPECT_RATIO = 16 / 10;
const PIP_MARGIN = 20;
const PIP_TOP_OFFSET = 88;

export function getPipDimensions(viewportWidth: number) {
	const width = Math.min(PIP_MAX_WIDTH, Math.max(PIP_MIN_WIDTH, viewportWidth * PIP_WIDTH_RATIO));
	return {
		width,
		height: width / PIP_ASPECT_RATIO,
	};
}

export function clampPipPosition(
	position: { x: number; y: number },
	viewport: { width: number; height: number },
) {
	const pip = getPipDimensions(viewport.width);
	const maxX = Math.max(PIP_MARGIN, viewport.width - pip.width - PIP_MARGIN);
	const maxY = Math.max(PIP_TOP_OFFSET, viewport.height - pip.height - PIP_MARGIN);

	return {
		x: Math.min(Math.max(position.x, PIP_MARGIN), maxX),
		y: Math.min(Math.max(position.y, PIP_TOP_OFFSET), maxY),
	};
}

export function getDefaultPipPosition(viewport: { width: number; height: number }) {
	const pip = getPipDimensions(viewport.width);
	return {
		x: Math.max(PIP_MARGIN, viewport.width - pip.width - PIP_MARGIN),
		y: PIP_TOP_OFFSET,
	};
}
