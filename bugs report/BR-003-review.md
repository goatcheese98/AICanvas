# BR-003 Review

## Status

- **Bug ID**: BR-003
- **Status**: Reviewed
- **Verdict**: Report is inaccurate; no inconsistency bug demonstrated
- **Recommended priority**: Close with no functional fix required

## What The Report Claimed

The report says `removeThread` in
[`apps/web/src/components/ai-chat/useAIChatThreads.ts`](../apps/web/src/components/ai-chat/useAIChatThreads.ts)
lacks error handling, silently swallows failures, and updates local state even if deletion fails.

## What The Code Actually Does

In
[`apps/web/src/components/ai-chat/useAIChatThreads.ts`](../apps/web/src/components/ai-chat/useAIChatThreads.ts),
`setThreads(...)` and `setActiveThreadId(...)` only run after:

1. `getRequiredAuthHeaders(getToken)` resolves
2. `deleteAssistantThread(threadId, headers)` resolves

If either async call throws, local state is **not** mutated.

The error is also **not** swallowed:

- [`deleteAssistantThread`](../apps/web/src/lib/api.ts) throws when the HTTP request fails
- [`AIChatPanel.tsx`](../apps/web/src/components/ai-chat/AIChatPanel.tsx) catches the rejection in
  `handleDeleteThread` and calls `setChatError(...)`

So the two central claims in the report are incorrect:

- there is no optimistic local removal before server success
- there is no silent swallow in the user flow

## Corrected Assessment

This is not a correctness bug in the current implementation.

There is still a smaller design question:

- `useAIChatThreads` leaves error presentation to its caller
- `createThread` and `removeThread` do not own `setChatError(...)`

That is an API design choice, not a broken behavior.

## Recommended Action

No functional fix is required for BR-003.

Optional improvement:

- add a characterization test proving `removeThread` does not mutate thread state when
  `deleteAssistantThread(...)` rejects

That would make future regressions harder and would also prevent this specific misread from
returning later.

## What Derma Should Do Better Next Time

- Trace the full async flow before calling something a swallowed error.
- Check whether the mutation happens before or after the awaited call.
- Check call sites: a hook may intentionally propagate errors to the UI layer.
- Do not infer “silent failure” unless you have followed the error all the way to the user-facing
  boundary.
