# Authentication Setup

AI Canvas uses [Clerk](https://clerk.com) for authentication. This document describes the Clerk configuration for both local development and production.

## Instances

Two separate Clerk instances are used:

| Instance | Type | Used by |
|---|---|---|
| Development | `pk_test_...` / `sk_test_...` | Local dev (`localhost:5173` for main, `localhost:5181+` for execution lanes) |
| Production | `pk_live_...` / `sk_live_...` | `roopstudio.com` |

Both live under the same Clerk application (`RoopStudio`). Switching between them is done via the instance selector in the Clerk dashboard.

## Local Development

### Environment files

Two files are needed for local dev:

**`apps/web/.env.local`** (Vite frontend):
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_PARTYKIT_HOST=localhost:1999
```

**`apps/api/.dev.vars`** (Wrangler / Worker):
```
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
API_PORT=8787
ANTHROPIC_API_KEY=sk-ant-...
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://roopstudio.com,https://www.roopstudio.com
CLERK_AUTHORIZED_PARTIES=http://localhost:5173,http://127.0.0.1:5173
```

These files are intentionally gitignored, so `git worktree add` does not copy
them into fresh sibling worktrees by itself.

For the integration lane, keep the backend matched to `5173`/`8787`.
For execution worktrees, use dedicated matching pairs like `5181`/`8791`, `5182`/`8792`, then continue upward as
needed, and set that worktree's `CORS_ALLOWED_ORIGINS` / `CLERK_AUTHORIZED_PARTIES` to its own frontend port.

Both `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_PUBLISHABLE_KEY` should use the **development** instance keys (`pk_test_...`, `sk_test_...`).

### Local D1 database

Wrangler creates a fresh SQLite file under `.wrangler/state/v3/d1/` for each
worktree's local API runtime. If the `users` table is missing or stale, the UI
may show a misleading `Authentication failed` error even though the real problem
is local database state.

`bun run dev` in `apps/api` now applies local D1 migrations before starting
Wrangler, so fresh worktrees self-heal automatically in the normal dev flow.

If you ever need to repair the local database manually, you can still run:

```sh
bun run db:migrate
```

## Production Setup

### Clerk production instance

The production Clerk instance requires domain verification before it can be used. This is a one-time step.

#### DNS records

Add these CNAME records to your DNS provider (all must be **DNS only**, not proxied):

| Name | Target |
|---|---|
| `clerk` | `frontend-api.clerk.services` |
| `accounts` | `accounts.clerk.services` |
| `clkmail` | `mail.<instance-id>.clerk.services` |
| `clk._domainkey` | `dkim1.<instance-id>.clerk.services` |
| `clk2._domainkey` | `dkim2.<instance-id>.clerk.services` |

The exact targets for `clkmail` and the DKIM records are shown in **Clerk Dashboard → Production → Configure → Domains → DNS Records**.

If using Cloudflare DNS: set proxy status to **DNS only** (grey cloud) for all five records. Clerk handles its own TLS.

After adding records, click **Verify configuration** in the Clerk dashboard. DNS propagation on Cloudflare is typically instant.

#### Google OAuth

The production Clerk instance requires its own Google OAuth credentials. The development instance uses Clerk's shared credentials, but production does not.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create or select a project
2. **Google Auth Platform → Clients → Create client**
   - Application type: Web application
   - Authorized redirect URI: `https://clerk.roopstudio.com/v1/oauth_callback`
   - JavaScript origins: leave blank
3. Copy the Client ID and Client Secret
4. In Clerk dashboard → **Production → Configure → User & Authentication → SSO connections → Google**
   - Enable Google, paste Client ID and Client Secret
5. In Google Cloud → **Google Auth Platform → Audience** → publish the app (moves it out of test-user-only mode)

### GitHub secrets and variables

These must be set on the GitHub repository before the production deploy workflow will work:

**Secrets:**

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Worker + Pages + D1 + R2 permissions |
| `CLERK_SECRET_KEY` | Production Clerk secret key (`sk_live_...`) |
| `CLERK_JWT_KEY` | Production Clerk JWKS public key (from Clerk Dashboard → API keys → JWKS Public Key) |
| `ANTHROPIC_API_KEY` | Anthropic API key |

**Variables:**

| Variable | Value |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Production Clerk publishable key (`pk_live_...`) |
| `VITE_API_BASE_URL` | `https://api.roopstudio.com` |
| `VITE_PARTYKIT_HOST` | Production PartyKit host |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | `ai-canvas-web` |
| `DEPLOY_WEB_URL` | `https://roopstudio.com` |
| `DEPLOY_API_URL` | `https://api.roopstudio.com` |

Note: `VITE_CLERK_PUBLISHABLE_KEY` is used by the deploy workflow for both the web build and as the `CLERK_PUBLISHABLE_KEY` var on the Worker.

### Applying D1 migrations to production

Migrations are **not** applied automatically by the deploy workflow. They must be applied manually when the production database is first provisioned and whenever new migrations are generated:

```sh
npx wrangler d1 migrations apply ai-canvas-db --remote
```

This is a required one-time step on first deploy. Skipping it causes `Authentication failed` (500) on every request because the `users` table does not exist.

## Auth Flow

The auth middleware (`apps/api/src/middleware/auth.ts`) follows this path on every authenticated request:

1. Extract the bearer token from the `Authorization` header
2. Call Clerk's `verifyToken` to validate the JWT — uses `CLERK_JWT_KEY` for local verification if set and non-empty, otherwise fetches JWKS from Clerk's servers
3. Look up the user in the local D1 `users` table by Clerk user ID
4. If found: use the stored profile (no Clerk API call)
5. If not found: call `clerk.users.getUser()`, sync the result to D1, then proceed

Returning users avoid the Clerk API call entirely. New users incur one Clerk API call on first sign-in, which also syncs their profile to D1.

### Email uniqueness

The `users.email` column has a unique constraint. If a user signs in with a Clerk instance they haven't used before (e.g. after a Clerk instance migration), their new Clerk user ID won't match any existing D1 row, but their email may already exist under a different ID. `syncAuthenticatedUser` handles this by deleting the stale row before inserting the new one (`apps/api/src/lib/auth/sync-user.ts`).

## CLERK_JWT_KEY

`CLERK_JWT_KEY` is optional. When present and non-empty, `verifyToken` verifies tokens locally without a network call. When absent, it fetches the JWKS from Clerk's servers on each verification.

In production, providing `CLERK_JWT_KEY` makes auth faster and more resilient (no dependency on Clerk's JWKS endpoint). The key is available in **Clerk Dashboard → API keys → JWKS Public Key**.

The deploy workflow syncs it as a Worker secret alongside `CLERK_SECRET_KEY`.
