# BR-005: setTimeout Without Cleanup in LexicalToolbar

## Location

`apps/web/src/components/overlays/lexical/LexicalToolbar.tsx:471`

```typescript
const copyAsMarkdown = useCallback(() => {
 editor.getEditorState().read(() => {
  const markdown = $convertToMarkdownString(TRANSFORMERS);
  void navigator.clipboard.writeText(markdown).then(() => {
   setMarkdownCopied(true);
   setTimeout(() => setMarkdownCopied(false), 1800);  // <-- BUG
  });
 });
}, [editor]);
```

## What the Bug Is

The `setTimeout` callback is not cleaned up when the component unmounts. This can cause:

1. **Memory leaks**: The timeout continues to exist in the browser's timer queue after the component unmounts
2. **React state updates on unmounted components**: Calling `setMarkdownCopied(false)` after the component has unmounted can trigger React warnings ("Can't perform a React state update on an unmounted component")
3. **Potential runtime errors**: If the component structure changes significantly, the state update could fail

## Why It's a Bug

In React, when you use `setTimeout` inside callbacks or effects, you should clean it up when the component unmounts to prevent:

- Memory leaks
- State updates on unmounted components
- Unpredictable behavior

## Alternative Approaches

### Approach 1: Use useEffect with Cleanup (Recommended)

```typescript
const [markdownCopied, setMarkdownCopied] = useState(false);

useEffect(() => {
 if (!markdownCopied) return;
 
 const timer = setTimeout(() => setMarkdownCopied(false), 1800);
 return () => clearTimeout(timer);
}, [markdownCopied]);

const copyAsMarkdown = useCallback(() => {
 editor.getEditorState().read(() => {
  const markdown = $convertToMarkdownString(TRANSFORMERS);
  void navigator.clipboard.writeText(markdown).then(() => {
   setMarkdownCopied(true);
  });
 });
}, [editor]);
```

### Approach 2: Store Timeout Reference and Clear on Unmount

```typescript
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
 return () => {
  if (timeoutRef.current) {
   clearTimeout(timeoutRef.current);
  }
 };
}, []);

const copyAsMarkdown = useCallback(() => {
 editor.getEditorState().read(() => {
  const markdown = $convertToMarkdownString(TRANSFORMERS);
  void navigator.clipboard.writeText(markdown).then(() => {
   setMarkdownCopied(true);
   if (timeoutRef.current) clearTimeout(timeoutRef.current);
   timeoutRef.current = setTimeout(() => setMarkdownCopied(false), 1800);
  });
 });
}, [editor]);
```

## Priority

**Medium** - This bug causes memory leaks and potential React warnings, especially when the component is unmounted while the timeout is pending. It should be fixed to ensure proper resource cleanup.
