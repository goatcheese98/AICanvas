import * as z from 'zod';

export const userPreferencesSchema = z.object({
	theme: z.enum(['light', 'dark', 'system']).default('system'),
	defaultCanvasBackground: z.string().optional(),
	aiProvider: z.enum(['claude', 'gemini']).default('claude'),
});

export const userSchemas = {
	preferences: userPreferencesSchema,
} as const;

export type UserPreferences = z.infer<typeof userPreferencesSchema>;
