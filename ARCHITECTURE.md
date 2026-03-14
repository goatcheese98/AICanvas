# AI Canvas — Architecture Decisions

## Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Monorepo | **Turborepo** | Task caching, zero-config TS path resolution |
| Frontend | **React 19 + Vite + TypeScript** | SPA, no SSR (canvas is fully client-side) |
| Routing | **TanStack Router** | File-based, fully type-safe params/search/loaders |
| Server state | **TanStack Query** | Cache, dedup, background refresh |
| Client state | **Zustand** | Sliced store (canvas, chat, UI) |
| API | **Hono + Zod** | Thin, typed, native to CF Workers |
| API client | **Hono RPC** | End-to-end type safety, no codegen |
| ORM | **Drizzle** | SQLite dialect targeting D1 |
| Database | **Cloudflare D1** | Native to CF, zero network hop from Workers |
| Blob storage | **Cloudflare R2** | Canvas JSON blobs + thumbnails (S3-compatible) |
| Auth | **Clerk** | OAuth, email/password, session management |
| Real-time | **PartyKit** | E2E encrypted WebSocket collaboration |
| AI | **Anthropic SDK (JS)** | Claude integration, inline processing |
| Canvas | **Excalidraw** | + custom overlay registry + Lexical |
| Styling | **Tailwind CSS v4** | Single system, consistent design tokens |
| Tests | **Vitest + React Testing Library** | Colocated, fast |
| Lint/format | **Biome** | Single tool, fast |
| Deploy | **CF Pages (SPA) + CF Workers (API)** | Independent deploys |

---

## Key Decisions and Rationale

### 1. SPA + Separate Hono API (not a full-stack framework)

**Decision:** React SPA with a separate Hono API server, not TanStack Start or Next.js.

**Why:**
- The app is 95% client-side. Canvas, overlays, collaboration, AI chat — all client-owned. No SSR benefit.
- Hono is a first-class Cloudflare citizen (built for Workers). More battle-tested on CF than Nitro/TanStack Start.
- Clean deployment split: static SPA on CF Pages, API on CF Workers. Independent scaling and deploys.
- A separate API can serve future clients (mobile, desktop) without coupling to the frontend.

**Rejected alternatives:**
- **Next.js** — vendor lock-in to Vercel, SSR complexity not needed
- **TanStack Start** — good but young; Nitro's CF preset less proven than native Hono on Workers

### 2. Cloudflare D1 (not Postgres, not Turso)

**Decision:** D1 as the primary database. Migrate to Turso only if global read latency becomes a measured problem.

**Why D1:**
- Native CF binding — zero network hop from Workers, no connection management
- Free, zero-config, same billing dashboard as Pages/R2/Workers
- Canvas metadata writes are infrequent and latency-tolerant
- Heavy blob data goes to R2, not the database

**Why not Postgres (Neon/Supabase):**
- SQLite → Postgres requires type mapping rewrites
- HTTP round-trips from CF Workers on every query
- Postgres solves problems this app doesn't have

**Why not Turso (yet):**
- Adds a second vendor, second auth boundary, second billing surface
- Migration path is trivial when needed: both are SQLite, Drizzle abstracts the driver swap

**Why not Convex:**
- Proprietary query language, schema DSL, and runtime — maximum vendor lock-in
- Built-in real-time is redundant (PartyKit already handles collaboration)

### 3. All processing in JavaScript (no Python worker, no Queues yet)

**Decision:** AI/image/sketch processing stays in JS, inline with the API.

**Why:**
- All current AI/image/sketch work runs in JS successfully
- A Python worker adds a second language, second build pipeline, separate hosting
- Cloudflare Queues are a good pattern but premature — add when latency is a measured problem

### 4. Hono RPC for end-to-end type safety

**Decision:** Hono's built-in RPC client instead of tRPC, GraphQL, or manual fetch calls.

**How it works:**
- Hono route handlers define input (Zod) and output types
- `hc<AppType>()` on the client generates a fully typed client from those types
- No codegen step, no schema stitching, no runtime overhead

**Why not tRPC:** Hono RPC achieves the same type safety with fewer moving parts.

**Why not GraphQL:** Over-engineered for a single-client app.

### 5. Tailwind CSS v4 (not CSS Modules)

**Decision:** Standardize on Tailwind v4.

**Why:** Picking one system and using it everywhere matters more than which system. Tailwind v4 provides consistent design tokens, zero-runtime cost, and the largest component ecosystem.

---

## Project Structure

```
AICanvas/
├── packages/
│   └── shared/                 # Schemas, types, constants
│       ├── schemas/            # Zod schemas (used by API + client)
│       ├── types/              # Canvas, collaboration, AI types
│       └── constants/          # Element types, overlay config
│
├── apps/
│   ├── web/                    # Vite + React SPA
│   │   └── src/
│   │       ├── routes/         # TanStack Router file-based routes
│   │       ├── components/     # canvas/, overlays/, ai-chat/, dashboard/, ui/
│   │       ├── stores/         # Zustand slices
│   │       ├── hooks/          # useCollaboration, etc.
│   │       └── lib/            # Client-side utilities
│   │
│   └── api/                    # Hono on CF Workers
│       └── src/
│           ├── routes/         # Hono route groups
│           ├── middleware/     # Auth
│           └── lib/            # db/, storage/, assistant/, auth/
│
├── workers/
│   └── partykit/               # Collaboration server
│
├── docs/                       # Architecture and pattern docs
├── drizzle/                    # Database migrations
├── turbo.json
├── biome.json
└── package.json
```

---

## Future Escape Hatches

- **Database:** D1 → Turso requires only swapping the Drizzle driver. No query changes.
- **Storage:** R2 is S3-compatible. Swap to AWS S3, Tigris, or MinIO with config changes only.
- **Auth:** Clerk → Better Auth if you want to own the auth layer. Same middleware pattern.
- **Deploy:** Hono runs on Node, Deno, Bun, AWS Lambda. Vite SPA is static files anywhere.
- **AI:** The service layer abstracts the model call. Provider swap is localized.
- **Background jobs:** Add Cloudflare Queues when AI latency becomes a measured bottleneck.
