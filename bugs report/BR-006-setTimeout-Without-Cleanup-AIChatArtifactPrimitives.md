# BR-006: setTimeout Without Cleanup in AIChatArtifactPrimitives

## Location

`apps/web/src/components/ai-chat/AIChatArtifactPrimitives.tsx:29` and `:32`

```typescript
try {
 await writeToClipboard(value);
 setStatus('copied');
 onCopied?.();
 window.setTimeout(() => setStatus('idle'), 1400);  // <-- BUG
} catch {
 setStatus('failed');
 window.setTimeout(() => setStatus('idle'), 1600);  // <-- BUG
}
```

## What the Bug Is

The `setTimeout` callbacks are not cleaned up when the component unmounts. This can cause:

1. **Memory leaks**: The timeout continues to exist in the browser's timer queue after the component unmounts
2. **React state updates on unmounted components**: Calling `setStatus('idle')` after the component has unmounted can trigger React warnings
3. **Race conditions**: Multiple rapid clicks could create multiple overlapping timeouts that conflict with each other

## Why It's a Bug

This is the same bug pattern as BR-005. The component uses setTimeout to reset the status back to 'idle' after a copy operation, but:

- There's no cleanup when the component unmounts
- Multiple rapid clicks could create multiple overlapping timers
- The state update could fire after the component is unmounted

## Alternative Approaches

### Approach 1: Use useEffect with Cleanup (Recommended)

```typescript
const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

useEffect(() => {
 if (status === 'idle') return;
 
 const timeout = setTimeout(() => setStatus('idle'), status === 'copied' ? 1400 : 1600);
 return () => clearTimeout(timeout);
}, [status]);

const handleCopy = async () => {
 try {
  await writeToClipboard(value);
  setStatus('copied');
  onCopied?.();
 } catch {
  setStatus('failed');
 }
};
```

### Approach 2: Store Timeout Reference and Track Component Mount State

```typescript
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const isMountedRef = useRef(true);

useEffect(() => {
 return () => {
  isMountedRef.current = false;
  if (timeoutRef.current) {
   clearTimeout(timeoutRef.current);
  }
 };
}, []);

const handleCopy = async () => {
 if (timeoutRef.current) {
  clearTimeout(timeoutRef.current);
 }
 
 try {
  await writeToClipboard(value);
  if (isMountedRef.current) setStatus('copied');
  onCopied?.();
  timeoutRef.current = setTimeout(() => {
   if (isMountedRef.current) setStatus('idle');
  }, 1400);
 } catch {
  if (isMountedRef.current) {
   setStatus('failed');
   timeoutRef.current = setTimeout(() => {
    if (isMountedRef.current) setStatus('idle');
   }, 1600);
  }
 }
};
```

## Priority

**Medium** - This bug causes memory leaks and potential React warnings. Similar to BR-005.
