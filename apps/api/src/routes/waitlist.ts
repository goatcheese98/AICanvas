import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { waitlistSchemas } from '@ai-canvas/shared/schemas';
import { createDb } from '../lib/db/client';
import { waitlistSubscriptions } from '../lib/db/schema';
import type { AppEnv } from '../types';

function isUniqueWaitlistEmailError(error: unknown): boolean {
	return (
		error instanceof Error && error.message.includes('waitlist_subscriptions_email_unique')
	);
}

export const waitlistRoutes = new Hono<AppEnv>().post(
	'/',
	zValidator('json', waitlistSchemas.join),
	async (c) => {
		const { email, source } = c.req.valid('json');
		const db = createDb(c.env.DB);

		const existing = await db.query.waitlistSubscriptions.findFirst({
			where: eq(waitlistSubscriptions.email, email),
			columns: { id: true },
		});

		if (existing) {
			return c.json(waitlistSchemas.response.parse({
				status: 'duplicate',
				message: "You're already on the RoopStudio waitlist.",
			}));
		}

		try {
			await db.insert(waitlistSubscriptions).values({
				id: crypto.randomUUID(),
				email,
				source,
			});
		} catch (error) {
			if (isUniqueWaitlistEmailError(error)) {
				return c.json(waitlistSchemas.response.parse({
					status: 'duplicate',
					message: "You're already on the RoopStudio waitlist.",
				}));
			}

			throw error;
		}

		return c.json(
			waitlistSchemas.response.parse({
				status: 'created',
				message: "Thanks for joining. We'll be in touch soon.",
			}),
			201,
		);
	},
);
