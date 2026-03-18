import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { describe, expect, it } from 'vitest';
import { getRoundnessByOptionId, getRoundnessOptionId } from './markdown-utility-utils';

describe('getRoundnessOptionId', () => {
	it('should return "square" for undefined roundness', () => {
		expect(getRoundnessOptionId(undefined)).toBe('square');
	});

	it('should return "square" for null roundness', () => {
		expect(getRoundnessOptionId(null)).toBe('square');
	});

	it('should return "pill" for roundness type 1', () => {
		const roundness: ExcalidrawElement['roundness'] = { type: 1 };
		expect(getRoundnessOptionId(roundness)).toBe('pill');
	});

	it('should return "pill" for roundness type 2', () => {
		const roundness: ExcalidrawElement['roundness'] = { type: 2 };
		expect(getRoundnessOptionId(roundness)).toBe('pill');
	});

	it('should return "rounded" for roundness type 3', () => {
		const roundness: ExcalidrawElement['roundness'] = { type: 3, value: 18 };
		expect(getRoundnessOptionId(roundness)).toBe('rounded');
	});

	it('should return "rounded" for unknown roundness type', () => {
		const roundness: ExcalidrawElement['roundness'] = { type: 99 } as unknown as {
			type: 3;
			value: number;
		};
		expect(getRoundnessOptionId(roundness)).toBe('rounded');
	});
});

describe('getRoundnessByOptionId', () => {
	it('should return null for "square" option', () => {
		expect(getRoundnessByOptionId('square')).toBeNull();
	});

	it('should return roundness config for "rounded" option', () => {
		const result = getRoundnessByOptionId('rounded');
		expect(result).toEqual({ type: 3, value: 18 });
	});

	it('should return roundness config for "pill" option', () => {
		const result = getRoundnessByOptionId('pill');
		expect(result).toEqual({ type: 1 });
	});

	it('should return null for unknown option id', () => {
		expect(getRoundnessByOptionId('unknown')).toBeNull();
	});
});

describe('roundness utilities round-trip', () => {
	it('should correctly round-trip through getRoundnessOptionId and getRoundnessByOptionId', () => {
		// Test each option
		const optionIds = ['square', 'rounded', 'pill'];

		for (const optionId of optionIds) {
			const roundness = getRoundnessByOptionId(optionId);
			const resultOptionId = getRoundnessOptionId(roundness);
			expect(resultOptionId).toBe(optionId);
		}
	});
});
