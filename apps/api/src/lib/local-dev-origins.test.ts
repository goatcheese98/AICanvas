import { describe, expect, it } from 'vitest';
import {
	DEFAULT_LOCAL_DEV_ORIGINS,
	DEFAULT_PUBLIC_ORIGINS,
	getAuthorizedParties,
	getCorsAllowedOrigins,
	parseOriginList,
} from './local-dev-origins';

describe('local-dev-origins', () => {
	it('parses comma-separated origin lists', () => {
		expect(parseOriginList(' http://localhost:5173, ,https://roopstudio.com ')).toEqual([
			'http://localhost:5173',
			'https://roopstudio.com',
		]);
	});

	it('returns the main lane when cors origins are unset in development', () => {
		expect(getCorsAllowedOrigins(undefined, 'development')).toEqual([
			...DEFAULT_LOCAL_DEV_ORIGINS,
			...DEFAULT_PUBLIC_ORIGINS,
		]);
	});

	it('uses configured development cors origins as-is', () => {
		expect(
			getCorsAllowedOrigins('http://localhost:5173,https://preview.example.com', 'development'),
		).toEqual(['http://localhost:5173', 'https://preview.example.com']);
	});

	it('keeps production cors origins scoped to the configured list', () => {
		expect(
			getCorsAllowedOrigins('https://roopstudio.com,https://staging.example.com', 'production'),
		).toEqual(['https://roopstudio.com', 'https://staging.example.com']);
	});

	it('does not pass authorized parties unless they are explicitly configured', () => {
		expect(getAuthorizedParties(undefined, 'development')).toEqual([]);
	});

	it('uses configured development authorized parties as-is', () => {
		expect(
			getAuthorizedParties('http://localhost:5173,https://roopstudio.com', 'development'),
		).toEqual(['http://localhost:5173', 'https://roopstudio.com']);
	});

	it('keeps production authorized parties scoped to the configured list', () => {
		expect(
			getAuthorizedParties('https://roopstudio.com,https://www.roopstudio.com', 'production'),
		).toEqual(['https://roopstudio.com', 'https://www.roopstudio.com']);
	});
});
