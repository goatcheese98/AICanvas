import { canvasSchemas } from '@ai-canvas/shared/schemas';
import { getCanvasTitleKey } from '@ai-canvas/shared/schemas';
import type { Canvas } from '@ai-canvas/shared/types';
import type { CanvasFormState } from './canvas-library-types';

interface ValidationResult {
	valid: boolean;
	error: string | null;
	data?: {
		title: string;
		description: string;
		isPublic: boolean;
	};
}

export function validateCanvasForm(
	formState: CanvasFormState,
	canvases: Canvas[],
	mode: 'create' | 'rename',
	renameTargetId?: string,
): ValidationResult {
	const schema = mode === 'create' ? canvasSchemas.create : canvasSchemas.update;
	const result = schema.safeParse({
		title: formState.title,
		description: formState.description,
		isPublic: formState.isPublic,
	});

	if (!result.success) {
		return {
			valid: false,
			error: result.error.issues[0]?.message ?? 'Please fix the highlighted fields.',
		};
	}

	if (
		hasCanvasTitleConflict(
			canvases,
			result.data.title ?? '',
			mode === 'rename' ? renameTargetId : undefined,
		)
	) {
		return {
			valid: false,
			error: 'You already have a canvas with that name.',
		};
	}

	return {
		valid: true,
		error: null,
		data: {
			title: result.data.title ?? '',
			description: result.data.description ?? '',
			isPublic: result.data.isPublic ?? false,
		},
	};
}

function hasCanvasTitleConflict(
	canvases: Canvas[],
	title: string,
	excludeCanvasId?: string,
): boolean {
	const titleKey = getCanvasTitleKey(title);
	return canvases.some(
		(canvas) => canvas.id !== excludeCanvasId && getCanvasTitleKey(canvas.title) === titleKey,
	);
}
