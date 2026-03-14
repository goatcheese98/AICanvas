# BR-006 Review

## Status

- **Bug ID**: BR-006
- **Status**: Reviewed
- **Verdict**: Valid
- **Recommended priority**: Medium

## What The Report Got Right

In
[`apps/web/src/components/ai-chat/AIChatArtifactPrimitives.tsx`](../apps/web/src/components/ai-chat/AIChatArtifactPrimitives.tsx),
`CopyButton` schedules status resets with `window.setTimeout(...)` and does not clear prior timers or
clean up on unmount.

That is a real issue.

## Why This One Matters

This component is a reusable primitive used in assistant artifact UI, so the pattern is easy to
repeat across multiple surfaces.

The practical failure mode is:

- user clicks quickly multiple times
- timers overlap
- `status` can reset to `'idle'` based on an older timer
- feedback text (`Copied` / `Retry`) becomes inconsistent

Unmount cleanup is still worth doing, but the race condition is the more important product effect.

## Recommended Solution

Batch BR-006 with BR-005 and implement one standard pattern for transient copy-state feedback:

- keep the active timer id in a ref
- clear any existing timer before starting a new one
- clear it on unmount

If the repo wants to make this reusable, a tiny hook such as `useTransientStatus` or
`useResettableTimeoutFlag` would fit well.

## Suggested Test Coverage

- rapid repeated clicks do not allow stale timers to reset the button early
- failed copy transitions back to idle on the expected delay
- unmount clears the pending timer

## What Derma Should Do Better Next Time

- When the same bug pattern appears in two UI components, call out the opportunity for a shared fix.
- Prefer framing the issue around user-visible stale feedback and timer races, not only generic
  cleanup language.
