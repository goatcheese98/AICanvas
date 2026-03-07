import { describe, expect, it, vi } from 'vitest';
import { getRequiredAuthHeaders } from './api';

describe('getRequiredAuthHeaders', () => {
	it('returns a bearer token header', async () => {
		const headers = await getRequiredAuthHeaders(vi.fn().mockResolvedValue('test-token'));

		expect(headers).toEqual({
			Authorization: 'Bearer test-token',
		});
	});

	it('throws when no token is available', async () => {
		await expect(getRequiredAuthHeaders(vi.fn().mockResolvedValue(null))).rejects.toThrow(
			'Sign in is required to access this resource.',
		);
	});
});
