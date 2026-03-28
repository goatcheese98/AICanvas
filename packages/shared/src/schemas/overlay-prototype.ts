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

export const prototypeCardMetricSchema = z.object({
	label: z.string().trim().min(1).max(24).default('Metric'),
	value: z.string().trim().min(1).max(24).default('0'),
});

export const prototypeCardPreviewSchema = z.object({
	eyebrow: z.string().trim().min(1).max(24).default('Prototype'),
	title: z.string().trim().min(1).max(48).default('Prototype'),
	description: z.string().trim().min(1).max(140).default('Interactive concept'),
	accent: z.string().trim().min(1).max(32).default('#3b82f6'),
	background: z
		.string()
		.trim()
		.min(1)
		.max(160)
		.default('linear-gradient(135deg, #eff6ff, #eef2ff)'),
	badges: z.array(z.string().trim().min(1).max(24)).max(5).default([]),
	metrics: z.array(prototypeCardMetricSchema).max(4).default([]),
});

export const prototypeOverlaySchema = z.object({
	type: z.literal('prototype'),
	title: z.string().trim().min(1).max(32).default('Prototype'),
	template: prototypeTemplateSchema.default('react'),
	files: z.record(z.string(), prototypeOverlayFileSchema).default({}),
	dependencies: z.record(z.string(), z.string()).default({}),
	preview: prototypeCardPreviewSchema.optional(),
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
