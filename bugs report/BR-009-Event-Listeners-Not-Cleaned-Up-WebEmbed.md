# BR-009: Event Listeners Not Cleaned Up on Unmount in WebEmbed

## Location

`apps/web/src/components/overlays/web-embed/WebEmbed.tsx:231-232`

```typescript
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleUp);
```

## What the Bug Is

This is the same bug as BR-007 but in the WebEmbed component. Event listeners are added to `window` when the user starts dragging the PiP (picture-in-picture) frame, but they are only removed when the user releases the mouse. If the component unmounts mid-drag, these event listeners will persist.

## Why It's a Bug

Same as BR-007:

1. **Memory leaks**: The listeners continue to exist after the component is gone
2. **Potential errors**: If the event fires after unmount, it could try to access cleaned-up React state/references

## Alternative Approaches

Same as BR-007:

### Approach 1: Use useEffect Cleanup (Recommended)

```typescript
useEffect(() => {
 return () => {
  window.removeEventListener('mousemove', handleMove);
  window.removeEventListener('mouseup', handleUp);
 };
}, [handleMove, handleUp]);
```

### Approach 2: Track Drag State and Clean Up

```typescript
const isDraggingRef = useRef(false);

useEffect(() => {
 return () => {
  if (isDraggingRef.current) {
   window.removeEventListener('mousemove', handleMove);
   window.removeEventListener('mouseup', handleUp);
  }
 };
}, [handleMove, handleUp]);
```

## Priority

**Medium** - Same as BR-007 - causes memory leaks but requires user to navigate away mid-drag.

## Note

This is essentially the same bug pattern as BR-007 (ImageComponent) and could be fixed with a shared utility for drag handling that automatically cleans up on unmount.
