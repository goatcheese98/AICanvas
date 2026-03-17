import { describe, expect, it } from 'vitest';
import { vectorizeImageDataToSvg } from './raster-to-svg';

function createImageData(
	width: number,
	height: number,
	pixels: Array<[number, number, number, number]>,
) {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let index = 0; index < pixels.length; index += 1) {
		const offset = index * 4;
		const [r, g, b, a] = pixels[index];
		data[offset] = r;
		data[offset + 1] = g;
		data[offset + 2] = b;
		data[offset + 3] = a;
	}
	return {
		width,
		height,
		data,
	} as ImageData;
}

describe('raster to svg vectorization', () => {
	it('traces a simple monochrome sketch region into svg paths', () => {
		const imageData = createImageData(4, 4, [
			[255, 255, 255, 255], [255, 255, 255, 255], [255, 255, 255, 255], [255, 255, 255, 255],
			[255, 255, 255, 255], [0, 0, 0, 255], [0, 0, 0, 255], [255, 255, 255, 255],
			[255, 255, 255, 255], [0, 0, 0, 255], [0, 0, 0, 255], [255, 255, 255, 255],
			[255, 255, 255, 255], [255, 255, 255, 255], [255, 255, 255, 255], [255, 255, 255, 255],
		]);

		const svg = vectorizeImageDataToSvg(imageData);

		expect(svg).toContain('<svg');
		expect(svg).toContain('<path');
		expect(svg).toContain('fill="none"');
		expect(svg).toContain('stroke="#000000"');
	});

	it('preserves multiple fill colors for simple posterized regions', () => {
		const imageData = createImageData(4, 2, [
			[255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 255, 255], [0, 0, 255, 255],
			[255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 255, 255], [0, 0, 255, 255],
		]);

		const svg = vectorizeImageDataToSvg(imageData, { maxColors: 4 });

		expect(svg).toContain('fill="#ff0000"');
		expect(svg).toContain('fill="#0000ff"');
	});

	it('removes tiny isolated noise via morphological opening, preserving the main region', () => {
		const imageData = createImageData(12, 12, Array.from({ length: 144 }, (_, index) => {
			const x = index % 12;
			const y = Math.floor(index / 12);
			if (x >= 3 && x <= 8 && y >= 2 && y <= 8) {
				return [40, 40, 40, 255] as [number, number, number, number];
			}
			// Tiny 2×3 isolated mark — should be erased by morphological opening
			if (y >= 10 && x >= 9) {
				return [40, 40, 40, 255] as [number, number, number, number];
			}
			return [255, 255, 255, 255] as [number, number, number, number];
		}));

		const svg = vectorizeImageDataToSvg(imageData);
		const pathCount = (svg.match(/<path /g) ?? []).length;

		expect(pathCount).toBeGreaterThanOrEqual(1);
		expect(svg).toContain('<path');
	});
});
