# BR-002 Resolution

## Resolution Status

- **Bug ID**: BR-002
- **Outcome**: Not Fixed
- **Date**: 2026-03-14

## Final Decision

I did not apply a code change for BR-002 in this pass.

This report identified a real maintainability problem, but not a confirmed user-facing defect that
should outrank the valid timer bugs.

## What I Confirmed

The unsafe casting pattern is real in
[`apps/web/src/components/canvas/element-factories.ts`](../apps/web/src/components/canvas/element-factories.ts),
but it is also repeated in other files:

- [`apps/web/src/components/canvas/scene-element-normalizer.ts`](../apps/web/src/components/canvas/scene-element-normalizer.ts)
- [`apps/web/src/components/landing/canvas-tour-scene.ts`](../apps/web/src/components/landing/canvas-tour-scene.ts)
- [`apps/web/src/components/ai-chat/ai-chat-canvas.ts`](../apps/web/src/components/ai-chat/ai-chat-canvas.ts)

That makes BR-002 a broader Excalidraw element-construction typing problem, not a safe local patch.

## Action Taken

No code change was made for BR-002.

Instead, I documented the corrected scope and recommended fix strategy in:

- [`bugs report/BR-002-review.md`](./BR-002-review.md)
- [`bugs report/BR-002-to-BR-006-triage-plan.md`](./BR-002-to-BR-006-triage-plan.md)

The recommended future fix is:

1. create a shared helper for app-authored Excalidraw elements
2. stop inventing ad hoc `index` strings with casts
3. model `index` as `FractionalIndex | null`
4. migrate repeated construction sites together

## Verification

- monorepo typecheck passed after the broader review
- no code path was changed for this BR in the current pass

## Feedback Incorporated From Review

The review changed the resolution from “clean up one bad cast” to “treat this as a repeated typing
pattern and plan a shared abstraction”.

## Feedback For The Reporting Agent

- When you find `as any` or `as unknown as`, search for the same pattern repo-wide before writing
  the fix recommendation.
- Distinguish between code health issues and confirmed product bugs.
- If the problem is repeated, recommend one shared solution instead of a local edit.
