# Canvas App — Standalone Rebuild: Architecture Decisions

## Context

Rebuilding the Astro-based canvas/dashboard application as a standalone product. The reference codebase (`AstroWeb/`) is an Astro 5 monorepo deployed to Cloudflare, mixing React and Svelte islands. The goal is to preserve the proven product logic on a cleaner foundation with less framework ceremony.

---

## Final Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Monorepo | **Turborepo** | Task caching, zero-config TS path resolution |
| Frontend | **React 19 + Vite + TypeScript** | SPA, no SSR (canvas is fully client-side) |
| Routing | **TanStack Router** | File-based, fully type-safe params/search/loaders |
| Server state | **TanStack Query** | Cache, dedup, background refresh |
| Client state | **Zustand** | Direct port of existing slices (canvas, chat, UI) |
| API | **Hono + Zod** | Thin, typed, native to CF Workers |
| API client | **Hono RPC** | End-to-end type safety, no codegen |
| ORM | **Drizzle** | SQLite dialect, same schema as current D1 |
| Database | **Cloudflare D1** | Native to CF, zero network hop from Workers |
| Blob storage | **Cloudflare R2** | Canvas JSON blobs + thumbnails (S3-compatible) |
| Auth | **Clerk** | OAuth, email/password, session management |
| Real-time | **PartyKit** | E2E encrypted WebSocket collaboration (unchanged) |
| AI | **Anthropic SDK (JS)** | Claude integration, inline processing |
| Canvas | **Excalidraw** | + custom overlay registry + Lexical |
| Styling | **Tailwind CSS v4** | Replaces inconsistent CSS modules/inline mix |
| Tests | **Vitest + React Testing Library** | Colocated, fast |
| Lint/format | **Biome** | Single tool, fast |
| Deploy | **CF Pages (SPA) + CF Workers (API)** | Independent deploys |

---

## Key Architectural Decisions

### 1. SPA + Separate Hono API (not a full-stack framework)

**Decision:** React SPA with a separate Hono API server, not TanStack Start or Next.js.

**Why:**
- The app is 95% client-side. Canvas, overlays, collaboration, AI chat — all client-owned. No SSR benefit.
- Hono is a first-class Cloudflare citizen (built for Workers). More battle-tested on CF than Nitro/TanStack Start.
- Clean deployment split: static SPA on CF Pages, API on CF Workers. Independent scaling and deploys.
- TanStack Start is still maturing. TanStack Router and Query are rock-solid, but Start has fewer production miles.
- A separate API can serve future clients (mobile, desktop) without coupling to the frontend.

**Rejected alternatives:**
- **Next.js** — vendor lock-in to Vercel, SSR complexity we don't need
- **TanStack Start** — good but young; Nitro's CF preset is less proven than native Hono on Workers
- **Astro** — the current framework; islands pattern forces CustomEvent bridges and cross-component hacks

### 2. Cloudflare D1 (not Postgres, not Turso)

**Decision:** Start with D1. Migrate to Turso only if global read latency becomes a measured problem.

**Why D1:**
- Native CF binding — zero network hop from Workers, no connection management
- The current schema already targets SQLite/D1. No migration needed.
- Free, zero-config, same billing dashboard as Pages/R2/Workers
- Canvas metadata writes (titles, timestamps, permissions) are infrequent and latency-tolerant
- Heavy blob data goes to R2, not the database

**Why not Postgres (Neon/Supabase):**
- SQLite → Postgres requires type mapping rewrites (integer timestamps → timestamp, text → jsonb)
- HTTP round-trips from CF Workers to Neon on every query
- Postgres solves problems this app doesn't have (full-text search is client-side, JSON queries hit R2)

**Why not Turso (yet):**
- Adds a second vendor, second auth boundary, second billing surface
- HTTP round-trips from Workers to Turso's network vs D1's native binding
- Edge replicas are impressive but premature — measure first
- Migration path is trivial: both are SQLite, Drizzle abstracts the driver swap

**Why not Convex:**
- Proprietary query language, schema DSL, and runtime — maximum vendor lock-in
- Would require rewriting every query and abandoning Drizzle
- Built-in real-time is redundant (we have PartyKit)

### 3. No Python worker, no Cloudflare Queues (yet)

**Decision:** All AI/image/sketch processing stays in JavaScript, inline with the API.

