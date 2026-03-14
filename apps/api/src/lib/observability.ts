import * as Sentry from '@sentry/cloudflare';
import type { Context } from 'hono';
import type { AppEnv, AuthUser } from '../types';

type ApiLogLevel = 'info' | 'warn' | 'error';

export interface ApiLogFields {
	requestId?: string;
	clientRequestId?: string;
	method?: string;
	path?: string;
	status?: number;
	durationMs?: number;
	userId?: string;
	canvasId?: string;
	threadId?: string;
	runId?: string;
	taskId?: string;
	[key: string]: unknown;
}

function serializeError(error: unknown) {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}

	return error;
}

function sanitizeValue(value: unknown): unknown {
	if (value instanceof Error) {
		return serializeError(value);
	}

	if (Array.isArray(value)) {
		return value.map((entry) => sanitizeValue(entry));
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
				key,
				sanitizeValue(entry),
			]),
		);
	}

	return value;
}

export function parseSampleRate(rawValue: string | undefined, fallback: number) {
	if (!rawValue) return fallback;

	const parsed = Number.parseFloat(rawValue);
	if (Number.isNaN(parsed)) return fallback;

	return Math.min(Math.max(parsed, 0), 1);
}

export function logApiEvent(level: ApiLogLevel, event: string, fields: ApiLogFields = {}) {
	const sanitizedFields = sanitizeValue(fields) as Record<string, unknown>;
	const payload = {
		timestamp: new Date().toISOString(),
		level,
		event,
		...sanitizedFields,
	};
	const line = JSON.stringify(payload);

	if (level === 'error') {
		console.error(line);
		return;
	}

	if (level === 'warn') {
		console.warn(line);
		return;
	}

	console.log(line);
}

export function applySentryRequestContext(c: Context<AppEnv>, requestId: string) {
	const clientRequestId = c.req.header('x-client-request-id') ?? undefined;
	Sentry.setTag('request_id', requestId);
	Sentry.setTag('http.method', c.req.method);
	Sentry.setTag('http.path', c.req.path);
	if (clientRequestId) {
		Sentry.setTag('client_request_id', clientRequestId);
	}
	Sentry.setContext('request', {
		request_id: requestId,
		client_request_id: clientRequestId,
		method: c.req.method,
		path: c.req.path,
	});
}

export function applySentryUserContext(user: AuthUser) {
	Sentry.setUser({
		id: user.id,
		email: user.email,
		username: user.name,
	});
	Sentry.setTag('user_id', user.id);
}

export function getRequestLogFields(c: Context<AppEnv>, extras: ApiLogFields = {}): ApiLogFields {
	const requestStartedAt = c.get('requestStartedAt');
	const durationMs =
		typeof requestStartedAt === 'number' ? Math.max(0, Date.now() - requestStartedAt) : undefined;

	return {
		requestId: c.get('requestId'),
		clientRequestId: c.get('clientRequestId'),
		method: c.req.method,
		path: c.req.path,
		durationMs,
		...extras,
	};
}
