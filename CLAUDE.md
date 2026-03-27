# AI Canvas

This file intentionally mirrors `CLAUDE.md` so Codex and Claude receive the same project guidance. Keep both files aligned unless a tool-specific difference is genuinely useful.

AI Canvas is a standalone collaborative canvas application built on Excalidraw with a custom overlay system for rich content (markdown notes, kanban boards, code editors, web embeds, prototypes). It is its own product with its own foundation — not a port or fork of another project.

## Monorepo Layout

```
apps/web/          React 19 SPA (Vite, TanStack Router, Zustand)
apps/api/          Hono API on Cloudflare Workers (Drizzle, D1, R2)
packages/shared/   Zod schemas, TypeScript types, constants — shared by web + api
workers/partykit/  Real-time collaboration server (E2E encrypted WebSocket)
docs/              Architecture and pattern documentation
```

## Commands

```sh
bun install                # install dependencies
bun run dev                # start all apps (Web + API + PartyKit via Turbo)
# Note: First time, run `cd apps/api && bun run dev` to apply DB migrations,
# then stop and use `bun run dev` from root for subsequent runs.
bun run build              # build all packages (turbo)
bun run test               # run all tests (turbo, vitest)
bun run typecheck           # typecheck all packages (turbo)
bun run lint               # lint all files (biome)
bun run lint:fix           # lint and auto-fix (biome)
bun run format             # format all files (biome)
bun run db:generate        # generate Drizzle migrations
bun run db:migrate         # run Drizzle migrations against local D1
```

**Production D1 migrations** are not applied automatically by the deploy workflow. Run this manually after generating new migrations or on first deploy:

```sh
npx wrangler d1 migrations apply ai-canvas-db --remote
```

Run a single package: `bun run test --filter=@ai-canvas/web`

## Anti-Slop Manifesto

This repository does not reward volume, cleverness, or abstraction for its own sake.

## Code Economy

Code is not free. Every new line adds maintenance cost, review surface, and future debugging burden.

Prefer:

- direct edits over new layers
- existing paths over parallel paths
- simplification over expansion
- deletion over addition when both solve the problem
- straightforward code over reusable-looking machinery

Do not add code unless it clearly improves at least one of these:

- correctness
- clarity
- observability
- maintainability
- verification

Do not introduce helpers, abstractions, or structure that cost more to carry than they save.

A change is better when it solves the problem with fewer moving parts.

## What To Resist

- Resist abstraction before there is real pressure for it.
- Resist helpers, wrappers, hooks, services, and layers that mainly move code around.
- Resist "reusable" designs that make today's change harder to understand.
- Resist solving the generalized version of the problem.
- Resist widening scope to clean up nearby code unless it is truly necessary.
- Resist hiding important behavior behind indirection.
- Resist magic defaults, silent fallbacks, and invisible state changes.
- Resist changes that require reading many files to understand one behavior.
- Resist architecture that signals sophistication without improving clarity.
- Resist adding code when deletion, simplification, or a direct edit would do.

## Local Reasoning Standard

A change is better when a reviewer can understand it by reading the changed files alone.

Prefer:

- behavior defined close to where it is used
- state changes that are easy to trace
- control flow that is obvious from the code
- errors that fail clearly
- boundaries that make debugging easier, not harder

If a change spreads a small idea across too many places, it is probably the wrong shape.

## Observability Standard

The code should make it easy to answer:

- What happened?
- Where did it happen?
- Why did it happen?
- What state changed?
- How do we verify it?

If a change makes these questions harder to answer, it is likely too abstract, too indirect, or too broad.

## Slop Signals

Reject patterns like:

- broad exception handling that hides failure
- wrappers or helpers that add indirection without reducing complexity
- abstractions introduced for hypothetical reuse
- functions with hidden mutations
- "cleaner" designs that spread a local change across many files
- vague verification like "appears to work" without a named check

## Loud Failure Rule

Do not hide invalid state behind silent fallbacks.

If required data is missing, invariants are broken, or a state transition is invalid, raise or surface an explicit error close to the source.

Do not swallow exceptions unless all of the following are true:

- the failure is expected
- the recovery path is intentional
- the failure is logged or otherwise observable

A visible failure is better than a silent wrong state.

## Side Effect Visibility

Prefer data in, data out code.

Functions should not hide important state changes.

If a function mutates state, that mutation should be:

- explicit in the function's purpose
- visible at the call site
- easy to infer from the function name

Do not hide writes inside helpers that sound read only or neutral.

## Verification Standard

Every change must include a concrete verification statement.

State:

- what was checked
- how it was checked
- what remains unverified

Do not claim confidence without naming the test, assertion, command, or manual path used to verify the change.

If no automated test was added, explain why.

## Final Self-Check

Before finalizing, ask:

