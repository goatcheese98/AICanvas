# Beads Workflow For AI Canvas

This repository uses **bd (beads)** as the working memory system for multi-step work,
cross-window handoffs, and cross-agent coordination.

## Repo Defaults

- Issue prefix: `aic`
- Storage: Dolt in `.beads/dolt`
- Auto-commit: `on`

## Session Start

```bash
bd prime
bd ready
bd show <issue-id>
```

Use `bd ready` to resume unblocked work instead of relying on chat history.

## When To Create Or Update Beads

Use beads for:

- work that spans multiple sessions
- work that will be handed from one agent/window to another
- discovered follow-up work
- architecture checkpoints that need explicit verification and next steps

Do not create beads for tiny one-shot edits that can be completed in a single pass without
handoff value.

## Checkpoint Template

For checkpoint-driven work, keep the active bead updated with:

- `Current phase`
- `Verified current state`
- `Decision`
- `Verification`
- `Remaining risks`
- `Next step`

This repository uses beads as the live handoff ledger instead of ad hoc markdown summaries.

## Useful Commands

```bash
bd ready
bd show <issue-id>
bd create "Title" --type task --priority 2
bd update <issue-id> --notes "checkpoint summary"
bd update <issue-id> --design "implementation/design notes"
bd close <issue-id>
bd dolt push
```

## Suggested Handoff Loop

1. Claim or inspect the active bead.
2. Do the work.
3. Update the bead with what was verified, what changed, remaining risks, and the next step.
4. Close completed work or create/link the next bead.
5. Run `bd dolt push` at a meaningful checkpoint so the tracker state is available to the next window.

## Notes

- `AGENTS.md` and `CLAUDE.md` remain the source of truth for repo workflow and coding rules.
- Beads is the system of record for live execution memory and handoff continuity.
