import * as Sentry from '@sentry/react';

const DEFAULT_TRACES_SAMPLE_RATE = 0.1;
const DEFAULT_REPLAYS_SESSION_SAMPLE_RATE = 0.02;
const DEFAULT_REPLAYS_ON_ERROR_SAMPLE_RATE = 1;

function parseSampleRate(rawValue: string | undefined, fallback: number) {
	if (!rawValue) return fallback;

	const parsed = Number.parseFloat(rawValue);
	if (Number.isNaN(parsed)) return fallback;

	return Math.min(Math.max(parsed, 0), 1);
}

function getEnvironment() {
	return import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;
}

export function getSentryTraceHeaders(): Record<string, string> {
	if (!isSentryEnabled()) {
		return {};
	}

	return Sentry.getTraceData() as Record<string, string>;
}

export function isSentryEnabled() {
	return Boolean(import.meta.env.VITE_SENTRY_DSN);
}

let initialized = false;

export function initObservability() {
	if (initialized || !isSentryEnabled()) {
		return;
	}

	Sentry.init({
		dsn: import.meta.env.VITE_SENTRY_DSN,
		environment: getEnvironment(),
		release: import.meta.env.VITE_SENTRY_RELEASE,
		tracesSampleRate: parseSampleRate(
			import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
			DEFAULT_TRACES_SAMPLE_RATE,
		),
		replaysSessionSampleRate: parseSampleRate(
			import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
			DEFAULT_REPLAYS_SESSION_SAMPLE_RATE,
		),
		replaysOnErrorSampleRate: parseSampleRate(
			import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
			DEFAULT_REPLAYS_ON_ERROR_SAMPLE_RATE,
		),
		integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
		sendDefaultPii: false,
	});

	initialized = true;
}

interface CaptureOptions {
	tags?: Record<string, string>;
	extra?: Record<string, unknown>;
}

export function captureBrowserException(error: unknown, options: CaptureOptions = {}) {
	if (!isSentryEnabled()) {
		return;
	}

	Sentry.withScope((scope) => {
		for (const [key, value] of Object.entries(options.tags ?? {})) {
			scope.setTag(key, value);
		}

		for (const [key, value] of Object.entries(options.extra ?? {})) {
			scope.setExtra(key, value);
		}

		Sentry.captureException(error);
	});
}

export function addObservabilityBreadcrumb(
	message: string,
	data: Record<string, unknown>,
	level: Sentry.SeverityLevel = 'info',
) {
	if (!isSentryEnabled()) {
		return;
	}

	Sentry.addBreadcrumb({
		category: 'api',
		message,
		level,
		data,
	});
}
