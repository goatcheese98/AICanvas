# AI Canvas Rebuild Notes

This document tracks how the standalone `AICanvas` app is being reconstructed from the reference `AstroWeb` codebase.

## Goal

Rebuild the working canvas/dashboard product on a simpler standalone stack while preserving the parts of the reference app that are already proven:

- Excalidraw canvas behavior
- custom overlay system
- persistence and save behavior
- dashboard/library flows
- AI assistant flows
- collaboration protocol

The architectural rationale lives in [ARCHITECTURE.md](./ARCHITECTURE.md). This file is about execution: what is being ported, in what order, and how quality is being managed during the rebuild.

## Source And Target

- Reference implementation: `../AstroWeb/`
- Standalone rebuild: `./`

The rebuild is not a line-for-line copy. The approach is:

1. keep product behavior that is already validated
2. remove Astro-specific ceremony and cross-island plumbing
3. replace framework hacks with direct React + Zustand + Hono patterns
4. add tests as features are ported so the standalone codebase becomes easier to change than the reference

## Porting Rules

When moving code from the reference app:

- Preserve behavior before refactoring style
- Remove Astro-only patterns
- Remove `CustomEvent`-driven communication where Zustand/direct props are sufficient
- Replace ad hoc fetch calls with the typed Hono RPC client
- Keep data shapes compatible with persisted canvas data whenever possible
- Favor small, verifiable ports over large speculative rewrites

## Reconstruction Order

### Item 1: Canvas data loading + auto-save

Status: completed

Implemented:

- local persistence coordinator port
- Zustand persistence state
- canvas load from Hono API
- local fallback on API failure
- debounced local save + throttled server save

### Item 2: Canvas overlays

Status: in progress, first functional pass completed

Implemented:

- standalone overlay rendering layer
- viewport transform positioning in `CanvasNotesLayer`
- markdown note component
- lexical note component
- kanban board component
- web embed component
- overlay payload typing and scene update helpers
- markdown note settings panel and inline image insertion with mapped image references
- richer lexical editing toolbar plus in-note discussion panel wiring
- kanban undo/redo history and board presentation controls
- web embed inline/PiP/expanded viewing modes

Still to deepen:

- fuller Lexical anchor-based comment stack
- more complete kanban metadata, checklist, and operation parity
- web embed navigation history/proxy behavior parity

### Item 3: AI chat panel

Status: in progress, first functional pass completed

Implemented:

- canvas AI chat panel in the standalone web app
- assistant route backed by a real local service layer instead of a stub
- assistant parsing helpers for Mermaid, D2, and Kanban prompt generation
- deterministic assistant draft generation for chat, Mermaid, D2, and Kanban modes
- assistant artifacts can now be inserted onto the canvas as markdown or kanban overlays
- colocated assistant unit tests in the API app

Still to deepen:

- true Anthropic-backed generation and streaming
- richer artifact rendering/application on the canvas
- richer conversation persistence/history
- image and sketch generation flows

### Item 4: Dashboard

Status: in progress, first functional pass completed

Implemented:

- standalone dashboard shell with a ported canvas library structure
- authenticated canvas list query via Hono RPC
- create canvas mutation
- delete canvas mutation
- toggle favorite mutation
- validated create and rename flows using shared Zod schemas on both client and API
- per-user canvas title uniqueness enforced in the API and local D1 schema
- dashboard canvas preview thumbnails rendered from saved scene data
- colocated dashboard filtering/sorting tests

Still to deepen:

- stored thumbnail generation instead of on-demand preview fetches
- pagination/cursor handling
- batch selection actions from the reference implementation

### Item 5: Collaboration

Status: in progress, first functional pass completed

Implemented:

- live collaboration hook with PartyKit room lifecycle
- URL-hash room sharing with client-only AES key exchange
- encrypted scene and cursor broadcasts
- remote scene reconciliation via Excalidraw
- collaborator cursor/state updates pushed into Excalidraw app state
- collaboration controls in the canvas UI
- collaboration state stripped from persistence payloads
- colocated collaboration utility and encryption tests

