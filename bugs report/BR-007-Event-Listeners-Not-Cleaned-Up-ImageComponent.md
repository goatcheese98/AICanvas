# BR-007: Event Listeners Not Cleaned Up on Unmount in ImageComponent

## Location

`apps/web/src/components/overlays/lexical/nodes/ImageComponent.tsx:172-173`

```typescript
document.addEventListener('pointermove', onMove);
document.addEventListener('pointerup', onUp);
```

## What the Bug Is

Event listeners are added to `document` when the user starts resizing an image (pointer down), but they are only removed when the user releases the mouse (pointer up). If the component unmounts mid-drag (e.g., user navigates away, overlay is closed), these event listeners will persist on the document, causing:

1. **Memory leaks**: The listeners continue to exist after the component is gone
2. **Potential errors**: If the event fires after unmount, it could try to access cleaned-up React state/references

## Why It's a Bug

This is similar to the setTimeout cleanup issue (BR-005/BR-006), but for event listeners. The pattern here is:

- Add listeners on user interaction start
- Remove listeners on user interaction end
- Missing: cleanup on component unmount during interaction

## Alternative Approaches

### Approach 1: Use useEffect Cleanup (Recommended)

```typescript
useEffect(() => {
 return () => {
  // Clean up any pending drag listeners on unmount
  document.removeEventListener('pointermove', onMove);
  document.removeEventListener('pointerup', onUp);
 };
}, []); // Run once on mount/unmount
```

However, this requires storing the handler references in refs to access them in cleanup.

### Approach 2: Store Handlers in Refs

```typescript
const handlersRef = useRef<{
 onMove: ((e: PointerEvent) => void) | null;
 onUp: (() => void) | null;
}>({ onMove: null, onUp: null });

// In the handler:
const onMove = (moveEvent: PointerEvent) => { /* ... */ };
handlersRef.current.onMove = onMove;
const onUp = () => { /* ... */ };
handlersRef.current.onUp = onUp;

document.addEventListener('pointermove', onMove);
document.addEventListener('pointerup', onUp);

// In useEffect cleanup:
useEffect(() => {
 return () => {
  if (handlersRef.current.onMove) {
   document.removeEventListener('pointermove', handlersRef.current.onMove);
  }
  if (handlersRef.current.onUp) {
   document.removeEventListener('pointerup', handlersRef.current.onUp);
  }
 };
}, []);
```

### Approach 3: Track Drag State and Clean Up

```typescript
const isDraggingRef = useRef(false);

useEffect(() => {
 return () => {
  if (isDraggingRef.current) {
   // Component unmounted during drag - force end the drag
   document.removeEventListener('pointermove', onMove);
   document.removeEventListener('pointerup', onUp);
  }
 };
}, [onMove, onUp]);
```

## Priority

**Medium** - This causes memory leaks but requires user to navigate away mid-drag, which is an edge case.

## Related Bugs

This is similar to BR-005 and BR-006 (setTimeout cleanup), but for event listeners.
