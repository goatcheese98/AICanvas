# Cloudflare Deployment Architecture

This document captures the current Cloudflare-oriented deployment shape of AI Canvas and the recommended path to make it more production-ready over time.

It is intentionally practical:

- `Current` describes what is actually represented in the repo today
- `Next` describes the highest-leverage improvements to make soon
- `Later` describes upgrades that are worth adding only when usage or scale justifies them

For the operational setup that wires this into CI/CD, see:

- `docs/deployment-runbook.md`

## Current

### Surfaces

AI Canvas currently has three deployable surfaces:

| Surface | Runtime | Repo location | Notes |
|---|---|---|---|
| Web app | Cloudflare Pages (intended) | `apps/web/` | Vite-built React SPA. Pages is documented in `ARCHITECTURE.md`, but the Pages deployment config is not checked in here. |
| API | Cloudflare Workers | `apps/api/` | Hono app deployed with Wrangler from `apps/api/wrangler.toml`. |
| Realtime collaboration | PartyKit | `workers/partykit/` | Separate realtime service for collaborative canvas sync. |

### Worker bindings

The API Worker currently depends on:

- `DB` — Cloudflare D1 database
- `R2` — Cloudflare R2 bucket
- `CLERK_SECRET_KEY` — Clerk auth
- optional Sentry config
- optional AI provider config for Anthropic, OpenRouter, and vectorization

Source of truth:

- `apps/api/wrangler.toml`
- `apps/api/src/types.ts`

### Storage model

The storage split is already well aligned with Cloudflare:

- D1 stores metadata and relational application state
- R2 stores larger blob-style assets

Current usage:

| Data type | Storage | Notes |
|---|---|---|
| Canvas metadata | D1 | Canvas title, description, ownership, favorite state, thumbnail URL, timestamps |
| Canvas scene JSON | R2 | Stored as per-canvas JSON blobs |
| Canvas thumbnails | R2 | PNG thumbnails stored separately from scene JSON |
| Assistant runs/tasks/artifacts metadata | D1 | Structured records and run history |
| Assistant-generated binary assets | R2 | Images and vectorized assets |

Relevant files:

- `apps/api/src/routes/canvas.ts`
- `apps/api/src/lib/storage/canvas-storage.ts`
- `apps/api/src/routes/assistant.ts`
- `apps/api/src/lib/storage/assistant-asset-storage.ts`
- `apps/api/src/lib/db/client.ts`

### Request flow

The current request path is:

1. The browser loads the SPA from the web deployment.
2. The SPA calls relative `/api/*` routes.
3. The API Worker authenticates the request with Clerk.
4. The Worker reads and writes D1 for metadata.
5. The Worker reads and writes R2 for canvas payloads, thumbnails, and assistant assets.
6. Collaboration traffic uses PartyKit WebSockets separately from the API.

In local development, Vite proxies `/api` to Wrangler dev:

- `apps/web/vite.config.ts`

### Observability

Cloudflare and Sentry are already wired into the API path:

- Worker invocation logs enabled
- Worker traces enabled
- Worker source map upload enabled
- request IDs added per request
- structured API logs emitted on request start and completion
- browser-to-server correlation via `x-client-request-id` and Sentry trace headers

Relevant files:

- `apps/api/wrangler.toml`
- `apps/api/src/middleware/request-context.ts`
- `apps/api/src/lib/observability.ts`
- `apps/api/src/index.ts`
- `apps/web/src/lib/observability.ts`
- `apps/web/src/lib/api.ts`

### Current strengths

The current architecture already gets several important things right:

- The API is edge-native and simple to reason about.
- D1 and R2 are used for the right classes of data.
- The frontend and API are loosely coupled enough to deploy independently.
- The collaboration service is isolated from normal API traffic.
- The observability foundation is strong enough to support production hardening.

### Current gaps

The main missing pieces are operational rather than architectural:

- no checked-in Pages deployment contract
- no explicit `staging` and `production` Worker environments in `wrangler.toml`
- no end-to-end deployment workflow for web, API, and PartyKit together
- no codified release strategy shared across Pages, Worker, and Sentry
- no Cloudflare-specific runbook for rollouts, migrations, and incident response

## Next

These are the recommended changes for the next phase. They improve reliability and deployment clarity without materially increasing system complexity.

### 1. Formalize environments

Add explicit Cloudflare environments for:

- `preview`
- `staging`
- `production`

For the API Worker, each environment should have:

- its own D1 database
- its own R2 bucket or a clearly namespaced equivalent
- its own Sentry environment value
- environment-specific AI provider settings

