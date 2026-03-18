# No Direct useEffect Migration Guide

This document guides the migration from direct `useEffect` usage to safer patterns.

## Quick Reference: Replace useEffect

| Current Pattern | Replace With | Priority |
|----------------|--------------|----------|
| `useEffect(() => setX(compute(y)), [y])` | Derived state: `const x = compute(y)` | 🔴 High |
| `useEffect(() => fetch().then(setData), [])` | TanStack Query `useQuery()` | 🔴 High |
| `useEffect(() => { if (flag) action() }, [flag])` | Event handler: `onClick={() => action()}` | 🔴 High |
| `useEffect(() => subscribe(), [])` | `useMountEffect(() => subscribe())` | 🟡 Medium |
| `useEffect(() => { setup(); return () => cleanup() }, [])` | `useMountEffect(() => { setup(); return cleanup })` | 🟡 Medium |
| `useEffect(() => resetOnChange(id), [id])` | `<Component key={id} />` | 🟢 Low |

## Migration Strategy

### Phase 1: Infrastructure (Done)
- [x] Create `useMountEffect.ts` hook
- [x] Create `useSyncExternalStore.ts` helper
- [x] Update AGENTS.md with the rule
- [x] Update Biome config to warn on direct useEffect

### Phase 2: High-Impact Files (Batch with Refactoring)

Target these during our concurrent refactor:

| File | useEffects | Replacement Strategy |
|------|-----------|---------------------|
| `useKanbanBoardState.ts` | 13 | Split into: `useKanbanDragSync` (useSyncExternalStore), `useKanbanPersistence` (event handler), `useKanbanExternalSync` (useSyncExternalStore) |
| `useMarkdownNoteState.ts` | 12 | Same pattern as kanban |
| `useLexicalNoteState.ts` | 9 | Most are legitimate `useMountEffect` (editor lifecycle) |
| `useCanvasTourSceneController.ts` | 7 | Mix of derived state and useMountEffect |
| `WebEmbed.tsx` | 7 | Most are legitimate `useMountEffect` (iframe lifecycle) |

### Phase 3: Component-Level Migration

```typescript
// BEFORE: Derived state anti-pattern
function KanbanBoard({ items }) {
  const [filtered, setFiltered] = useState([]);
  useEffect(() => {
    setFiltered(items.filter(i => i.status === 'active'));
  }, [items]);
}

// AFTER: Compute inline
function KanbanBoard({ items }) {
  const filtered = items.filter(i => i.status === 'active');
}
```

```typescript
// BEFORE: Effect as action relay
function SaveButton() {
  const [shouldSave, setShouldSave] = useState(false);
  useEffect(() => {
    if (shouldSave) {
      saveData();
      setShouldSave(false);
    }
  }, [shouldSave]);
  return <button onClick={() => setShouldSave(true)}>Save</button>;
}

// AFTER: Direct event handler
function SaveButton() {
  return <button onClick={() => saveData()}>Save</button>;
}
```

```typescript
// BEFORE: Data fetching in effect
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
}

// AFTER: TanStack Query
function UserProfile({ userId }) {
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });
}
```

```typescript
// BEFORE: Direct useEffect for DOM setup
function LexicalEditor() {
  useEffect(() => {
    const editor = createEditor();
    return () => editor.destroy();
  }, []);
}

// AFTER: useMountEffect (the ONLY allowed useEffect)
function LexicalEditor() {
  useMountEffect(() => {
    const editor = createEditor();
    return () => editor.destroy();
  });
}
```

```typescript
// BEFORE: Reset logic in effect
function VideoPlayer({ videoId }) {
  useEffect(() => {
    loadVideo(videoId);
  }, [videoId]);
}

// AFTER: Key-based reset
function VideoPlayerWrapper({ videoId }) {
  return <VideoPlayer key={videoId} videoId={videoId} />;
}

function VideoPlayer({ videoId }) {
  useMountEffect(() => {
    loadVideo(videoId);
  });
}
```

## Sub-Agent Instructions

When refactoring files with useEffect:

1. **Identify the purpose** of each useEffect:
   - Derived state? → Move to inline computation
   - Data fetching? → Convert to useQuery (if not already)
   - Action relay? → Move to event handler
   - External sync? → Use useSyncExternalStore or useMountEffect

2. **Update imports**:
   ```typescript
   // Remove:
   import { useEffect } from 'react';
   
   // Add if needed:
   import { useMountEffect } from '@/hooks/useMountEffect';
   import { useSyncExternalStore } from '@/hooks/useSyncExternalStore';
   ```

3. **Verify no regressions**:
   - Test the refactored component thoroughly
   - Ensure cleanup functions still run
   - Check SSR compatibility

## Enforcement

Add to your IDE/editor:
```json
// Biome already handles this via AGENTS.md guidance
// For stricter enforcement, we can add a custom lint rule
```

## Success Metrics

- [ ] Zero new `useEffect` imports in PRs
- [ ] 115 → 0 direct useEffect calls (migrated to patterns above)
- [ ] Only `useMountEffect` and `useSyncExternalStore` remain
- [ ] No infinite loop bugs reported
- [ ] Faster renders (fewer effect cycles)
