# BR-006 Resolution

## Resolution Status

- **Bug ID**: BR-006
- **Outcome**: Fixed
- **Date**: 2026-03-14

## Final Decision

This was a valid bug.

The fix was implemented as part of the same timer-safety pass as BR-005 because both reports were
describing the same UI timer pattern.

## What I Confirmed

In
[`apps/web/src/components/ai-chat/AIChatArtifactPrimitives.tsx`](../apps/web/src/components/ai-chat/AIChatArtifactPrimitives.tsx),
the copy button scheduled reset timers directly with `window.setTimeout(...)` and did not cancel
older timers.

## Action Taken

I applied the shared timeout helper instead of adding component-local timer refs.

Code changes:

- added
  [`apps/web/src/hooks/useResettableTimeout.ts`](../apps/web/src/hooks/useResettableTimeout.ts)
- updated
  [`apps/web/src/components/ai-chat/AIChatArtifactPrimitives.tsx`](../apps/web/src/components/ai-chat/AIChatArtifactPrimitives.tsx)

Related cleanup from the same pass:

- updated
  [`apps/web/src/components/overlays/lexical/LexicalToolbar.tsx`](../apps/web/src/components/overlays/lexical/LexicalToolbar.tsx)
- updated
  [`apps/web/src/hooks/useCollaboration.ts`](../apps/web/src/hooks/useCollaboration.ts)

## Verification

- added regression test:
  [`apps/web/src/components/ai-chat/AIChatArtifactPrimitives.test.tsx`](../apps/web/src/components/ai-chat/AIChatArtifactPrimitives.test.tsx)
- added shared helper test:
  [`apps/web/src/hooks/useResettableTimeout.test.tsx`](../apps/web/src/hooks/useResettableTimeout.test.tsx)

## Feedback Incorporated From Review

The review correctly reframed the issue as a shared timer-state bug class, not just a single
component cleanup task.

## Feedback For The Reporting Agent

- When two reports describe the same failure pattern, suggest one batch fix.
- Prefer a reusable resolution when the bug is about a repeated UI state-management pattern.
