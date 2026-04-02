# Beads Workflow For AI Canvas

This repository uses **bd (beads)** as the working memory system for multi-step work,
cross-window handoffs, and cross-agent coordination.

## Repo Defaults

- Issue prefix: `aic`
- Storage: Dolt in `.beads/dolt`
- Auto-commit: `on`

## Session Start

```bash
bd ready
```

Use `bd ready` first to resume unblocked work instead of relying on chat history.

If `bd ready` returns a bead, inspect it before coding:

```bash
bd show <issue-id>
```

If the work is genuinely net-new and multi-step, create a bead before the change.

## When To Create Or Update Beads

Use beads for:

- work that spans multiple sessions
- work that will be handed from one agent/window to another
- discovered follow-up work
- architecture checkpoints that need explicit verification and next steps

Do not create beads for tiny one-shot edits that can be completed in a single pass without
handoff value.

## Default Working Loop

1. Run `bd ready`.
2. Open the active bead with `bd show <issue-id>`.
3. Do the work.
4. Update the bead with the current checkpoint.
5. Close completed work or create/link the next bead.
6. Run `bd dolt push` at a meaningful checkpoint.

## Checkpoint Notes

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

## Handoff Expectations

1. Claim or inspect the active bead.
2. Do the work.
3. Update the bead with what was verified, what changed, remaining risks, and the next step.
4. Close completed work or create/link the next bead.
5. Run `bd dolt push` at a meaningful checkpoint so the tracker state is available to the next window.

## Dolt Recovery

If `bd ready`, `bd config list`, or auto-start fails, check whether this is a stale Dolt server
problem before assuming the Beads database is broken.

Quick checks:

```bash
bd dolt status
bd dolt show
tail -n 20 .beads/dolt-server.log
```

If the log says the database is locked by another Dolt process:

```bash
pgrep -af dolt
lsof +D .beads/dolt
```

If you find an orphaned Dolt process holding `.beads/dolt`, stop it and restart Beads:

```bash
kill <pid>
bd dolt start
bd ready
```

If there are multiple stale Beads Dolt processes and you know no active Beads session should remain
running, use:

```bash
bd dolt killall
bd dolt start
bd ready
```

Notes:

- `bd dolt status` may show `Expected port: 0` when `bd` has lost track of a still-running server.
- Do not delete `.beads/dolt` or reset Beads state unless a human explicitly asks for destructive recovery.
- Warnings like `nothing to commit` are usually normal; lock errors are the important signal.

## Notes

- `AGENTS.md` and `CLAUDE.md` remain the source of truth for repo workflow and coding rules.
- Beads is the system of record for live execution memory and handoff continuity.
