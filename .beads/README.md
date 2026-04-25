# Beads Status For AI Canvas

AI Canvas is not currently using **bd (beads)** for routine agent tracking.

Do not run `bd ready`, create beads, update beads, or run `bd dolt push` as part of normal work
unless a human explicitly asks to reactivate Beads.

Use `CLAUDE.md` as the source of truth for agent workflow.

The existing `.beads/` files are retained only as dormant setup state for possible future use.

## Current Workflow

- Keep execution state in the current conversation.
- Report discovered follow-up work in the final summary.
- Do not create tracker items for routine coding or documentation work.
- Do not delete `.beads/dolt` or reset Beads state unless a human explicitly asks for destructive recovery.

## Historical Configuration

These values describe the dormant setup and are not active workflow requirements.

- Issue prefix: `aic`
- Storage: Dolt in `.beads/dolt`
- Auto-commit: `on`

## Reactivation

If Beads becomes useful later, a human should explicitly reintroduce the workflow in `CLAUDE.md`
before agents start using `bd` commands again.
