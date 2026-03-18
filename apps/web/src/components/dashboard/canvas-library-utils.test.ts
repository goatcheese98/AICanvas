import { describe, expect, it } from 'vitest';
import { validateCanvasForm } from './canvas-library-utils';

const mockCanvases = [
	{
		id: '1',
		userId: 'u1',
		title: 'Existing Board',
		description: 'A test canvas',
		isPublic: false,
		r2Key: 'a',
		thumbnailUrl: undefined,
		isFavorite: false,
		createdAt: '2026-03-01T00:00:00.000Z',
		updatedAt: '2026-03-03T00:00:00.000Z',
	},
] as const;

describe('canvas-library-utils', () => {
	describe('validateCanvasForm', () => {
		it('validates a valid create form', () => {
			const result = validateCanvasForm(
				{
					title: 'New Canvas',
					description: 'A description',
					isPublic: true,
				},
				[...mockCanvases],
				'create',
			);

			expect(result.valid).toBe(true);
			expect(result.error).toBeNull();
			expect(result.data).toEqual({
				title: 'New Canvas',
				description: 'A description',
				isPublic: true,
			});
		});

		it('rejects empty title', () => {
			const result = validateCanvasForm(
				{
					title: '',
					description: '',
					isPublic: false,
				},
				[...mockCanvases],
				'create',
			);

			expect(result.valid).toBe(false);
			expect(result.error).toBeTruthy();
		});

		it('rejects duplicate title on create', () => {
			const result = validateCanvasForm(
				{
					title: 'Existing Board',
					description: '',
					isPublic: false,
				},
				[...mockCanvases],
				'create',
			);

			expect(result.valid).toBe(false);
			expect(result.error).toBe('You already have a canvas with that name.');
		});

		it('allows same title when renaming same canvas', () => {
			const result = validateCanvasForm(
				{
					title: 'Existing Board',
					description: '',
					isPublic: false,
				},
				[...mockCanvases],
				'rename',
				'1',
			);

			expect(result.valid).toBe(true);
			expect(result.error).toBeNull();
		});

		it('rejects duplicate title when renaming to different canvas name', () => {
			const canvasesWithTwo = [
				...mockCanvases,
				{
					id: '2',
					userId: 'u1',
					title: 'Another Board',
					description: '',
					isPublic: false,
					r2Key: 'b',
					thumbnailUrl: undefined,
					isFavorite: false,
					createdAt: '2026-03-01T00:00:00.000Z',
					updatedAt: '2026-03-02T00:00:00.000Z',
				},
			];

			const result = validateCanvasForm(
				{
					title: 'Existing Board',
					description: '',
					isPublic: false,
				},
				canvasesWithTwo,
				'rename',
				'2',
			);

			expect(result.valid).toBe(false);
			expect(result.error).toBe('You already have a canvas with that name.');
		});

		it('accepts title with normalized comparison', () => {
			const result = validateCanvasForm(
				{
					title: '  existing   BOARD  ',
					description: '',
					isPublic: false,
				},
				[...mockCanvases],
				'create',
			);

			expect(result.valid).toBe(false);
			expect(result.error).toBe('You already have a canvas with that name.');
		});
	});
});
