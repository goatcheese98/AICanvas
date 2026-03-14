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
bun run dev                # start all apps in dev mode (turbo)
bun run build              # build all packages (turbo)
bun run test               # run all tests (turbo, vitest)
bun run typecheck           # typecheck all packages (turbo)
bun run lint               # lint all files (biome)
bun run lint:fix           # lint and auto-fix (biome)
bun run format             # format all files (biome)
bun run db:generate        # generate Drizzle migrations
bun run db:migrate         # run Drizzle migrations against local D1
```

Run a single package: `bun run test --filter=@ai-canvas/web`

## Code Style

- **Formatter:** Biome — tabs, single quotes, semicolons, 100-char line width
- **Imports:** Biome auto-organizes. Use `@ai-canvas/shared/schemas`, `@ai-canvas/shared/types`, `@ai-canvas/shared/constants` for shared code. Use `@/` path alias for intra-app imports. Use `./` for siblings.
- **Naming:** PascalCase for components (`KanbanBoard.tsx`). kebab-case for utilities (`kanban-utils.ts`). camelCase with `use` prefix for hooks (`useKanbanBoardState.ts`). kebab-case with `-types` suffix for local type files (`kanban-board-types.ts`).
- **Styling:** Tailwind CSS v4 only. Use CSS variables for design tokens (`var(--color-accent-bg)`). No CSS modules. Inline `style={}` only for dynamic/computed values.
- **Types:** No `any`. Biome warns on `noExplicitAny`. Use Zod schemas in `packages/shared/src/schemas/` for runtime validation; infer TypeScript types from them.
- **File size:** Treat files above 300-400 lines as a split candidate.

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
- **Large files.** Split at 300-400 lines. Extract UI regions first, then move state into hooks.

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

## Documentation Index

- `AGENTS.md` — this file (project orientation, patterns, rules for Codex and other agent tooling)
- `CLAUDE.md` — mirrored project orientation for Claude
- `apps/web/CLAUDE.md` — frontend SPA patterns (components, state, styling, testing)
- `apps/api/CLAUDE.md` — API patterns (routes, middleware, database, auth)
- `packages/shared/CLAUDE.md` — shared package rules (schemas, types, constants)
- `ARCHITECTURE.md` — tech stack decisions and rationale
- `docs/overlay-authoring-pattern.md` — overlay composition specification
- `docs/assistant-v2-architecture.md` — next-generation assistant architecture
