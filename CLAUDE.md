# AI Canvas

Visual workspace combining whiteboarding, notes, tasks, and AI assistance.

This file is the source of truth for AI Canvas agent workflow.

## Monorepo Structure

Bun workspace with three packages:

- `apps/web`         React 19 SPA (Vite, TanStack Router, Zustand, Tailwind v4)
- `apps/api`         Hono API on Cloudflare Workers (Drizzle, D1, R2, Clerk)
- `packages/shared`  Zod schemas, inferred types, and constants shared by both

## Default Stance

Do more work per prompt.

Start from the assumption that the user wants execution, not caution theater. Make the biggest
reasonable improvement the prompt supports. Bundle the adjacent cleanup, follow-through, refactor,
test, and polish that make the result actually feel finished.

Be creative, opinionated, and high-agency:

- take a real swing when the path is visible
- fix nearby issues when they are part of the same flow
- prefer finished outcomes over narrow literalism
- choose and execute instead of listing options
- push back when the request conflicts with the product, codebase, or stated direction
- implement the better version when the tradeoff is clearly favorable
- ask only when a decision would materially change product direction, delete important data, or
  create expensive rework

When the prompt is underspecified, make the best reasonable assumption, note it briefly, and keep
going.

## Product Momentum

Optimize for useful product progress. Good execution may include fixing nearby issues, tightening
UI states, adding tests, simplifying code, or refactoring locally when the current shape blocks the
outcome. Avoid polishing unrelated areas.

## Tracking

Do not use `bd` / Beads for routine tracking yet. Keep execution state in the current conversation
and in the final summary. If follow-up work is discovered, state it clearly at the end.

## Completion Standard

Report what changed, what was verified, and what remains unverified. Keep it concise and concrete.

- surface invalid state clearly
- avoid silent fallbacks that produce confusing behavior
- name the exact command, test, or manual path used for verification
- if automated tests were not run or added, say why

## Shared (`packages/shared`)

- Zod schemas are the source of truth. Infer TypeScript types from them — never hand-write a type
  that duplicates a schema.
- No `any`. Use `unknown` and narrow with Zod.
- No React, no DOM, no Node-specific APIs — this package runs in both Workers and browser.
- Import only from explicit subpaths: `@ai-canvas/shared/schemas`, `/types`, `/constants`.

## API (`apps/api`)

- Validate all inputs with `zValidator` using schemas from `@ai-canvas/shared/schemas`.
- Always access auth via `c.get('user')` set by `requireAuth` — never re-verify inline.
- Create the DB client per request via `createDb(c.env.DB)` — do not cache across requests.
- Type safety chain: Zod schema → `zValidator` → `AppType` export → `hc<AppType>` on the
  frontend. No codegen, no manual type duplication.
- Return typed JSON with correct HTTP status codes (201 create, 409 conflict, 404 not found).

## Web (`apps/web`)

- Overlay components follow the Container/Hook/Child pattern. Normalize `customData` once at the
  container boundary — never in children.
- Zustand owns client state; TanStack Query owns server state. Never mix them.
- Tailwind v4 for all styles. `style={}` only for dynamic/computed values (positions, dimensions
  from state). No CSS modules, no styled-components.
- Import from `@ai-canvas/shared` always using explicit subpaths. No raw `fetch` to the API —
  use the typed Hono RPC client in `src/lib/api.ts`.
- Every bug fix gets a regression test. Every new utility gets unit tests.
