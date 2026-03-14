# Overlay Authoring Pattern

Complex overlays should follow one composition pattern so both humans and code generation tools learn the same structure from the repo.

## Boundary
- Normalize `customData` once at the container boundary.
- Keep persisted data writes behind one `onChange` path.
- Keep edit lifecycle reporting behind one `onEditingChange` path.

## Shape
- `...Container.tsx` owns element integration, persistence, and top-level layout.
- `use...State.ts` owns local draft state, external-to-local sync, debounced commits, and derived view state.
- `use...Actions.ts` or focused hooks own domain mutations or interaction state when the behavior is complex enough to isolate.
- Focused child components own toolbars, settings panels, dialogs, and display-only sections.

## State Rules
- Persisted domain state and transient UI state should not be mixed into one unstructured object.
- Use pure helper modules for normalization, serialization, projection, and other non-React logic.
- Keep mutation helpers pure whenever possible so they are easy to test without rendering components.

## File Size Guidance
- Treat files above roughly 300-400 lines as a split candidate.
- Split earlier when a file mixes orchestration, domain mutations, and large JSX sections.
- If a component starts owning both state synchronization and multiple independent UI regions, extract the UI regions first and then move state into a hook.

## Migration Guidance
- New overlay work should follow this pattern immediately.
- Existing overlays can be migrated incrementally, but do not add new code using older monolithic patterns.
- Lexical can stay feature-rich, but future work there should still prefer pure helpers and smaller orchestration boundaries.
