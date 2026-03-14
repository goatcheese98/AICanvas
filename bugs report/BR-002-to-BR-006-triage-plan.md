# BR-002 to BR-006 Triage Plan

## Scope Reviewed

Reviewed:

- all BR-002 through BR-006 report files
- their referenced implementation files
- related call sites and helper utilities
- repo-wide patterns for:
  - `as any` / `as unknown as`
  - timer lifecycle cleanup
  - async error propagation

Monorepo typecheck also passed on 2026-03-14.

## Corrected Verdicts

### BR-002

- Real maintainability issue
- Not strong evidence of a live user-facing bug
- Should be treated as a broader Excalidraw element-construction typing cleanup

### BR-003

- Report is inaccurate
- Deletion does not mutate local state before server success
- Errors propagate to the caller and are surfaced in the UI
- Close without functional fix

### BR-004

- Clarity-only issue
- Safe to close or leave for opportunistic cleanup

### BR-005

- Valid
- Should be fixed
- Best handled together with BR-006

### BR-006

- Valid
- Should be fixed
- Best handled together with BR-005

## Additional Codebase Finding From Review

The same timer-lifecycle class appears in
[`apps/web/src/hooks/useCollaboration.ts`](../apps/web/src/hooks/useCollaboration.ts).

`useThrottledCallback(...)` stores a pending timeout in a ref but does not clear that timeout on
hook unmount.

This is more central than BR-005/006 because it sits in collaboration behavior and is reused twice:

- `broadcastSceneThrottled`
- `broadcastCursorThrottled`

I would treat that as the next cleanup to fold into the same timer-safety pass.

## Priority Order

### 1. Timer lifecycle cleanup pass

Fix first:

- [`apps/web/src/components/overlays/lexical/LexicalToolbar.tsx`](../apps/web/src/components/overlays/lexical/LexicalToolbar.tsx)
- [`apps/web/src/components/ai-chat/AIChatArtifactPrimitives.tsx`](../apps/web/src/components/ai-chat/AIChatArtifactPrimitives.tsx)
- [`apps/web/src/hooks/useCollaboration.ts`](../apps/web/src/hooks/useCollaboration.ts)

Reason:

- valid bugs
- small, bounded fixes
- user-visible stale feedback / timer race behavior
- same implementation pattern

### 2. Excalidraw element typing cleanup

Fix second:

- [`apps/web/src/components/canvas/element-factories.ts`](../apps/web/src/components/canvas/element-factories.ts)
- [`apps/web/src/components/canvas/scene-element-normalizer.ts`](../apps/web/src/components/canvas/scene-element-normalizer.ts)
- [`apps/web/src/components/landing/canvas-tour-scene.ts`](../apps/web/src/components/landing/canvas-tour-scene.ts)
- [`apps/web/src/components/ai-chat/ai-chat-canvas.ts`](../apps/web/src/components/ai-chat/ai-chat-canvas.ts)

Reason:

- repeated type escape hatches
- lower immediate product risk
- better handled as one shared abstraction instead of local cast deletion

### 3. Close or downgrade inaccurate / clarity-only reports

Close:

- BR-003
- BR-004

Reason:

- they do not justify dedicated fix work
- leaving them as “high” or even active bugs would pollute the backlog

## Suggested Fix Strategy

### Batch A: timer safety

Implementation approach:

1. add a tiny local utility/hook for resettable timers or transient status
2. use it in the Lexical toolbar copy action
3. use it in AI chat copy buttons
4. add unmount cleanup to `useThrottledCallback(...)`
5. add fake-timer tests for overlap + unmount behavior

Expected outcome:

- removes two valid BRs and one broader repo issue in one pass

### Batch B: typed Excalidraw element creation

Implementation approach:

1. create one shared helper for app-authored Excalidraw elements
2. stop inventing local `index` strings with `as any`
3. model `index` honestly as `FractionalIndex | null`
4. replace repeated `as unknown as` element construction paths incrementally

Expected outcome:

- reduces future type escapes
- shrinks repeated casting patterns
- makes later overlay work safer

## What Derma Should Learn From These Cases

### 1. Follow the whole flow before assigning severity

BR-003 is the clearest example. The local function did not contain a `try/catch`, but that did not
mean failures were swallowed.

### 2. Separate code smell from product bug

BR-002 and BR-004 point at things worth improving, but they are not equivalent to confirmed
user-facing defects.

### 3. When a pattern repeats, report the pattern

BR-005 and BR-006 are really one shared timer-state problem, and BR-002 is really one shared
Excalidraw typing problem.

### 4. Prefer remediation plans that remove whole classes of bugs

Good reports do not just say “change this line”.
They identify whether the right fix is:

- a local patch
- a shared abstraction
- a closure of an inaccurate report
