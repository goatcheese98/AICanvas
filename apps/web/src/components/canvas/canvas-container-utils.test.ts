import type { CanvasData } from '@/lib/persistence/CanvasPersistenceCoordinator';
import { describe, expect, it } from 'vitest';
import {
	getNonDeletedElements,
	getThumbnailSignature,
	hasElements,
	toBinaryFileList,
	toBinaryFiles,
	toSceneUpdateAppState,
} from './canvas-container-utils';

describe('canvas-container-utils', () => {
	describe('toSceneUpdateAppState', () => {
		it('should return empty object for null/undefined input', () => {
			expect(toSceneUpdateAppState(null)).toEqual({});
			expect(toSceneUpdateAppState(undefined)).toEqual({});
		});

		it('should return appState as-is for valid input', () => {
			const appState = { viewBackgroundColor: '#ffffff', zoom: 1 };
			expect(toSceneUpdateAppState(appState)).toEqual(appState);
		});
	});

	describe('toBinaryFiles', () => {
		it('should return empty object for null/undefined input', () => {
			expect(toBinaryFiles(null)).toEqual({});
			expect(toBinaryFiles(undefined)).toEqual({});
		});

		it('should return files as-is for valid input', () => {
			const files = { file1: { id: 'file1', dataUrl: 'data:...' } };
			expect(toBinaryFiles(files)).toEqual(files);
		});
	});

	describe('toBinaryFileList', () => {
		it('should return empty array for null/undefined input', () => {
			expect(toBinaryFileList(null)).toEqual([]);
			expect(toBinaryFileList(undefined)).toEqual([]);
		});

		it('should return array of file values', () => {
			const files = {
				file1: { id: 'file1', dataUrl: 'data:1' },
				file2: { id: 'file2', dataUrl: 'data:2' },
			};
			const result = toBinaryFileList(files);
			expect(result).toHaveLength(2);
			expect(result).toContainEqual(files.file1);
			expect(result).toContainEqual(files.file2);
		});
	});

	describe('getThumbnailSignature', () => {
		it('should return consistent signature for same data', () => {
			const data: CanvasData = {
				elements: [
					{ id: 'el1', version: 1, versionNonce: 123, isDeleted: false },
					{ id: 'el2', version: 2, versionNonce: 456, isDeleted: true },
				],
				appState: {},
				files: null,
			};
			const sig1 = getThumbnailSignature(data);
			const sig2 = getThumbnailSignature(data);
			expect(sig1).toBe(sig2);
		});

		it('should return different signatures for different data', () => {
			const data1: CanvasData = {
				elements: [{ id: 'el1', version: 1, versionNonce: 123, isDeleted: false }],
				appState: {},
				files: null,
			};
			const data2: CanvasData = {
				elements: [{ id: 'el1', version: 2, versionNonce: 123, isDeleted: false }],
				appState: {},
				files: null,
			};
			expect(getThumbnailSignature(data1)).not.toBe(getThumbnailSignature(data2));
		});

		it('should handle isDeleted correctly', () => {
			const data: CanvasData = {
				elements: [
					{ id: 'el1', version: 1, versionNonce: 123, isDeleted: true },
					{ id: 'el2', version: 1, versionNonce: 456 }, // no isDeleted
				],
				appState: {},
				files: null,
			};
			const sig = getThumbnailSignature(data);
			expect(JSON.parse(sig)).toEqual([
				['el1', 1, 123, true],
				['el2', 1, 456, false],
			]);
		});
	});

	describe('getNonDeletedElements', () => {
		it('should filter out deleted elements', () => {
			const data: CanvasData = {
				elements: [
					{ id: 'el1', isDeleted: false },
					{ id: 'el2', isDeleted: true },
					{ id: 'el3' }, // no isDeleted
				],
				appState: {},
				files: null,
			};
			const result = getNonDeletedElements(data);
			expect(result).toHaveLength(2);
			expect(result.map((e) => e.id)).toEqual(['el1', 'el3']);
		});

		it('should return empty array when all elements deleted', () => {
			const data: CanvasData = {
				elements: [
					{ id: 'el1', isDeleted: true },
					{ id: 'el2', isDeleted: true },
				],
				appState: {},
				files: null,
			};
			expect(getNonDeletedElements(data)).toHaveLength(0);
		});
	});

	describe('hasElements', () => {
		it('should return true when non-deleted elements exist', () => {
			const data: CanvasData = {
				elements: [{ id: 'el1', isDeleted: false }],
				appState: {},
				files: null,
			};
			expect(hasElements(data)).toBe(true);
		});

		it('should return false when no elements', () => {
			const data: CanvasData = {
				elements: [],
				appState: {},
				files: null,
			};
			expect(hasElements(data)).toBe(false);
		});

		it('should return false when all elements deleted', () => {
			const data: CanvasData = {
				elements: [
					{ id: 'el1', isDeleted: true },
					{ id: 'el2', isDeleted: true },
				],
				appState: {},
				files: null,
			};
			expect(hasElements(data)).toBe(false);
		});
	});
});
