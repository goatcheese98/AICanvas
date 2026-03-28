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

## Workflow Guardrail

Docs describe the target architecture, but issue creation and review decisions must be based on the verified current state of `main`.

Before creating issues, reviewing a phase, or calling work incomplete, first verify whether the behavior is:

- still missing
- already on `main`
- partially present and only needs a smaller follow-up

## Issue Tracking

This repository uses **bd (beads)** for issue tracking and cross-window handoffs.

- Run `bd prime` for the current workflow context.
- Run `bd ready` to find unblocked work before starting a new task.
- Use beads instead of ad hoc markdown for multi-step work, discovered follow-ups, and agent handoffs.
- For checkpoint-style work, record the same fields in the active bead:
  `Current phase`, `Verified current state`, `Decision`, `Verification`, `Remaining risks`, `Next step`.
- When ending a meaningful checkpoint, update or close the bead and push the tracker state with `bd dolt push`.

Quick reference:

- `bd ready`
- `bd show <id>`
- `bd create "Title" --type task --priority 2`
- `bd update <id> --notes "..."` or `bd update <id> --design "..."`
- `bd close <id>`
- `bd dolt push`

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

## Branch and Worktree Use

Use one branch per task by default.

Worktrees are optional. Use them when isolation meaningfully helps, especially for larger or risky tasks. For small tasks, staying in one branch is usually simpler.

If you create a new worktree:

```sh
bun run worktree:new -- my-feature
cd ../AICanvas-my-feature
bun run dev
```

This starts via Turbo:
- **Web** (React frontend)
- **API** (Hono backend)
- **PartyKit** (WebSocket collaboration)

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

## Agent Workflow

Use one shared workflow across models. Keep it light by default. Escalate into orchestration only when the task size, difficulty, or ambiguity earns it.

### Core Principles

- One task brief per task.
- One primary agent owns the result.
- One agent, one task, one prompt by default.
- Verification matters more than style.
- Use orchestration selectively.
- Prefer one implementation path, not duplicate full builds.
- If output is bad, diagnose the cause and rerun instead of endlessly patching slop.
- Focused agents are correct agents: keep scope narrow and explicit.
- Keep outputs small, explicit, and honest.

### Task Brief

Every task starts with:

- Goal
- Constraints
- Acceptance criteria
- Verification
- Non-goals
- Execution mode

### Modes

1. `Solo`
   Use when the task is small, local, and mostly obvious.

2. `Assisted`
   Use when the task is medium-sized and one or two bounded subtasks can run in parallel.

3. `Orchestrated`
   Use when the task is large and splits into real independent slices.

4. `Exploratory`
   Use when the task is difficult, ambiguous, or worth experimenting on.
   In this mode, sub-agents can explore different approaches and the orchestrator picks or synthesizes the best path.

### Delegation Rules

- Delegate bounded tasks, clear questions, isolated implementation slices, and verification passes.
- Do not delegate vague end-to-end goals by default.
- Do not run duplicate full implementations unless you are explicitly running an experiment.
- Use exploratory orchestration for hard or ambiguous tasks before committing to one implementation path.
- Some sub-agents should be read-only or review-only when that better fits the task.

### Sub-Agent Output

When a sub-agent explores or compares an approach, it should return:

- Approach
- Why it works
- Risks
- Files affected
- Verification plan
- Recommendation

### Delivery Standard

Every completed task should report:

- Completed
- Verification
- Remaining risks
- Next step

### Quality Gates

Before work is handed off, merged, or treated as done:

- run the relevant typecheck
- run the relevant tests
- run lint when it materially helps
- name what remains unverified

### PR Rule

- Open a PR only when it adds value: formal review, merge checkpoint, or substantial change history.
- Skip PR ceremony for small or exploratory work when it does not help.
- Keep temporary breakage explicit and honest.

## Documentation Index

- `AGENTS.md` — this file (project orientation, patterns, rules for Codex and other agent tooling)
- `CLAUDE.md` — mirrored project orientation for Claude
- `apps/web/CLAUDE.md` — frontend SPA patterns (components, state, styling, testing)
- `apps/api/CLAUDE.md` — API patterns (routes, middleware, database, auth)
- `packages/shared/CLAUDE.md` — shared package rules (schemas, types, constants)
- `ARCHITECTURE.md` — tech stack decisions and rationale
- `docs/overlay-authoring-pattern.md` — overlay composition specification
- `docs/assistant-v2-architecture.md` — next-generation assistant architecture
- `docs/overlay-lod-architecture.md` — overlay level-of-detail and performance model
- `docs/observability.md` — current logging, tracing, and Sentry setup
- `docs/cloudflare-deployment-architecture.md` — current Cloudflare deployment shape and target evolution plan
- `docs/deployment-runbook.md` — repo setup and CI/CD requirements for deployment
- `docs/auth-setup.md` — Clerk authentication setup for local dev and production (DNS, OAuth, secrets, migrations)
