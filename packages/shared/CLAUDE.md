# packages/shared — Schemas, Types, Constants

Shared package consumed by both `apps/web` and `apps/api`. Contains Zod schemas for runtime validation, TypeScript types inferred from those schemas, and domain constants.

## Commands

```sh
bun run test             # vitest run
bun run typecheck        # tsc --noEmit
```

## Exports

The package exposes three explicit subpaths. Import only from these — never from internal file paths.

```ts
import { ... } from '@ai-canvas/shared/schemas';    // Zod schemas + normalizers
import type { ... } from '@ai-canvas/shared/types';  // TypeScript type definitions
import { ... } from '@ai-canvas/shared/constants';   // Domain constants + enums
```

These are defined in `package.json` `exports` field. Each maps to an `index.ts` barrel file.

## Directory Structure

```
src/
  schemas/
    index.ts           Barrel re-exports
    canvas.ts          Canvas CRUD schemas (create, update, list, data)
    overlay.ts         Overlay custom data schemas + normalizers per type
    user.ts            User preference schemas
    assistant.ts       Assistant run/thread/message schemas
    waitlist.ts        Waitlist signup schema
    *.test.ts          Colocated tests
  types/
    index.ts           Barrel re-exports
    canvas.ts          Canvas, CanvasElement, CanvasSavePayload
    overlay.ts         OverlayType union, per-type custom data interfaces
    collab.ts          Collaboration message + user types
    assistant.ts       Run, task, artifact, event type definitions
  constants/
    index.ts           Barrel re-exports
    canvas.ts          OVERLAY_TYPES, COLLAB_COLORS, CANVAS_DEFAULTS
    ai.ts              AI_MODELS, GENERATION_MODES
```

## Schema Authoring Rules

### Zod schemas define the source of truth

1. Define the Zod schema in `src/schemas/<domain>.ts`
2. Infer the TypeScript type from it: `type Foo = z.infer<typeof fooSchema>`
3. Export the inferred type from `src/types/<domain>.ts`
4. Never hand-write a type that duplicates a schema — always infer

### Normalizers

Every overlay type has a normalizer function that fills defaults and coerces optional fields:

```ts
export function normalizeMarkdownOverlay(data: unknown): MarkdownOverlayCustomData
export function normalizeKanbanOverlay(data: unknown): KanbanOverlayCustomData
```

Normalizers are called once at the container boundary in frontend components. They guarantee a consistent shape regardless of what was persisted.

### Discriminated unions for overlay types

Overlay custom data uses a type map pattern, not a generic union:

```ts
type OverlayCustomDataMap = {
  markdown: MarkdownOverlayCustomData;
  newlex: NewLexOverlayCustomData;
  kanban: KanbanOverlayCustomData;
  'web-embed': WebEmbedOverlayCustomData;
};
```

When adding a new overlay type:
1. Add its schema + normalizer in `src/schemas/overlay.ts`
2. Add its type interface in `src/types/overlay.ts`
3. Add its entry to the discriminated union map
4. Export from both barrel files

### Validation schemas for API inputs

Canvas and assistant schemas export grouped objects for use with `zValidator`:

```ts
export const canvasSchemas = {
  create: z.object({ ... }),
  update: z.object({ ... }),
  list: z.object({ ... }),
  data: z.object({ ... }),
};
```

### Testing

Every schema and normalizer should have colocated tests. Test:
- Valid inputs produce expected output shapes
- Normalizers fill defaults correctly
- Invalid inputs are rejected with appropriate errors
- Edge cases (empty strings, missing optional fields, unknown extra fields)

## Rules

- No `any` types. Use `unknown` and narrow with Zod parsing.
- No runtime dependencies besides `zod`.
- No React, no DOM, no Node-specific APIs — this package must work in both Workers and browser.
- Keep the package lightweight. It is imported by both API and frontend bundles.
- Do not add utility functions that belong in a specific app. Only shared domain logic goes here.
