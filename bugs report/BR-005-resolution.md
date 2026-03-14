# BR-005 Resolution

## Resolution Status

- **Bug ID**: BR-005
- **Outcome**: Fixed
- **Date**: 2026-03-14

## Final Decision

This was a valid bug.

The original report was directionally correct, and the final fix addressed both:

- timer cleanup on unmount
- overlapping timer races from repeated copy actions

## What I Confirmed

In
[`apps/web/src/components/overlays/lexical/LexicalToolbar.tsx`](../apps/web/src/components/overlays/lexical/LexicalToolbar.tsx),
the Markdown copy action used a raw `setTimeout(...)` with no reset or cleanup handling.

## Action Taken

I fixed this using a shared helper rather than a one-off patch.

Code changes:

- added
  [`apps/web/src/hooks/useResettableTimeout.ts`](../apps/web/src/hooks/useResettableTimeout.ts)
- updated
  [`apps/web/src/components/overlays/lexical/LexicalToolbar.tsx`](../apps/web/src/components/overlays/lexical/LexicalToolbar.tsx)

The helper:

- clears any previous pending timeout before scheduling a new one
- clears the timeout on unmount

## Verification

- added regression test:
  [`apps/web/src/components/overlays/lexical/LexicalToolbar.test.tsx`](../apps/web/src/components/overlays/lexical/LexicalToolbar.test.tsx)
- added shared helper test:
  [`apps/web/src/hooks/useResettableTimeout.test.tsx`](../apps/web/src/hooks/useResettableTimeout.test.tsx)

## Feedback Incorporated From Review

The review tightened the bug framing from generic “memory leak” language to the more useful
product behavior:

- repeated copy actions should not allow stale timers to win
- cleanup should be handled once in a reusable helper

## Feedback For The Reporting Agent

- When you see `setTimeout(...)` in UI state, check both cleanup and repeated-action race behavior.
- If the same timer pattern appears elsewhere, suggest a shared utility instead of multiple local
  fixes.
