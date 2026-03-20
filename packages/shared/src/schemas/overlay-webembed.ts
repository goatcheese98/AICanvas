import * as z from 'zod';

export const webEmbedOverlaySchema = z.object({
	type: z.literal('web-embed'),
	url: z.string().default(''),
});

export function normalizeWebEmbedOverlay(
	input?: Partial<z.input<typeof webEmbedOverlaySchema>> | null,
) {
	return webEmbedOverlaySchema.parse({
		type: 'web-embed',
		...(input ?? {}),
	});
}
