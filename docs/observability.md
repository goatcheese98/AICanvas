# Observability Setup

This project uses Cloudflare observability for Worker-side logs and traces, plus Sentry for frontend and backend error monitoring, tracing, and optional session replay.

## Why This Stack

Cloudflare is the fastest way to get request logs, trace visibility, and Worker source maps because the API already runs there.
Sentry is the easiest cross-stack layer for React errors, Worker exceptions, AI run failures, release tracking, and browser-to-server correlation.
Together they cover both "what broke in production?" and "what happened for this exact user/request?" without building a custom platform first.

## What Is Already Wired

- Worker request logs, traces, and source maps in [apps/api/wrangler.toml](/Users/rohanjasani/Desktop/Projects/CanvasTest/AICanvas/apps/api/wrangler.toml)
- API request IDs and structured logs in [apps/api/src/middleware/request-context.ts](/Users/rohanjasani/Desktop/Projects/CanvasTest/AICanvas/apps/api/src/middleware/request-context.ts)
- Worker-side Sentry in [apps/api/src/index.ts](/Users/rohanjasani/Desktop/Projects/CanvasTest/AICanvas/apps/api/src/index.ts)
- Browser-side Sentry in [apps/web/src/main.tsx](/Users/rohanjasani/Desktop/Projects/CanvasTest/AICanvas/apps/web/src/main.tsx)
- Browser request correlation in [apps/web/src/lib/api.ts](/Users/rohanjasani/Desktop/Projects/CanvasTest/AICanvas/apps/web/src/lib/api.ts)
- Optional Vite release and source-map upload in [apps/web/vite.config.ts](/Users/rohanjasani/Desktop/Projects/CanvasTest/AICanvas/apps/web/vite.config.ts)

## Required Env Vars

### API / Worker

- `SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SENTRY_RELEASE`

### Web Runtime

- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENVIRONMENT`
- `VITE_SENTRY_RELEASE`
- `VITE_SENTRY_TRACES_SAMPLE_RATE`
- `VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`
- `VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`

### Web Build Upload

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_RELEASE`

`VITE_SENTRY_RELEASE` should usually match `SENTRY_RELEASE` so browser events and uploaded source maps land on the same release.

## Suggested Release Convention

Use the git SHA, or a deploy identifier that includes it.

Examples:

- `SENTRY_RELEASE=$(git rev-parse --short HEAD)`
- `VITE_SENTRY_RELEASE=$(git rev-parse --short HEAD)`

## Local Development

You can leave Sentry unset locally and the app will still run.
If you want local Sentry testing, set the DSNs and use a low sample rate first.

Example web runtime values:

```bash
VITE_SENTRY_DSN=...
VITE_SENTRY_ENVIRONMENT=development
VITE_SENTRY_RELEASE=local-dev
VITE_SENTRY_TRACES_SAMPLE_RATE=1.0
VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0
VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1.0
```

Example Worker values:

```bash
SENTRY_DSN=...
SENTRY_RELEASE=local-dev
SENTRY_TRACES_SAMPLE_RATE=1.0
```

## Deployment Notes

The web build uploads source maps only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are set.
If those are missing, the build still succeeds and simply skips the upload step.

## How To Debug With It

1. Start with the browser error or breadcrumb trail in Sentry.
2. Copy the `x-request-id` from the failed API call or error message.
3. Search that request ID in Cloudflare Worker logs.
4. If the issue came from the assistant, also search by `assistant.run_id` or `assistant.task.id` in Sentry.

## Cost Control

Start with conservative defaults:

- browser traces: `0.1`
- browser replay session sampling: `0.02`
- browser replay on error: `1.0`
- Worker traces: `0.1`

Increase only after you know which flows need deeper visibility.
