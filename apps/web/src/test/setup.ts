const canvasContextStub = {
	filter: 'none',
	fillStyle: '#000000',
	strokeStyle: '#000000',
	lineWidth: 1,
	font: '12px sans-serif',
	globalAlpha: 1,
	save() {},
	restore() {},
	scale() {},
	rotate() {},
	translate() {},
	transform() {},
	setTransform() {},
	resetTransform() {},
	clearRect() {},
	fillRect() {},
	strokeRect() {},
	beginPath() {},
	closePath() {},
	moveTo() {},
	lineTo() {},
	bezierCurveTo() {},
	quadraticCurveTo() {},
	arc() {},
	rect() {},
	fill() {},
	stroke() {},
	clip() {},
	setLineDash() {},
	drawImage() {},
	fillText() {},
	strokeText() {},
	measureText(text: string) {
		return {
			width: text.length * 8,
			actualBoundingBoxAscent: 8,
			actualBoundingBoxDescent: 2,
		};
	},
	getImageData() {
		return {
			data: new Uint8ClampedArray(),
		};
	},
	putImageData() {},
	createImageData() {
		return {
			data: new Uint8ClampedArray(),
		};
	},
	createLinearGradient() {
		return { addColorStop() {} };
	},
	createRadialGradient() {
		return { addColorStop() {} };
	},
} as const;

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
	configurable: true,
	value() {
		return canvasContextStub;
	},
});

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
	configurable: true,
	writable: true,
	value: ResizeObserverStub,
});
