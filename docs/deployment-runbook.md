# Deployment Runbook

This runbook describes the repository and platform setup required to deploy AI Canvas continuously.

It complements:

- `docs/cloudflare-deployment-architecture.md`
- `docs/observability.md`

## Deployment Targets

AI Canvas deploys as three surfaces:

| Surface | Target | Repo path |
|---|---|---|
| Web app | Cloudflare Pages | `apps/web/` |
| API | Cloudflare Workers | `apps/api/` |
| Collaboration | PartyKit | `workers/partykit/` |

## One-Time Platform Setup

### 1. Create Cloudflare resources

Provision these resources in Cloudflare:

- one Workers service for the API
- one D1 database bound as `DB`
- one R2 bucket bound as `R2`
- one Pages project for the web app

Then update `apps/api/wrangler.toml` with the real D1 database ID and R2 bucket name if the placeholder values are still present.

### 2. Create the PartyKit project

Provision the PartyKit project that serves the realtime collaboration worker.

The repository currently names that project in:

- `workers/partykit/partykit.json`

### 3. Configure Cloudflare runtime secrets for the API

The deploy workflow currently syncs:

- `CLERK_SECRET_KEY`

Other private runtime values can be managed one of two ways:

- add them to the deploy workflow secret sync list
- configure them directly in Cloudflare

## GitHub Configuration

### Required repository secrets

Configure these GitHub secrets before enabling the production deploy workflow:

| Secret | Used by | Purpose |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | API + Pages deploy | Authenticates Wrangler in CI |
| `CLERK_SECRET_KEY` | API Worker | Clerk backend auth |
| `VITE_CLERK_PUBLISHABLE_KEY` | Web build | Clerk frontend auth |
| `PARTYKIT_TOKEN` | PartyKit deploy | Authenticates PartyKit CLI |
| `PARTYKIT_LOGIN` | PartyKit deploy | PartyKit account/login identifier |

The Cloudflare account ID is already wired into the deploy workflow for this repository.

Optional but strongly recommended:

- `SENTRY_DSN`
- `VITE_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Optional provider secrets:

- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`
- `VECTORIZE_ASSET_API_KEY`

### Required repository variables

Configure these GitHub variables:

| Variable | Used by | Example |
|---|---|---|
| `CLOUDFLARE_PAGES_PROJECT_NAME` | Pages deploy | `ai-canvas-web` |
| `DEPLOY_WEB_URL` | Smoke checks | `https://app.example.com` |
| `DEPLOY_API_URL` | Smoke checks | `https://api.example.com` |
| `VITE_API_BASE_URL` | Web build | `https://api.example.com` |
| `VITE_PARTYKIT_HOST` | Web build | `collab.example.com` |

Optional GitHub variables:

| Variable | Used by | Example |
|---|---|---|
| `DEPLOY_PARTYKIT_HOST` | Smoke checks | `collab.example.com` |
| `PARTYKIT_TEAM` | PartyKit deploy | `your-team` |
| `VITE_SENTRY_ENVIRONMENT` | Web build | `production` |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | Web build | `0.1` |
| `VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE` | Web build | `0.02` |
| `VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | Web build | `1.0` |
| `SENTRY_TRACES_SAMPLE_RATE` | API deploy | `0.1` |

## Repository Files Added For Deployment

The deployment path in this repo now depends on:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-production.yml`
- `apps/web/wrangler.toml`
- `scripts/deploy-smoke-check.mjs`

## Workflow Behavior

### CI workflow

`ci.yml` runs:

1. install
2. typecheck
3. tests
4. builds

### Production deploy workflow

`deploy-production.yml` runs:

1. quality gate
2. API deploy
3. web build + Pages deploy
4. PartyKit deploy
5. smoke checks

It is triggered on:

- pushes to `main`
- manual `workflow_dispatch`

## Runtime Configuration Notes

### Web app

The web build now supports explicit deployment-time routing via:

- `VITE_API_BASE_URL`
- `VITE_PARTYKIT_HOST`

This is important because production deployments should not assume:

- API traffic is always same-origin
- PartyKit runs on `localhost:1999`

### API

The production deploy workflow injects these runtime vars on deploy:

- `ENVIRONMENT=production`
- `SENTRY_RELEASE=<git sha>`
- `SENTRY_TRACES_SAMPLE_RATE=<repo variable or default>`

If you want additional non-secret runtime vars to be managed in CI, add them to the deploy command in `.github/workflows/deploy-production.yml`.

If you want additional secret runtime values to be managed in CI, add them to the `secrets` list in that same workflow.

## Rollout Checklist

Before the first live deployment:

1. create the Pages project
2. create the Worker, D1 database, and R2 bucket
3. update `apps/api/wrangler.toml` with the real resource IDs and names
4. create the PartyKit project and note its production host
5. set the GitHub secrets and variables listed above
6. run the production workflow manually once
7. verify smoke checks pass
8. confirm Sentry receives browser and Worker events

## Rollback Guidance

If the API deployment needs to be rolled back, prefer Cloudflare Worker deployment rollback via Wrangler or the Cloudflare dashboard.

If the web deployment needs to be rolled back, redeploy the previous Pages artifact or commit.

If the PartyKit deployment needs to be rolled back, redeploy the previously known-good server version.

## Known Gaps

This setup gets the repository to a deployable, automatable state, but a few production hardening items are still intentionally left as follow-up work:

- authenticated smoke checks
- assistant end-to-end smoke checks
- preview and staging environments
- environment-specific D1/R2 resources beyond the current production path
