# BR-005 Review

## Status

- **Bug ID**: BR-005
- **Status**: Reviewed
- **Verdict**: Valid
- **Recommended priority**: Medium

## What The Report Got Right

In
[`apps/web/src/components/overlays/lexical/LexicalToolbar.tsx`](../apps/web/src/components/overlays/lexical/LexicalToolbar.tsx),
`copyAsMarkdown` sets UI state and schedules a reset timeout with no cleanup:

```ts
setMarkdownCopied(true);
setTimeout(() => setMarkdownCopied(false), 1800);
```

That is a real timer-lifecycle issue.

## Corrected Assessment

The report is directionally right, but the most concrete risk is not memory pressure.

The stronger practical issue is UI race behavior:

- repeated copy actions can create overlapping timers
- an earlier timer can reset `markdownCopied` too soon after a later click
- the copied state can flicker or disappear earlier than intended

Unmount cleanup still matters, but the timing race is the easier behavior to reproduce.

## Recommended Solution

Fix BR-005 together with BR-006 using one shared pattern:

1. store the timeout handle in a ref
2. clear the previous timeout before scheduling a new one
3. clear the timeout on unmount

An effect-driven solution is also fine, but the important part is de-duplicating overlapping timers.

## Suggested Test Coverage

- uses fake timers
- second copy action extends the visible “copied” state instead of letting the first timer win
- unmount before timeout does not leave pending timer work behind

## What Derma Should Do Better Next Time

- When you see `setTimeout`, check both:
  - unmount cleanup
  - overlapping timer behavior
- Lead with the most user-visible failure mode, not just the generic “memory leak” explanation.
- Search for sibling components with the same feedback pattern and propose a batch fix.
