import { hc } from 'hono/client';
import type { AppType } from '@ai-canvas/api';

export async function getRequiredAuthHeaders(
	getToken: () => Promise<string | null>,
): Promise<Record<string, string>> {
	const token = await getToken();
	if (!token) {
		throw new Error('Sign in is required to access this resource.');
	}

	return {
		Authorization: `Bearer ${token}`,
	};
}

export const api = hc<AppType>('/');
