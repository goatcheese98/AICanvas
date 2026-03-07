import { z } from 'zod';

export function normalizeCanvasTitle(title: string): string {
	return title.trim().replace(/\s+/g, ' ');
}

export function getCanvasTitleKey(title: string): string {
	return normalizeCanvasTitle(title).toLocaleLowerCase();
}

const canvasTitleSchema = z
	.string()
	.transform(normalizeCanvasTitle)
	.refine((value) => value.length >= 1, 'Canvas name is required.')
	.refine((value) => value.length <= 120, 'Canvas name must be 120 characters or fewer.');

const canvasDescriptionSchema = z
	.string()
	.trim()
	.max(1000, 'Description must be 1000 characters or fewer.')
	.transform((value) => (value.length > 0 ? value : undefined));

export const createCanvasSchema = z.object({
	title: canvasTitleSchema,
	description: canvasDescriptionSchema.optional(),
	isPublic: z.boolean().default(false),
});

export const updateCanvasSchema = z.object({
	title: canvasTitleSchema.optional(),
	description: canvasDescriptionSchema.optional(),
	isPublic: z.boolean().optional(),
});

export const canvasIdSchema = z.object({
	id: z.string().min(1),
});

export const canvasListSchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().min(1).max(100).default(20),
	search: z.string().trim().max(120).optional(),
});

// Loose schema for canvas blob data (elements/appState/files are opaque to the API)
export const canvasDataSchema = z.object({
	elements: z.array(z.record(z.string(), z.unknown())),
	appState: z.record(z.string(), z.unknown()),
	files: z.record(z.string(), z.unknown()).nullable(),
});

export const canvasSchemas = {
	create: createCanvasSchema,
	update: updateCanvasSchema,
	id: canvasIdSchema,
	list: canvasListSchema,
	data: canvasDataSchema,
} as const;

export type CreateCanvas = z.infer<typeof createCanvasSchema>;
export type UpdateCanvas = z.infer<typeof updateCanvasSchema>;
export type CanvasData = z.infer<typeof canvasDataSchema>;
