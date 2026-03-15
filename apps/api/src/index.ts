import * as Sentry from '@sentry/cloudflare';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { canvasRoutes } from './routes/canvas';
import { assistantRoutes } from './routes/assistant';
import { getRequestLogFields, logApiEvent, parseSampleRate } from './lib/observability';
import { requestContext } from './middleware/request-context';
import { userRoutes } from './routes/user';
import { waitlistRoutes } from './routes/waitlist';
import type { AppEnv } from './types';

const DEFAULT_ALLOWED_ORIGINS = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'https://roopstudio.com',
	'https://www.roopstudio.com',
];

function getAllowedOrigins(bindings: AppEnv['Bindings']) {
	const configuredOrigins = bindings.CORS_ALLOWED_ORIGINS?.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	return configuredOrigins && configuredOrigins.length > 0
		? configuredOrigins
		: DEFAULT_ALLOWED_ORIGINS;
}

const app = new Hono<AppEnv>()
	.use('*', requestContext)
	.use('*', logger())
	.use(
		'*',
		async (c, next) =>
			cors({
				origin: getAllowedOrigins(c.env),
				credentials: true,
			})(c, next),
	)
	.route('/api/canvas', canvasRoutes)
	.route('/api/assistant', assistantRoutes)
	.route('/api/user', userRoutes)
	.route('/api/waitlist', waitlistRoutes)
	.onError((error, c) => {
		const requestId = c.get('requestId');
		const status = error instanceof HTTPException ? error.status : 500;

		logApiEvent(
			status >= 500 ? 'error' : 'warn',
			'request.failed',
			getRequestLogFields(c, {
				status,
				error,
			}),
		);

		if (error instanceof HTTPException) {
			c.header('x-request-id', requestId);
			return error.getResponse();
		}

		Sentry.captureException(error, {
			tags: {
				request_id: requestId,
			},
		});
		c.header('x-request-id', requestId);
		return c.json(
			{
				error: 'Internal Server Error',
				requestId,
			},
			500,
		);
	})
	.get('/api/health', (c) => c.json({ status: 'ok' }));

export type AppType = typeof app;
const workerHandler: ExportedHandler<AppEnv['Bindings']> = {
	fetch: app.fetch,
};

export default Sentry.withSentry(
	(env: AppEnv['Bindings']) =>
		env.SENTRY_DSN
				? {
						dsn: env.SENTRY_DSN,
						environment: env.ENVIRONMENT,
						release: env.SENTRY_RELEASE,
						tracesSampleRate: parseSampleRate(
							env.SENTRY_TRACES_SAMPLE_RATE,
							env.ENVIRONMENT === 'production' ? 0.1 : 1,
					),
					sendDefaultPii: false,
					integrations: [Sentry.honoIntegration()],
				}
			: undefined,
	workerHandler,
);