Still to deepen:

- full local multi-client verification against PartyKit outside sandbox
- richer collaborator identity/avatar handling
- reconnect UX and session status polish
- server/auth hardening around full-stack local startup

Hardening completed after the first pass:

- canvas API load/save now uses the same Clerk token header flow as dashboard and assistant requests
- API auth middleware now uses Clerk token verification in a type-safe way
- authenticated Clerk users are now upserted into the local `users` table before API route logic runs
- Wrangler D1 local migrations are wired to the generated `drizzle/` migration directory
- persisted Excalidraw app state now drops volatile layout fields before rehydration
- initial canvas hydration now forces a post-load Excalidraw refresh to avoid resize-only first paint bugs
- local fallback persistence is now keyed per-canvas instead of using one global browser slot
- leaving a canvas now force-flushes local persistence and immediately persists the latest scene to the API
- canvas saves now invalidate dashboard list and preview queries so previews refresh after edits
- canvas view now has an explicit back-to-dashboard control and slimmer top-right panel toggles
- PartyKit worker typecheck passes
- web and API package typechecks pass again after collaboration wiring
- collaboration panel now shows basic live session status and collaborator names
- collaboration hook now exposes `connecting`, `reconnecting`, and `error` session states instead of only a boolean live/offline flag
- collaboration reconnect backoff now increments correctly across retries instead of resetting on each reconnect attempt
- collaboration room joins now stay in sync with URL hash changes, so shared-link navigation and back/forward behavior are more predictable

## Testing Policy During Rebuild

The rebuild should accumulate tests as features land. The standard is:

- every new utility/helper gets unit tests
- every bug fix gets a regression test
- every major user-facing flow eventually gets an integration or E2E test

### Where tests live

Tests are colocated with the code they verify:

- `apps/web/src/.../*.test.ts`
- `apps/web/src/.../*.test.tsx`
- `apps/api/src/.../*.test.ts`
- `packages/shared/src/.../*.test.ts`

Examples already added in the standalone app:

- `apps/web/src/components/canvas/element-factories.test.ts`
- `apps/web/src/components/canvas/overlay-registry.test.ts`
- `apps/web/src/lib/web-embed-utils.test.ts`
- `apps/api/src/lib/assistant/parsing.test.ts`
- `apps/api/src/lib/assistant/service.test.ts`
- `apps/web/src/components/dashboard/dashboard-utils.test.ts`
- `apps/web/src/hooks/collaboration-utils.test.ts`
- `apps/web/src/lib/collab/encryption.test.ts`
- `apps/web/src/lib/api.test.ts`
- `apps/api/src/lib/auth/build-auth-user.test.ts`
- `apps/web/src/components/ai-chat/assistant-artifacts.test.ts`
- `packages/shared/src/schemas/canvas.test.ts`
- `apps/web/src/lib/persistence/CanvasPersistenceCoordinator.test.ts`

### Testing layers

1. Unit tests
   - pure helpers
   - data transforms
   - overlay update logic
   - persistence fallback behavior

2. Component tests
   - note editing behavior
   - overlay rendering behavior
   - dashboard actions

3. End-to-end tests
   - create canvas
   - edit overlay
   - auto-save
   - reload and recover state

## Current Known Gaps

These are known repo-level issues outside the overlay work and should be resolved as the rebuild continues:

- Cloudflare worker globals/types are not fully wired for API typechecking
- some collaboration message types are not exported yet
- route/typegen setup still needs cleanup
- full-stack `dev` startup has environment-specific and repo-level issues to resolve

## Working Style For Future Sessions

When continuing this rebuild:

1. read `ARCHITECTURE.md`
2. read this file
3. inspect current standalone implementation before porting new reference code
4. port one functional slice at a time
5. add or extend tests in the same pass
6. verify with targeted typechecks/tests before moving on

This file should be updated as major items land, priorities change, or testing standards tighten.
