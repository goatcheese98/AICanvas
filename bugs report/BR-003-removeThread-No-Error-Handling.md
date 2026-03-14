# Bug Report: removeThread Has No Error Handling

## Bug Details

- **Bug ID**: BR-003
- **Title**: removeThread function lacks error handling and can cause inconsistent state
- **Priority**: High
- **Status**: Identified
- **Location**: [`apps/web/src/components/ai-chat/useAIChatThreads.ts:108`](../apps/web/src/components/ai-chat/useAIChatThreads.ts#L108)

## Description

The `removeThread` function in `useAIChatThreads` is an async function that deletes a chat thread, but it lacks proper error handling. If the API call to delete the thread fails, the error is silently swallowed and the local state is still updated.

## Why It's a Bug

1. **Silent Failures**: If `getRequiredAuthHeaders` or `deleteAssistantThread` throws an error, it will be silently swallowed (no catch block)
2. **Inconsistent State**: The local state is updated to remove the thread regardless of whether the server call succeeded, leading to UI/server state mismatch
3. **Poor User Experience**: Users believe they've deleted a thread, but:
   - The API call failed silently
   - The thread still exists on the server
   - When they reload the page, the thread reappears
   - They receive no feedback that the operation failed

## Affected Code

```typescript
const removeThread = useCallback(
    async (threadId: string) => {
        const headers = await getRequiredAuthHeaders(getToken);
        await deleteAssistantThread(threadId, headers);  // <-- No try/catch!
        let nextActiveThreadId: string | null = null;
        setThreads((currentThreads) => {
            const remainingThreads = currentThreads.filter((thread) => thread.id !== threadId);
            nextActiveThreadId = remainingThreads[0]?.id ?? null;
            return remainingThreads;
        });
        setActiveThreadId((current) => (current === threadId ? nextActiveThreadId : current));
    },
    [getToken],
);
```

## Approach 1: Add Try/Catch with Error Handling (Recommended)

Wrap the API calls in a try/catch block and handle errors appropriately:

```typescript
const removeThread = useCallback(
    async (threadId: string) => {
        try {
            const headers = await getRequiredAuthHeaders(getToken);
            await deleteAssistantThread(threadId, headers);
            let nextActiveThreadId: string | null = null;
            setThreads((currentThreads) => {
                const remainingThreads = currentThreads.filter((thread) => thread.id !== threadId);
                nextActiveThreadId = remainingThreads[0]?.id ?? null;
                return remainingThreads;
            });
            setActiveThreadId((current) => (current === threadId ? nextActiveThreadId : current));
        } catch (error) {
            console.error('Failed to delete thread:', error);
            // Optionally show error to user via setChatError
        }
    },
    [getToken],
);
```

**Pros:**

- Proper error handling
- Can notify user of failures

**Cons:**

- Still updates local state before API call - could cause issues if we want to revert on failure

## Approach 2: Optimistic Update with Rollback

Only update local state after successful API call:

```typescript
const removeThread = useCallback(
    async (threadId: string) => {
        const previousThreads = threads; // Store for potential rollback
        let nextActiveThreadId: string | null = null;

        // Optimistic update
        setThreads((currentThreads) => {
            const remainingThreads = currentThreads.filter((thread) => thread.id !== threadId);
            nextActiveThreadId = remainingThreads[0]?.id ?? null;
            return remainingThreads;
        });
        setActiveThreadId((current) => (current === threadId ? nextActiveThreadId : current));

        try {
            const headers = await getRequiredAuthHeaders(getToken);
            await deleteAssistantThread(threadId, headers);
        } catch (error) {
            // Rollback on failure
            setThreads(previousThreads);
            console.error('Failed to delete thread:', error);
        }
    },
    [getToken, threads],
);
```

**Pros:**

- Better user experience - UI updates immediately
- Can rollback on failure for consistency

**Cons:**

- More complex code
- Still doesn't show error to user unless we add toast/error state

## Recommendation

**Approach 1** is recommended as a minimum fix. The team should add proper error handling to prevent silent failures. If the UI needs to update optimistically for better UX, Approach 2 can be considered as a follow-up improvement.

## Related Files

- [`apps/web/src/components/ai-chat/useAIChatThreads.ts`](../apps/web/src/components/ai-chat/useAIChatThreads.ts)
- [`apps/web/src/lib/api.ts`](../apps/web/src/lib/api.ts) - Contains `deleteAssistantThread`
