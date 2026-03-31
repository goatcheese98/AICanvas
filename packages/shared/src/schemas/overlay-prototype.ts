import * as z from 'zod';

const resourceSnapshotSchema = z.object({
	resourceType: z.enum(['board', 'document', 'prototype']),
	resourceId: z.string().min(1),
	title: z.string().trim().min(1).max(120),
	snapshotVersion: z.coerce.number().int().min(1),
	display: z
		.object({
			subtitle: z.string().trim().min(1).max(120).optional(),
			summary: z.string().trim().min(1).max(240).optional(),
			badge: z.string().trim().min(1).max(32).optional(),
		})
		.default({}),
});

export const prototypeTemplateSchema = z.enum(['react', 'vanilla']);

export const prototypeOverlayFileSchema = z.object({
	code: z.string().default(''),
	active: z.boolean().optional(),
	hidden: z.boolean().optional(),
	readOnly: z.boolean().optional(),
});

export const prototypeOverlaySchema = z.object({
	type: z.literal('prototype'),
	title: z.string().trim().min(1).max(32).default('Prototype'),
	template: prototypeTemplateSchema.default('react'),
	// Legacy: files stored on canvas cards (new cards use resourceSnapshot only)
	files: z.record(z.string(), prototypeOverlayFileSchema).default({}),
	dependencies: z.record(z.string(), z.string()).default({}),
	activeFile: z.string().trim().min(1).optional(),
	showEditor: z.boolean().optional(),
	showPreview: z.boolean().optional(),
	resourceSnapshot: resourceSnapshotSchema.optional(),
});

function resolveActiveFile(
	files: Record<string, z.infer<typeof prototypeOverlayFileSchema>>,
	requestedActiveFile?: string,
) {
	if (requestedActiveFile && files[requestedActiveFile]) {
		return requestedActiveFile;
	}

	return (
		Object.entries(files).find(([, file]) => file.active)?.[0] ??
		Object.keys(files).find((path) => !files[path]?.hidden) ??
		Object.keys(files)[0]
	);
}

export function normalizePrototypeOverlay(
	input?: Partial<z.input<typeof prototypeOverlaySchema>> | null,
) {
	const parsed = prototypeOverlaySchema.parse({
		type: 'prototype',
		...(input ?? {}),
	});
	const activeFile = resolveActiveFile(parsed.files, parsed.activeFile);

	return {
		...parsed,
		files: Object.fromEntries(
			Object.entries(parsed.files).map(([path, file]) => [
				path,
				{
					...file,
					active: activeFile ? path === activeFile : false,
				},
			]),
		),
		activeFile,
		showEditor: parsed.showEditor ?? true,
		showPreview: parsed.showPreview ?? true,
	};
}
