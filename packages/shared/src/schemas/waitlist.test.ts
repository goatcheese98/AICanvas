import { describe, expect, it } from 'vitest';
import { waitlistSchemas } from './waitlist';

describe('waitlist schemas', () => {
	it('normalizes email addresses for waitlist submissions', () => {
		expect(
			waitlistSchemas.join.parse({
				email: '  HELLO@Example.COM ',
				source: 'landing-hero',
			}),
		).toEqual({
			email: 'hello@example.com',
			source: 'landing-hero',
		});
	});

	it('requires a valid email address', () => {
		const result = waitlistSchemas.join.safeParse({
			email: 'not-an-email',
			source: 'landing-footer',
		});

		expect(result.success).toBe(false);
	});
});
