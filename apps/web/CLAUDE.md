# apps/web — Frontend SPA

React 19 single-page application built with Vite, TanStack Router, TanStack Query, and Zustand.

## Commands

```sh
bun run dev              # Vite dev server on localhost:5173
bun run build            # tsc + vite build
bun run test             # vitest run
bun run typecheck        # tsc --noEmit
```

## Directory Structure

```
src/
  routes/              TanStack Router file-based routes
  components/
    canvas/            Canvas core: container, rendering, overlay wiring, element factories
    overlays/          Overlay implementations (kanban, markdown, lexical, web-embed, prototype)
    ai-chat/           AI chat panel
    dashboard/         Canvas library grid and management
    landing/           Landing/marketing pages
    ui/                Shared UI primitives
  stores/              Zustand store + slices (canvasSlice, chatSlice, uiSlice)
  hooks/               App-level hooks (useCollaboration, etc.)
  lib/                 Client-side utilities (api client, persistence, collab, image compression)
```

## Component Authoring

### Overlay components

Follow the Container/Hook/Child pattern defined in `docs/overlay-authoring-pattern.md`. The canonical implementation is `src/components/overlays/kanban/`.

```
<Type>Container.tsx       ~100 lines. Element integration, persistence, layout.
use<Type>State.ts         Draft state, external sync, debounced commits.
<Type>.tsx                Main presentational component.
<FocusedChild>.tsx        Toolbar, settings panel, dialog, display section.
<type>-utils.ts           Pure helpers (normalize, serialize, project).
<type>-types.ts           Local type definitions.
index.ts                  Single named re-export.
```

Rules:
- Normalize `customData` once at the container boundary, not in children
- One `onChange` path for persisted writes, one `onEditingChange` for lifecycle
- Never mix persisted domain state and transient UI state in the same object
- All mutation helpers must be pure functions — testable without React rendering
- Split files above 300-400 lines

### Canvas components

Files in `src/components/canvas/` handle Excalidraw integration:

| File | Purpose |
|---|---|
| `CanvasContainer.tsx` | Route-level wrapper, data loading, persistence orchestration |
| `CanvasCore.tsx` | Excalidraw instance, scene management, event handlers |
| `CanvasUI.tsx` | Toolbar, panels, action buttons rendered over the canvas |
| `CanvasNotesLayer.tsx` | Viewport-transformed overlay positioning layer |
| `overlay-definitions.tsx` | Registry of all overlay renderers and their configs |
| `overlay-registry.ts` | Overlay type detection, creation, update utilities |
| `element-factories.ts` | Create typed Excalidraw elements for each overlay type |

### Standard components

For non-overlay components, keep it simple:
- One component per file, named export matching filename
- Colocate small helpers in the same file; extract when they exceed ~50 lines or are reused
- Use `@/` path alias for intra-app imports

## State Management

### Zustand store

Composed from slices in `src/stores/store.ts`:

| Slice | Owns |
|---|---|
| `canvasSlice` | Active canvas metadata, element state, save status |
| `chatSlice` | Chat threads, messages, active thread, AI provider config |
| `uiSlice` | Panel visibility, UI mode flags |

Rules:
- Each slice is a separate file in `src/stores/slices/`
- Slices are composed via spread at store creation, not nested
- Persistence uses `zustand/middleware/persist` with `localStorage`
- Only persist user-facing state that should survive page reloads (see `partialize` in store.ts)
- Never persist derived or volatile state

### TanStack Query

Used for all server state (API data). Not mixed with Zustand.
- Queries for reads (canvas list, canvas data)
- Mutations for writes (create, update, delete, save)
- Invalidate related queries after mutations

### Local component state

Complex overlays use `use<Type>State.ts` hooks:
- Own draft state with `useState`/`useReducer`
- Sync with external data via refs (not effects watching props)
- Debounce commits to parent via `onChange`
- Track undo/redo history locally when needed

## Styling

- Tailwind CSS v4 via `@tailwindcss/vite` plugin
- Design tokens as CSS variables in `src/globals.css` (`--color-*`, `--font-*`, `--shadow-*`)
- Dark mode via `@media (prefers-color-scheme: dark)`
- Use Tailwind utility classes for layout and static styles
- Use `style={}` only for dynamic/computed values (positions, dimensions from state)
- No CSS modules. No styled-components. No emotion.
- Exception: Lexical imports `ImageNode.css` for its image plugin — this is acceptable for third-party library integration

## Import Conventions

```ts
// Shared package — always use explicit subpath
import { overlaySchemas } from '@ai-canvas/shared/schemas';
import type { KanbanOverlayCustomData } from '@ai-canvas/shared/types';
import { OVERLAY_TYPES } from '@ai-canvas/shared/constants';

// Intra-app absolute — for distant files
import { useAppStore } from '@/stores/store';

// Sibling relative — for colocated files
import { useKanbanBoardState } from './useKanbanBoardState';
import { normalizeKanbanBoard } from './kanban-utils';
```

## Testing

Colocated with source (`.test.ts` / `.test.tsx` next to the file they test).

- **Pure helpers:** Direct import, assert inputs/outputs. No React rendering.
- **Hooks:** `renderHook` from `@testing-library/react`. Mock external dependencies with `vi.fn()`.
- **Components:** `render` from `@testing-library/react`. Test user-visible behavior, not implementation.
- **Runner:** Vitest with jsdom environment.

Every bug fix gets a regression test. Every new utility gets unit tests.

## API Client

The typed Hono RPC client lives in `src/lib/api.ts`. It imports `AppType` from `@ai-canvas/api` (dev dependency) for end-to-end type safety with no codegen.

```ts
import { hc } from 'hono/client';
import type { AppType } from '@ai-canvas/api';
```

All API calls go through this client. No raw `fetch` calls to the API.
