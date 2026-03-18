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
- **Split files** at 300-400 lines

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
6. **Large files** — Split at 300-400 lines

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

- `docs/overlay-authoring-pattern.md` — Overlay spec
- `ARCHITECTURE.md` — Tech decisions
- `CLAUDE.md` — Mirror of this file
