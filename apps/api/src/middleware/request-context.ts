import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types';
import { applySentryRequestContext, getRequestLogFields, logApiEvent } from '../lib/observability';

export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
	const requestId = crypto.randomUUID();
	const clientRequestId = c.req.header('x-client-request-id') ?? undefined;
	c.set('requestId', requestId);
	if (clientRequestId) {
		c.set('clientRequestId', clientRequestId);
	}
	c.set('requestStartedAt', Date.now());
	c.header('x-request-id', requestId);
	applySentryRequestContext(c, requestId);

	logApiEvent('info', 'request.started', getRequestLogFields(c));

	await next();

	c.header('x-request-id', requestId);
	logApiEvent(
		c.res.status >= 500 ? 'error' : c.res.status >= 400 ? 'warn' : 'info',
		'request.completed',
		getRequestLogFields(c, {
			status: c.res.status,
		}),
	);
});
