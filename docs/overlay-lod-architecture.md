# Overlay Level-of-Detail Architecture

This document describes the performance model for the overlay system, the problems
with the current approach, and the phased plan to move to a level-of-detail (LOD)
architecture that fits the current `CanvasNotesLayer` and overlay patterns.

## Current State

`CanvasNotesLayer` mounts every overlay as a fully-live React subtree regardless
of selection, zoom, or visibility. The only gate on interaction is
`pointerEvents: none` on the container div. This means:

- A Lexical editor instance (`newlex`) is mounted for every lexical note, not just
  the one the user is actively using.
- Kanban state, effects, drag/drop wiring, and panel logic are mounted for every
  board, not just the focused one.
- `WebEmbed` iframes are mounted whenever a URL exists, even when the embed is
  offscreen or deselected.
- `PrototypeNote` still runs preview compilation/runtime work for every prototype.

The data needed to improve this (`scrollX`, `scrollY`, `zoomValue`) already exists
in `CanvasNotesLayer`, but is only used for positioning math, not for rendering
decisions.

## Goals

- Reduce overlay runtime cost when the user cannot meaningfully interact with or
  inspect the full overlay.
- Preserve interaction guarantees: user input must never be interrupted by LOD.
- Keep the canonical persisted model in `customData`; previews are read-only
  projections, not separate stored representations.
- Roll out incrementally so one expensive overlay can improve without forcing all
  overlays to migrate at once.

## Terms

### Culling

Culling means not mounting an overlay at all when it is clearly outside the visible
canvas viewport. A culled overlay returns `null` from `CanvasNotesLayer`, so none
of its React effects, editors, workers, or iframes exist.

### Edge Margin

Culling should use a margin (sometimes called overscan) around the viewport so
overlays near the screen edge stay mounted. This avoids flicker and pop-in while
panning or zooming.

### Selected vs Active

The current codebase uses `isSelected` and per-overlay `onEditingChange`, but those
are not the same thing:

- **selected** means Excalidraw currently has the element selected.
- **active** means the overlay must keep its full interactive budget even if it is
  not selected in the canvas. Example: a web embed in PiP or expanded mode.

LOD decisions must be based on both, not just selection.

## The Model: Render Mode + Culling

Each overlay should support one render mode chosen by the parent:

| Mode | When | What renders |
|---|---|---|
| **preview** | Not selected and not active, or zoomed far out | Cheap, non-interactive summary derived from `customData` |
| **shell** | Selected but not actively editing | Structural chrome, title, affordances to enter live mode; no heavy internals |
| **live** | Actively editing or otherwise active | Full interactive overlay |

Separately, an overlay may be **culled** when it is offscreen and not pinned.

This is intentionally different from a `renderPreview`-only API. The parent must be
able to choose among `preview`, `shell`, and `live`, otherwise selected overlays
still have to mount their full heavy subtree.

### Parent-Owned Mode Contract

The shared overlay definition should move toward an explicit mode contract:

```ts
export type OverlayRenderMode = 'preview' | 'shell' | 'live';

interface OverlayRenderProps<K extends OverlayType> {
  element: TypedOverlayCanvasElement<OverlayCustomDataMap[K]>;
  mode: OverlayRenderMode;
  isSelected: boolean;
  isActive: boolean;
  zoom: number;
  onChange: (payload: OverlayUpdatePayloadMap[K]) => void;
  onActivityChange?: (isActive: boolean) => void;
}

export interface OverlayDefinition<K extends OverlayType> {
  // ...existing fields...
  render: (props: OverlayRenderProps<K>) => ReactElement;
}
```

This can be implemented incrementally. Overlays that do not yet special-case
`mode` can temporarily treat `shell` as `live`, but the shared contract should
represent the end state up front.

### Mode Decision in `OverlayItem`

```ts
if (isCulled && !isPinned) return null;

if (isActive) return 'live';
if (isSelected) return 'shell';
return 'preview';
```

At low zoom, selected overlays should still remain in `shell`, not drop all the way
to `preview`. Otherwise the user loses the affordances needed to enter or manage
live mode.

## Pinned Overlays

An overlay is **pinned** when it must remain mounted regardless of viewport
position. Pinned overlays are never culled.

An overlay should be pinned when any of the following are true:

- It is selected.
- It has reported active interaction via `onActivityChange(true)`.
- It owns a portal-backed mode that intentionally lives outside the canvas bounds.
  Example: `WebEmbed` PiP or expanded mode.

This is why culling cannot be treated as a purely local `OverlayItem` concern. The
layer must know which overlays are pinned before it decides whether to mount them.