- Is this the smallest correct change?
- Did I add code that will cost more to maintain than it saves?
- Did I keep the behavior easy to trace and debug?
- Can someone understand this without reading half the codebase?
- Did I solve the actual problem instead of a more impressive one?
- Did I add any abstraction that exists mostly to make the code look engineered?

## Additional Guidance

- Good code is small, explicit, easy to debug, and restrained enough to solve the real problem and stop there.
- Prefer the smallest correct change with the fewest moving parts.
- Follow existing patterns unless there is a strong reason not to.
- Make uncertainty explicit instead of guessing.
- Abstraction is a cost, not a reward, and should exist only when it clearly improves understanding, diagnosis, or shared boundaries.
- Treat every new dependency as a permanent maintenance tax and avoid adding one for a trivial utility.
- Names should make behavior easier to understand without reading the implementation.
- Before editing, briefly state the intended change and what will not be touched.
- File size is a heuristic, not a law; split code when size harms cohesion, readability, or local reasoning.
- Explain completed work for an intelligent non-programmer first, then include technical detail.

## Code Style

- **Formatter:** Biome — tabs, single quotes, semicolons, 100-char line width
- **Imports:** Biome auto-organizes. Use `@ai-canvas/shared/schemas`, `@ai-canvas/shared/types`, `@ai-canvas/shared/constants` for shared code. Use `@/` path alias for intra-app imports. Use `./` for siblings.
- **Naming:** PascalCase for components (`KanbanBoard.tsx`). kebab-case for utilities (`kanban-utils.ts`). camelCase with `use` prefix for hooks (`useKanbanBoardState.ts`). kebab-case with `-types` suffix for local type files (`kanban-board-types.ts`).
- **Styling:** Tailwind CSS v4 only. Use CSS variables for design tokens (`var(--color-accent-bg)`). No CSS modules. Inline `style={}` only for dynamic/computed values.
- **Types:** No `any`. Biome warns on `noExplicitAny`. Use Zod schemas in `packages/shared/src/schemas/` for runtime validation; infer TypeScript types from them.
- **File size:** Treat 300-400 lines as a split candidate when cohesion or local reasoning is degrading.

## Overlay System — The Core Abstraction

Overlays are rich content panels rendered on the Excalidraw canvas (markdown notes, kanban boards, lexical editors, web embeds, prototypes). They are the primary unit of product complexity.

### Overlay authoring pattern

Every complex overlay follows the Container/Hook/Child pattern. Full specification: `docs/overlay-authoring-pattern.md`

**Structure:**

```
overlays/<type>/
  <Type>Container.tsx       # Element integration, persistence, top-level layout (~100 lines)
  use<Type>State.ts         # Draft state, external sync, debounced commits, derived views
  <Type>.tsx                # Main presentational component
  <FocusedChild>.tsx        # Toolbars, settings panels, dialogs, display sections
  <type>-utils.ts           # Pure helpers: normalize, serialize, project
  <type>-types.ts           # Local type wrappers
  index.ts                  # Single named export
```

**Canonical example:** `apps/web/src/components/overlays/kanban/` — this is the reference implementation. When in doubt about how to structure an overlay, match the kanban pattern.

**Rules:**
- Normalize `customData` once at the container boundary
- Keep persisted writes behind one `onChange` callback
- Keep edit lifecycle behind one `onEditingChange` callback
- Persisted domain state and transient UI state must not be mixed
- Mutation helpers must be pure functions (testable without rendering)
- Do not add new code using monolithic patterns — see anti-patterns below

### Overlay registration

- Overlay types are defined in `packages/shared/src/types/overlay.ts` as a discriminated union
- Overlay schemas and normalizers live in `packages/shared/src/schemas/overlay.ts`
- Overlay rendering is wired through `apps/web/src/components/canvas/overlay-definitions.tsx`
- Element factories live in `apps/web/src/components/canvas/element-factories.ts`

## State Management

- **Global state:** Zustand store composed from slices (`canvasSlice`, `chatSlice`, `uiSlice`) in `apps/web/src/stores/`
- **Server state:** TanStack Query for API data (cache, dedup, background refresh)
- **Local component state:** `use<Type>State.ts` hooks own draft state, sync with external data via refs, debounce commits
- **Shared types/schemas:** Always defined in `packages/shared/`, never duplicated in app code

## API Layer

- Hono routes in `apps/api/src/routes/` with Zod input validation
- Hono RPC client on the frontend for end-to-end type safety (no codegen)
- Auth via Clerk middleware in `apps/api/src/middleware/auth.ts`
- Database: Drizzle ORM over Cloudflare D1
- Blob storage: Cloudflare R2 (canvas JSON, thumbnails, assets)

## Testing

Tests are colocated with the code they verify (`.test.ts` / `.test.tsx` next to source files).

- **Pure helpers and transforms:** Unit tests, no rendering
- **Hooks:** `renderHook` from React Testing Library
- **Components:** `render` from React Testing Library
- **Bug fixes:** Always add a regression test
- Runner: Vitest