**Why:**
- The current app does all AI/image/sketch work in JS successfully (Anthropic SDK, mermaid rendering, sketch vectorizer)
- A Python worker adds a second language, second build pipeline, separate hosting (CF Workers can't run Python)
- Cloudflare Queues are a good pattern but premature. Auto-save is already throttled. AI calls are user-initiated.
- Add queues/workers when you measure a latency problem, not before.

### 4. Hono RPC for end-to-end type safety

**Decision:** Use Hono's built-in RPC client instead of tRPC, GraphQL, or manual fetch calls.

**How it works:**
- Hono route handlers define input (Zod) and output types
- `hc<AppType>()` on the client generates a fully typed client from those types
- No codegen step, no schema stitching, no runtime overhead

**Why not tRPC:** Hono RPC achieves the same type safety with fewer moving parts. tRPC would be a second RPC layer on top of Hono.

**Why not GraphQL:** Over-engineered for a single-client app. Adds schema definition, resolver boilerplate, and a query language for no benefit.

### 5. Eliminate Astro islands ceremony

**What goes away:**

| Current Pattern | Why It Existed | Replacement |
|---|---|---|
| `CustomEvent` dispatches | Astro islands can't share React context | Direct Zustand store access |
| `commandSlice` queue | Cross-island action coordination | Direct function calls |
| `client:only="react"` directives | Astro hydration ceremony | Everything is React |
| Svelte components | Multi-framework islands | Removed (landing page is gone) |
| `@astrojs/cloudflare` adapter | Astro → CF Workers glue | Native Hono on Workers |
| Dual `content.config.ts` / `config.ts` | Schema inconsistency | Single Drizzle schema |
| Blog content collections | Portfolio site feature | Removed |

### 6. Tailwind CSS v4 (not CSS Modules)

**Decision:** Standardize on Tailwind v4.

**Why:** The reference codebase has inconsistent styling (mix of CSS modules, inline styles, utility classes). For a rebuild, picking one system and using it everywhere matters more than which system. Tailwind v4 provides consistent design tokens, zero-runtime cost, and the largest component ecosystem.

---

## Project Structure

```
canvas/
├── packages/
│   └── shared/                 # Schemas, types, constants
│       ├── schemas/            # Zod schemas (used by API + client)
│       ├── types/              # Canvas, collaboration, AI types
│       └── constants/          # Element types, overlay config
│
├── apps/
│   ├── web/                    # Vite + React SPA
│   │   ├── src/
│   │   │   ├── routes/         # TanStack Router file-based routes
│   │   │   │   ├── __root.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   ├── _auth/
│   │   │   │   │   ├── login.tsx
│   │   │   │   │   └── signup.tsx
│   │   │   │   └── _app/
│   │   │   │       ├── dashboard.tsx
│   │   │   │       └── canvas.$id.tsx
│   │   │   ├── components/
│   │   │   │   ├── canvas/     # CanvasContainer, CanvasCore, CanvasUI, NotesLayer
│   │   │   │   ├── overlays/   # Lexical, Markdown, Kanban, WebEmbed
│   │   │   │   ├── ai-chat/    # AI chat panel
│   │   │   │   ├── dashboard/  # Canvas library grid
│   │   │   │   └── ui/         # Shared primitives
│   │   │   ├── stores/         # Zustand slices
│   │   │   ├── hooks/          # useCollaboration, etc.
│   │   │   └── lib/            # Client-side utilities
│   │   └── vite.config.ts
│   │
│   └── api/                    # Hono on CF Workers
│       ├── src/
│       │   ├── routes/         # Hono route groups
│       │   │   ├── canvas.ts
│       │   │   ├── assistant.ts
│       │   │   └── user.ts
│       │   ├── middleware/     # Auth, error handling
│       │   ├── lib/
│       │   │   ├── db/        # Drizzle schema + queries
│       │   │   ├── storage/   # R2 canvas blob storage
│       │   │   ├── assistant/ # AI service layer
│       │   │   └── collab/    # Encryption + protocol types
│       │   └── index.ts       # Hono app entry
│       └── wrangler.toml
│
├── workers/
│   └── partykit/               # Collaboration server (unchanged)
│       ├── collab.ts
│       └── partykit.json
│
├── drizzle/                    # Database migrations
├── turbo.json
├── biome.json
└── package.json
```

---

## What Ports Unchanged

- Canvas overlay architecture (overlay-registry.ts, element-factories.ts, z-index management)
- Custom element types (Lexical, Markdown, Kanban, WebEmbed) and their rendering
- Real-time collaboration protocol, encryption, and PartyKit server
- AI assistant service layer, prompt templates, diagram rendering
- Persistence coordinator logic (auto-save throttling, conflict detection)
- Auth middleware shape (requireAuth/optionalAuth pattern)
- Zustand store structure (canvas, chat, UI slices)

## What Gets Removed

- Astro framework and all `.astro` files
- Svelte components and `@astrojs/svelte`
- Islands hydration directives (`client:only`, `client:load`, etc.)
- CustomEvent cross-component communication
- Command queue pattern (commandSlice)
- Blog/portfolio pages and content collections
- Dual wrangler configs (canvas-only vs full site)

---

## Future Escape Hatches

- **Database:** D1 → Turso migration requires only swapping the Drizzle driver. No query changes.
- **Storage:** R2 is S3-compatible. Swap to AWS S3, Tigris, or MinIO with config changes only.
- **Auth:** Clerk → Better Auth if you want to own the auth layer. Same middleware pattern.
- **Deploy:** Hono runs on Node, Deno, Bun, AWS Lambda. Vite SPA is static files anywhere.
- **AI:** Anthropic SDK swap to any provider. The service layer abstracts the model call.
- **Background jobs:** Add Cloudflare Queues when AI latency becomes a measured bottleneck.