## Phase 0: CSS Containment

**Files:** `CanvasNotesLayer.tsx`

**Effort:** very low.

Add `contain: layout paint` to the overlay container div in `OverlayItem`:

```ts
style={{
  ...containerStyle,
  pointerEvents: interactionEnabled ? 'auto' : 'none',
  contain: 'layout paint',
}}
```

This is a safe, isolated optimization. It does not solve the heavy subtree problem,
but it reduces browser work during pan and zoom.

## Phase 1: Activity Registry in `CanvasNotesLayer`

**Files:** `CanvasNotesLayer.tsx`

**Effort:** low-medium.

Before adding culling, lift per-overlay activity to `CanvasNotesLayer` so the layer
can make correct mount decisions.

Track a small registry:

```ts
type OverlayRuntimeState = {
  isActive: boolean;
};

const runtimeStateByIdRef =
  useRef<Record<string, OverlayRuntimeState>>({});
```

Each `OverlayItem` reports activity upward through one callback:

```ts
onActivityChange(elementId, isActive);
```

Notes:

- This callback should mean "must stay live/pinned", not necessarily "text cursor is
  in an editor."
- Existing overlay-specific `onEditingChange` implementations are inconsistent today.
  The contract should be normalized as activity, not raw editing.
- `WebEmbed` should report active while in PiP or expanded mode even when deselected.
- Avoid a naive `useState<Record<string, ...>>` registry in `CanvasNotesLayer`.
  Every activity transition would re-render the whole layer and every `OverlayItem`.
  Prefer a ref-backed registry plus a narrowly-scoped invalidation signal, or a
  dedicated store slice that only updates consumers that actually depend on the
  changed overlay's runtime state.

## Phase 2: Viewport Culling

**Files:** `CanvasNotesLayer.tsx`

**Effort:** medium once Phase 1 exists.

Add viewport dimensions to `CanvasNotesLayer` and skip rendering `OverlayItem`
entirely when the element's screen bounds fall outside the visible area plus a
margin.

Use the notes-layer bounds, not `window.innerWidth` / `window.innerHeight`. The
visible canvas can be smaller than the browser window because of surrounding chrome.

```ts
const MARGIN = 200;

const culled =
  screenRight < -MARGIN ||
  screenBottom < -MARGIN ||
  screenLeft > layerWidth + MARGIN ||
  screenTop > layerHeight + MARGIN;
```

Implementation notes:

- Measure the actual layer container with `ResizeObserver` or a ref-based
  `getBoundingClientRect`, not the global window.
- Culling happens in `CanvasNotesLayer`, before `OverlayItem` mounts.
- Never cull pinned overlays.
- Treat `MARGIN = 200` as a starting point, not an invariant. The right overscan
  value depends on pan speed, zoom behavior, and how noticeable mount pop-in feels
  in practice.
- Include tight regression tests around viewport edges: partially visible overlays,
  slightly offscreen overlays, and far offscreen overlays.

**Impact:** On large canvases this is likely the single highest-ROI shared change.
Unmounting offscreen overlays completely eliminates their runtime cost.

## Phase 3: Shared Render Mode Contract

**Files:** `overlay-definition-types.ts`, `overlay-definitions.tsx`, overlay components

**Effort:** medium.

Adopt the parent-owned `mode` contract for overlays. This is the structural unlock
for consistent LOD across the system and should land before one-off overlay mode
implementations.

### Per-overlay expectations

**markdown**

- `preview`: title plus a short plain-text excerpt from `content`
- `shell`: header and layout chrome, but no rich editing surface
- `live`: current full editor behavior

**newlex**

- `preview`: title plus extracted plain text from serialized lexical state
- `shell`: header and minimal frame only; do not instantiate Lexical
- `live`: current editor, comments, and plugins

**kanban**

- `preview`: board title, column names, card counts
- `shell`: title and lightweight board frame or summary; no drag/drop internals
- `live`: current board with drag/drop and panel logic

**prototype**

- `preview`: title, template badge, file count, optional stored preview thumbnail
- `shell`: metadata and navigation affordances only; no compiler worker or runtime
- `live`: current interactive preview/runtime behavior

Preview and shell must be derived only from `customData`. They must not instantiate
the editor engine, drag/drop context, iframe, worker, or runtime loop.

## Phase 4: WebEmbed Poster / Live

**Files:** `WebEmbed.tsx`, `overlay-definitions.tsx`

**Effort:** medium.

`WebEmbed` is the worst single offender because the iframe is expensive even when
interaction is disabled. Once the shared mode contract exists, it should be the
first overlay to adopt it.

