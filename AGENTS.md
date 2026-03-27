# AI Canvas — Agent Guide

Visual workspace combining whiteboarding, notes, task management, and AI assistance.

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **Router**: TanStack Router (file-based)
- **State**: Zustand (client) + TanStack Query (server)
- **API**: Hono on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Auth**: Clerk
- **Real-time**: PartyKit (WebSocket collaboration)
- **Canvas**: Excalidraw + custom overlays

## Monorepo Structure

```
apps/
  web/          # React SPA (Vite, TanStack Router)
  api/          # Hono API (Cloudflare Workers)
packages/
  shared/       # Zod schemas, types, constants
workers/
  partykit/     # Collaboration server
```

Package names: `@ai-canvas/web`, `@ai-canvas/api`, `@ai-canvas/shared`

## Commands

```bash
# Install (requires Node 20+, Bun 1.3+)
bun install

# Dev (all services)
bun run dev
```

**Default Ports:**
- Web: 5173
- API: 8787  
- PartyKit: 1999

**Worktree Ports:**
| Worktree | Web | API | PartyKit |
|----------|-----|-----|----------|
| `AICanvas` (main) | 5173 | 8787 | 1999 |
| `AICanvas-*` (side) | 5181, 5182... | 8791, 8792... | 1999 (shared) |

# Build / Test / Lint
bun run build
bun run test
bun run lint
bun run typecheck

# Database
bun run db:generate    # Generate migrations
bun run db:migrate     # Run migrations
```

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

## Key Patterns

### Overlay System (Core Abstraction)

Overlays are rich content panels on the canvas (notes, kanban, embeds). Follow the **Container/Hook/Child** pattern:

```
overlays/<type>/
  <Type>Container.tsx    # Element integration, persistence
  use<Type>State.ts      # Draft state, sync, debounced commits
  <Type>.tsx             # Main component
  <type>-utils.ts        # Pure helpers
  index.ts
```

**Canonical example**: `apps/web/src/components/overlays/kanban/`

**Rules**:
1. Normalize `customData` at container boundary
2. One `onChange` callback for persisted writes
3. One `onEditingChange` callback for edit lifecycle
4. Don't mix persisted state and transient UI state
5. Mutation helpers must be pure functions

### State Management

- **Global**: Zustand slices in `apps/web/src/stores/`
- **Server**: TanStack Query for API data
- **Local**: `use<Type>State.ts` hooks for draft state + debounced commits

### Code Style

- **Biome**: Tabs, 100 chars, single quotes, semicolons
- **Imports**: `@ai-canvas/shared/*` for cross-app, `@/` for intra-app
- **Naming**: PascalCase components, camelCase hooks, kebab-case utilities
- **Types**: No `any`, use Zod schemas, infer types, shared types in `packages/shared/`
- **Styling**: Tailwind CSS v4 only, CSS variables for tokens
- **File size**: Treat 300-400 lines as a split candidate when cohesion or local reasoning is degrading

### No Direct useEffect Rule

**NEVER use `useEffect` directly in components.** This prevents race conditions, infinite loops, and dependency hell.

| Instead of useEffect | Use This | Example |
|---------------------|----------|---------|
| Setting state from props | Derived state | `const filtered = items.filter(...)` |
| Data fetching | TanStack Query | `useQuery({ queryKey, queryFn })` |
| User actions | Event handlers | `onClick={() => doAction()}` |
| External store sync | `useSyncExternalStore` | Window size, online status |
| One-time DOM setup | `useMountEffect` | Lexical/Excalidraw init |
| Reset on ID change | `key` prop | `<Player key={videoId} />` |

**The only allowed exception:** `useMountEffect()` from `@/hooks/useMountEffect` for one-time external system setup.

```typescript
// ❌ BAD: useEffect for derived state
useEffect(() => setFiltered(items.filter(...)), [items]);

// ✅ GOOD: Derived state
const filtered = items.filter(...);

// ❌ BAD: useEffect for data fetching
useEffect(() => fetchData().then(setData), []);

// ✅ GOOD: TanStack Query
const { data } = useQuery({ queryKey, queryFn: fetchData });

// ❌ BAD: useEffect as action relay
useEffect(() => { if (shouldSave) save(); }, [shouldSave]);

// ✅ GOOD: Event handler
const handleClick = () => save();

// ✅ GOOD: One-time external setup (ONLY exception)
useMountEffect(() => {
	const editor = createEditor();
	return () => editor.destroy();
});
```

### Tests

Colocated with code (`.test.ts` next to source):
- Unit tests: Vitest
- Hooks: `renderHook` from RTL
- Components: RTL + jsdom
- E2E: Playwright

## Anti-Patterns (Don't Do)

1. **Monolithic overlays** — Use Container/Hook/Child pattern
2. **Mixed patterns** — Use newer patterns from `docs/overlay-authoring-pattern.md`
3. **CSS modules/styled-components** — Tailwind only
4. **`any` types** — Use proper types or Zod inference
5. **Duplicate shared types** — Belong in `packages/shared/`
6. **Large incoherent files** — Split when size harms cohesion, readability, or local reasoning

## Agent Collaboration

- Kimi is the primary implementation agent and may use sub-agents for bounded parallel work.
- Codex is the reviewer, integrator, and merge-readiness gate.
- Prefer one working branch with multiple meaningful commits.
- Open a PR only at a real reviewable checkpoint, not for every tiny step.
- Do not merge implementation branches directly to `main` without Codex review unless explicitly instructed.
- Keep temporary breakage explicit and honest.
- See `docs/agent-workflow.md` for the full workflow.

## Key Files

| Area | Location |
|------|----------|
| Canvas core | `apps/web/src/components/canvas/CanvasContainer.tsx` |
| Overlay rendering | `apps/web/src/components/canvas/overlay-definitions.tsx` |
| Overlay example | `apps/web/src/components/overlays/kanban/` |
| Shared schemas | `packages/shared/src/schemas/overlay.ts` |
| Store | `apps/web/src/stores/store.ts` |
| API entry | `apps/api/src/index.ts` |

## Docs

- `docs/agent-workflow.md` — Kimi/Codex branch, PR, and review workflow
- `docs/overlay-authoring-pattern.md` — Overlay spec
- `ARCHITECTURE.md` — Tech decisions
- `CLAUDE.md` — Mirror of this file