This should be encoded in `apps/api/wrangler.toml` instead of staying implicit.

### 2. Make the Pages deployment explicit

The repo currently documents Pages as the target but does not encode the deployment details in the tree.

The next step should define:

- the Pages build command
- the Pages output directory
- the production domain and preview URL shape
- how `/api/*` routes are mapped to the Worker in production
- which environment variables are required at build time versus runtime

This can live in deployment docs first, then in CI/CD configuration.

### 3. Standardize releases across the stack

Use one release identifier, ideally the git SHA, across:

- Pages build
- Worker deploy
- Sentry browser release
- Sentry Worker release

This makes it much easier to correlate a user issue to one rollout.

### 4. Add deploy automation

The repository currently has browser regression coverage, but not full deployment automation.

The next deployment workflow should:

1. run install, typecheck, tests, and builds
2. run API dry-run build
3. deploy the API Worker
4. deploy the web app
5. deploy PartyKit
6. run smoke checks
7. publish the release identifier to Sentry

### 5. Add production smoke checks

After each deployment, run a small set of checks:

- web app root loads
- `/api/health` returns success
- authenticated canvas fetch succeeds
- canvas save succeeds
- assistant thread or run creation succeeds
- PartyKit room connection succeeds

This catches integration failures that unit tests will not.

### 6. Expand operational observability

The next step is to move from raw telemetry to actionable monitoring:

- alert on Worker 5xx rate
- alert on D1 failures
- alert on R2 read/write failures
- alert on assistant run failure rate
- alert on frontend crash spikes

Add a small dashboard for:

- API request volume and latency
- canvas save latency and failure rate
- thumbnail upload failures
- assistant run duration and failure rate
- collaboration reconnect frequency

## Later

These changes are worth considering once usage or performance pressure makes them necessary.

### 1. Move long-running assistant work off the request path

The assistant route already behaves like a lightweight job system. As generated artifacts and model calls become slower or more frequent, move expensive execution onto a background path.

Good Cloudflare-native options:

- Cloudflare Queues for task dispatch
- Worker consumers for async execution
- keeping D1 as the source of truth for run/task state
- keeping R2 as the store for large generated outputs

This would keep the API request path responsive while preserving the existing data model.

### 2. Introduce direct upload patterns where useful

If user-uploaded assets or larger media files become common, consider shifting some uploads from:

- browser -> Worker -> R2

to:

- browser -> signed upload flow -> R2

That reduces Worker bandwidth pressure and request duration.

### 3. Add lifecycle policies for generated assets

Assistant-generated assets may not need permanent retention.

Later, define retention by asset class:

- permanent canvas assets
- short-lived intermediate assistant artifacts
- expirable debugging or preview outputs

This reduces R2 storage growth and simplifies cleanup.

### 4. Revisit database strategy only if measured latency requires it

The current choice of D1 is still a good one for this application.

Only revisit it if you observe:

- unacceptable read latency for globally distributed users
- workload patterns that are a poor fit for D1
- product requirements that clearly exceed the current consistency/performance envelope

Until then, keeping D1 is the lower-complexity choice.

### 5. Consider stronger collaboration observability or durability

If realtime collaboration becomes mission-critical for larger teams, the next area to assess is not necessarily replacing PartyKit, but strengthening its operational posture:

- connection and reconnect metrics
- room-level error tracking
- resync frequency monitoring
- clearer environment separation and release management for the collab service

## Target State

The target near-term production architecture should look like this:

```text
Cloudflare Pages
  -> serves the React SPA
  -> publishes preview and production builds

Cloudflare Worker (Hono API)
  -> authenticates requests
  -> reads and writes D1 metadata
  -> reads and writes R2 blobs
  -> emits logs, traces, and Sentry events

Cloudflare D1
  -> canvas metadata
  -> assistant run/task/artifact metadata
  -> user and waitlist records

Cloudflare R2
  -> canvas JSON blobs
  -> thumbnails
  -> assistant binary assets

PartyKit
  -> realtime collaboration transport
  -> separate deployment lifecycle from the main API
```

## Recommended Sequence

If making changes incrementally, use this order:

1. formalize `preview`, `staging`, and `production`
2. document and automate Pages + Worker + PartyKit deployment
3. standardize release IDs across Cloudflare and Sentry
4. add smoke checks and alerting
5. move long-running assistant work to a background path only when latency justifies it

That sequence keeps the architecture simple while removing the biggest operational risks first.