- **preview** when not selected and not active
- **live** when selected or active (including PiP/expanded)

Poster rendering can be a static summary:

```tsx
<div className="...">
  <span>{hostname}</span>
  <span>{url}</span>
</div>
```

Rules:

- Inline iframe mounts only when the embed is selected or active.
- PiP and expanded modes remain live regardless of canvas selection.
- Deselecting a normal inline embed unmounts the iframe and accepts reload cost on
  the next selection.

`WebEmbed` does not need a dedicated shell mode if preview/live covers the useful
states.

## Phase 5: Zoom-Based Tuning

**Files:** `CanvasNotesLayer.tsx`, `OverlayItem`, individual overlays as needed

**Effort:** low after the main render-mode work exists.

Zoom should be treated as a later tuning pass, not the primary structural change.
Once preview and shell modes exist, a zoom threshold (suggested starting point:
`0.4`) can be used to make aggressive choices for overlays that still expose too
much chrome while zoomed far out.

Rules:

- Active overlays stay `live`
- Selected overlays stay at least `shell`
- Non-selected overlays stay `preview`
- Zoom must never downgrade a selected overlay all the way to `preview`

The threshold is a tuning knob, not a product invariant. Chosen value should be
validated by user feel and profiling, not treated as fixed architecture.

## Phase 6: Optional Interaction Lease

**Files:** `CanvasNotesLayer.tsx`

**Effort:** small-medium after the rest lands.

If the canvas still feels slow after culling and render modes, add an interaction
lease:

- When one overlay becomes active, other non-selected overlays prefer `preview`
- Selected-but-not-active overlays stay `shell`
- Only overlays that hold the lease stay fully `live`

This should be optional and data-driven. It is not required for the initial LOD
architecture to succeed.

## Rendering and Memoization Notes

Culling removes offscreen overlays completely, but it does not by itself solve
re-render churn for overlays that remain onscreen. `CanvasNotesLayer` still updates
in response to scroll, zoom, and selection changes, and preview-mode overlays should
be cheap enough to tolerate this.

Guidance:

- Memoize `OverlayItem` once render modes exist and compare the smallest possible
  set of props.
- Keep `preview` and `shell` render paths pure and shallow so they are inexpensive
  even when parent positioning changes frequently.
- Avoid passing unstable objects through preview-mode props unless they are required
  for rendering.

This is not a replacement for culling; it is the complementary optimization for the
overlays that remain mounted.

## Mount Transition Tradeoff

Moving an overlay from `preview` or `shell` into `live` can introduce cold-start
cost, because the heavy subtree may need to mount from scratch. This is expected and
should be called out explicitly, not treated as an accidental regression.

Known examples:

- `WebEmbed` accepts iframe reload cost when re-entering live mode
- `newlex` may pay a mount/setup cost when instantiating Lexical
- `prototype` live mode may pay worker/runtime startup cost

The goal is not to eliminate this cost entirely. The goal is to spend it only when
the user is actually engaging with the overlay, rather than for every overlay on the
canvas all the time.

## Recommended Implementation Order

1. **CSS containment**
2. **Activity registry in `CanvasNotesLayer`**
3. **Shared render mode contract**
4. **WebEmbed as the first adopter**
5. **Viewport culling using real layer bounds**
6. **Markdown + Kanban preview/shell**
7. **Newlex + Prototype preview/shell**
8. **Zoom-based LOD tuning**
9. **Interaction lease if still needed**

## Invariants to Maintain

- A pinned or active overlay is never culled.
- An active overlay is never downgraded below `live`.
- A selected overlay may downgrade from `live` to `shell`, but not to `preview`.
- Preview and shell rendering must read only from `customData`.
- Preview and shell components must avoid heavy internal state and effects.
- The canonical data model does not change. LOD modes are projections of
  `customData`, not alternate persisted representations.
- Portal-backed modes such as WebEmbed PiP/expanded are outside normal culling rules
  and remain pinned while active.

## Testing Guidance

- Add `CanvasNotesLayer` tests for culling around viewport edges:
  partially visible, slightly offscreen, and far offscreen overlays.
- Add tests that selected or active overlays are never culled.
- Add tests that activity updates do not accidentally force full-layer work beyond
  the overlays whose mode decisions actually changed.
- Add regression tests that preview/shell mode does not mount Lexical, drag/drop,
  iframe, or prototype runtime work.
- Add tests for WebEmbed PiP/expanded to ensure it remains live when deselected.

## What This Does Not Cover

- Collaborative presence or cursor rendering while overlays are in preview mode
  (out of scope for the first pass)
- Screenshot-based previews
- Worker-based preview rendering for simple semantic previews
