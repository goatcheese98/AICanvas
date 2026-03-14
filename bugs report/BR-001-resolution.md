# BR-001 Resolution

## Resolution Status

- **Bug ID**: BR-001
- **Outcome**: Fixed
- **Date**: 2026-03-14

## Final Decision

The original report pointed at a real issue, but the best fix was not to change `setAppState(...)`
in isolation.

The real production problem was that the app sometimes updated Excalidraw programmatically and then
left the Zustand store out of sync with the actual Excalidraw scene.

## What I Confirmed

- The store setter in
  [`apps/web/src/stores/slices/canvasSlice.ts`](../apps/web/src/stores/slices/canvasSlice.ts)
  does replace the stored `appState`.
- The more important bug was broader: several `updateScene(...)` paths were not resyncing the app
  store from Excalidraw afterward.

## Action Taken

I fixed the problem by making Excalidraw the source of truth after programmatic scene updates.

Code changes:

- added
  [`apps/web/src/components/canvas/excalidraw-store-sync.ts`](../apps/web/src/components/canvas/excalidraw-store-sync.ts)
- updated
  [`apps/web/src/components/canvas/CanvasContainer.tsx`](../apps/web/src/components/canvas/CanvasContainer.tsx)
- updated
  [`apps/web/src/components/canvas/CanvasUI.tsx`](../apps/web/src/components/canvas/CanvasUI.tsx)
- updated
  [`apps/web/src/components/landing/useCanvasTourSceneController.ts`](../apps/web/src/components/landing/useCanvasTourSceneController.ts)

I also fixed the guided-tour snapshot flow so files are added to Excalidraw before the store is
resynced.

## Verification

- added regression test:
  [`apps/web/src/components/canvas/excalidraw-store-sync.test.ts`](../apps/web/src/components/canvas/excalidraw-store-sync.test.ts)

## Feedback Incorporated From Review

The review correctly pushed the fix away from “make the setter merge” and toward the actual system
boundary:

- check `updateScene(...)` call sites
- verify how Excalidraw merges state
- resync the app-managed mirror after programmatic mutations

## Feedback For The Reporting Agent

- Do not stop at the local setter implementation when state is mirrored across systems.
- When a bug involves Excalidraw integration, inspect both the Excalidraw API call and the app
  store synchronization path.
- Recommend the narrow fix only after checking whether the bug is really local or architectural.
