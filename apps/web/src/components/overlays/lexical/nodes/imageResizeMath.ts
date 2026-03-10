export interface ResizeDragState {
	startW: number;
	startH: number;
	scale: number;
}

export function computeResizeDimensions(
	state: ResizeDragState,
	dx: number,
	dy: number,
): { width: number; height: number } {
	const { startW, startH, scale } = state;
	const ratio = startW / startH;
	const cssDx = dx / scale;
	const cssDy = dy / scale;
	const delta = Math.abs(cssDx) >= Math.abs(cssDy * ratio) ? cssDx : cssDy * ratio;
	const width = Math.max(80, startW + delta);
	return {
		width,
		height: width / ratio,
	};
}

export function computeScale(cssWidth: number, screenWidth: number): number {
	return cssWidth > 0 ? screenWidth / cssWidth : 1;
}
