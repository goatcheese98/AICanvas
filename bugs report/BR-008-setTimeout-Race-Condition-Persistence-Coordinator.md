# BR-008: setTimeout Race Condition in CanvasPersistenceCoordinator

## Location

`apps/web/src/lib/persistence/CanvasPersistenceCoordinator.ts:114`

```typescript
private enqueueSave(canvasData: CanvasData, canvasId: string | null): void {
 // ... code omitted ...

 this._hasUnsavedChanges = true;
 this.emitStateChange();

 this.saveTimeout = setTimeout(() => {
  this.executeSave(canvasData, canvasId);
 }, SAVE_DEBOUNCE_MS);
}
```

## What the Bug Is

When `enqueueSave` is called multiple times in quick succession (e.g., user makes rapid changes), a new `setTimeout` is created without first clearing any existing timeout. This can cause:

1. **Multiple saves**: Multiple save operations may fire instead of being debounced
2. **Race conditions**: An older save might overwrite a newer one if they complete out of order
3. **Wasted resources**: Unnecessary save operations consume CPU and network bandwidth

## Why It's a Bug

The debounce logic should ensure that only one save happens after a period of inactivity. However, the current implementation:

1. Sets `_hasUnsavedChanges = true` every time `enqueueSave` is called
2. Creates a new `setTimeout` without clearing any existing one
3. This means rapid calls create multiple pending saves instead of debouncing

## Alternative Approaches

### Approach 1: Clear Existing Timeout Before Setting New One (Recommended)

```typescript
private enqueueSave(canvasData: CanvasData, canvasId: string | null): void {
 // ... code omitted ...

 this._hasUnsavedChanges = true;
 this.emitStateChange();

 // Clear any existing timeout before setting a new one
 if (this.saveTimeout) {
  clearTimeout(this.saveTimeout);
 }

 this.saveTimeout = setTimeout(() => {
  this.executeSave(canvasData, canvasId);
 }, SAVE_DEBOUNCE_MS);
}
```

### Approach 2: Only Update Data, Don't Reset Timer

```typescript
private enqueueSave(canvasData: CanvasData, canvasId: string | null): void {
 // ... code omitted ...

 // If there's already a pending save, just mark that we have changes
 // The pending save will pick up the latest data when it runs
 if (this.saveTimeout) {
  this._hasUnsavedChanges = true;
  this.emitStateChange();
  return;
 }

 this._hasUnsavedChanges = true;
 this.emitStateChange();

 this.saveTimeout = setTimeout(() => {
  this.executeSave(canvasData, canvasId);
 }, SAVE_DEBOUNCE_MS);
}
```

This approach is more efficient - it doesn't reset the timer on every change, only the first change starts the countdown.

## Priority

**High** - This can cause unnecessary save operations and potential race conditions with data consistency.

## Note

This pattern is sometimes intentional (to save the latest data), but it should be explicit and the code should clearly document this behavior. Currently, it's unclear if this is intentional or a bug.
