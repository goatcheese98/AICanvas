import * as z from 'zod';

const waitlistEmailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.email('Enter a valid work email address.');

export const joinWaitlistSchema = z.object({
	email: waitlistEmailSchema,
	source: z.enum(['landing-hero', 'landing-footer']),
});

export const joinWaitlistResponseSchema = z.object({
	status: z.enum(['created', 'duplicate']),
	message: z.string().min(1),
});

export const waitlistSchemas = {
	join: joinWaitlistSchema,
	response: joinWaitlistResponseSchema,
} as const;

export type JoinWaitlist = z.infer<typeof joinWaitlistSchema>;
export type JoinWaitlistResponse = z.infer<typeof joinWaitlistResponseSchema>;