## Anti-Patterns — Do Not Do These

- **Monolithic overlay components.** Do not put state management, persistence, and large JSX in one file. Follow the Container/Hook/Child pattern.
- **Mixed old/new patterns.** If you see two ways to do something, use the newer pattern (the one matching `docs/overlay-authoring-pattern.md`). Do not copy from older code.
- **CSS modules or styled-components.** Use Tailwind utility classes and CSS variables.
- **`any` types.** Use proper types or Zod inference.
- **Duplicating shared types.** If a type is used by both web and api, it belongs in `packages/shared/`.
- **Direct Excalidraw scene JSON from AI.** The assistant emits semantic mutations, not raw scene data.
- **Large incoherent files.** Split when size harms cohesion, readability, or local reasoning. Extract UI regions first, then move state into hooks.

## Worktree Workflow (Pragmatic)

For parallel development with AI assistance. See `docs/workflow-pragmatic.md` for full details.

### Quick Start

```sh
# Create a new worktree
bun run worktree:new -- my-feature

# In the new worktree, start all services
cd ../AICanvas-my-feature
bun run dev
```

This starts via Turbo:
- **Web** (React frontend) → http://localhost:5181
- **API** (Hono backend) → http://localhost:8791
- **PartyKit** (WebSocket collaboration) → http://localhost:1999

### Key Principles

- **Main worktree** (`AICanvas`): Your primary workspace on `main` branch
- **Side worktrees** (`AICanvas-*`): 0-2 at a time, short-lived tasks, quick merges
- **One command:** `bun run dev` starts everything (Web + API + PartyKit)
- **One log stream:** All logs labeled `[web]`, `[api]`, `[partykit]` for easy debugging

### Why This Works for AI

- Copy-paste one terminal output for full context
- AI sees frontend, backend, and WebSocket interactions together
- No context switching between terminals

### Port Conventions

| Worktree | Web | API | PartyKit |
|----------|-----|-----|----------|
| `AICanvas` (main) | 5173 | 8787 | 1999 |
| `AICanvas-*` (side) | 5181, 5182... | 8791, 8792... | 1999 (shared) |

The `bun run worktree:new` script auto-assigns ports and configures env files.

## Key Files for Orientation

| Area | Start here |
|---|---|
| Canvas core | `apps/web/src/components/canvas/CanvasContainer.tsx` |
| Overlay rendering | `apps/web/src/components/canvas/overlay-definitions.tsx` |
| Overlay example (canonical) | `apps/web/src/components/overlays/kanban/` |
| Overlay pattern spec | `docs/overlay-authoring-pattern.md` |
| Shared schemas | `packages/shared/src/schemas/overlay.ts` |
| Shared types | `packages/shared/src/types/overlay.ts` |
| Store composition | `apps/web/src/stores/store.ts` |
| API entry | `apps/api/src/index.ts` |
| API routes | `apps/api/src/routes/` |
| Assistant architecture (future) | `docs/assistant-v2-architecture.md` |
| Tech stack decisions | `ARCHITECTURE.md` |

## Agent Collaboration

- Kimi is the primary implementation agent and may use sub-agents for bounded parallel work.
- Codex is the reviewer, integrator, and merge-readiness gate.
- Prefer one working branch with multiple meaningful commits.
- Open a PR only at a real reviewable checkpoint, not for every tiny step.
- Do not merge implementation branches directly to `main` without Codex review unless explicitly instructed.
- Keep temporary breakage explicit and honest.
- See `docs/agent-workflow.md` for the full workflow.

## Documentation Index

- `AGENTS.md` — this file (project orientation, patterns, rules for Codex and other agent tooling)
- `CLAUDE.md` — mirrored project orientation for Claude
- `apps/web/CLAUDE.md` — frontend SPA patterns (components, state, styling, testing)
- `apps/api/CLAUDE.md` — API patterns (routes, middleware, database, auth)
- `packages/shared/CLAUDE.md` — shared package rules (schemas, types, constants)
- `ARCHITECTURE.md` — tech stack decisions and rationale
- `docs/agent-workflow.md` — Kimi/Codex branch, PR, and review workflow
- `docs/overlay-authoring-pattern.md` — overlay composition specification
- `docs/assistant-v2-architecture.md` — next-generation assistant architecture
- `docs/workflow-pragmatic.md` — simplified worktree workflow for solo + AI development
- `docs/multi-agent-orchestration.md` — advanced multi-agent orchestration (legacy)
- `docs/overlay-lod-architecture.md` — overlay level-of-detail and performance model
- `docs/observability.md` — current logging, tracing, and Sentry setup
- `docs/cloudflare-deployment-architecture.md` — current Cloudflare deployment shape and target evolution plan
- `docs/deployment-runbook.md` — repo setup and CI/CD requirements for deployment
- `docs/auth-setup.md` — Clerk authentication setup for local dev and production (DNS, OAuth, secrets, migrations)
