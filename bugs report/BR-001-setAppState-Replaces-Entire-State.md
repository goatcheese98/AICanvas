# Bug Report: setAppState Replaces Entire State Instead of Merging

## Bug Details

- **Bug ID**: BR-001
- **Title**: setAppState replaces entire state instead of merging
- **Priority**: High
- **Status**: Identified
- **Location**: [`apps/web/src/stores/slices/canvasSlice.ts:46`](../apps/web/src/stores/slices/canvasSlice.ts#L46)

## Description

The `setAppState` function in the canvas slice replaces the entire appState object instead of merging new values with existing state. This causes all Excalidraw appState properties to be wiped out when only a subset is being updated.

## Why It's a Bug

Excalidraw's `appState` contains many critical properties including:

- `scrollX`, `scrollY` (viewport position)
- `zoom` (zoom level)
- `selectedElementIds` (currently selected elements)
- `viewBackgroundColor` (canvas background)
- `theme` (light/dark mode)
- `collaboratorCount` (real-time collaboration)
- Many other UI state properties

When `setAppState` is called with a partial object (e.g., `{ scrollX: 100 }`), all other properties are lost. This can cause:

1. Loss of zoom level when panning
2. Loss of selected elements when modifying the canvas
3. Theme switching unexpectedly
4. Other UI state corruption

### Evidence from Tests

The test file [`apps/web/src/stores/slices/canvasSlice.test.ts`](../apps/web/src/stores/slices/canvasSlice.test.ts#L133-L137) explicitly confirms this behavior:

```typescript
it('replaces entire app state', () => {
    store.getState().setAppState({ scrollX: 100 });
    store.getState().setAppState({ scrollY: 200 });
    expect(store.getState().appState).toEqual({ scrollY: 200 });
});
```

This test demonstrates that calling `setAppState` twice with different properties results in only the last one being preserved, confirming the bug.

## Approach 1: Shallow Merge (Recommended)

Modify `setAppState` to shallow merge with existing state:

```typescript
setAppState: (appState) => set((state) => ({ 
    appState: { ...state.appState, ...appState } 
})),
```

**Pros:**

- Simple fix
- Preserves backward compatibility with most usage patterns
- Minimal code change

**Cons:**

- Shallow merge doesn't handle nested objects well
- Deeply nested Excalidraw state properties might still be lost

## Approach 2: Deep Merge

Use a deep merge utility for nested object properties:

```typescript
import { merge } from '@/lib/merge-utils'; // hypothetical deep merge utility

setAppState: (appState) => set((state) => ({ 
    appState: merge(state.appState, appState) 
})),
```

**Pros:**

- Handles nested properties correctly
- More robust for complex state shapes

**Cons:**

- Adds dependency on deep merge utility
- More complex implementation
- May have performance implications for frequent updates

## Recommendation

**Approach 1** is recommended as the initial fix. The shallow merge should be sufficient for most use cases since Excalidraw's appState, while having many properties, is typically updated in a flat manner. If nested property issues are discovered during testing, a deep merge can be implemented as a follow-up.

## Related Files

- [`apps/web/src/stores/slices/canvasSlice.ts`](../apps/web/src/stores/slices/canvasSlice.ts)
- [`apps/web/src/stores/slices/canvasSlice.test.ts`](../apps/web/src/stores/slices/canvasSlice.test.ts)
- [`apps/web/src/components/canvas/CanvasCore.tsx`](../apps/web/src/components/canvas/CanvasCore.tsx) - calls setAppState
- [`apps/web/src/components/landing/useCanvasTourSceneController.ts`](../apps/web/src/components/landing/useCanvasTourSceneController.ts) - calls setAppState
