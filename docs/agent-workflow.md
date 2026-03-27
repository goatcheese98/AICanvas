# Agent Workflow

Purpose: keep development fast while making merges into `main` disciplined and safe.

## Core Model

- Kimi is the primary builder.
- Codex is the reviewer, integrator, and merge gate.
- The goal is to separate speed from judgment, not to have both agents do the same job.

## Simple Rule

- Kimi builds on a branch.
- Codex reviews before merge.
- Only reviewed work goes to `main`.

## Default Operating Mode

Use a two-lane workflow by default:

- Lane 1: Codex review / integration lane
- Lane 2: Kimi build lane

In practice this means:

- one main worktree for `main`, review, and merge preparation
- one side worktree for Kimi's active feature or phase branch

Do not add more lanes unless the current setup becomes a real bottleneck.

## Terms

- `main`: the official safe version of the project
- `branch`: a separate working copy for a feature or phase
- `commit`: a saved checkpoint on that branch
- `PR` (Pull Request): the review step before changes go into `main`
- `merge`: moving approved work into `main`

## Roles

### Kimi

Kimi is the implementation agent.

Kimi should:

- do most feature development
- use sub-agents when helpful
- work on separate branches
- make multiple meaningful commits on the same branch
- move quickly during exploration
- prepare reviewable checkpoints

Kimi should not:

- assume a branch is safe to merge
- leave misleading UI behavior in a reviewable PR
- mix too many unrelated concerns if the branch is meant for review

### Codex

Codex is the review and merge-readiness agent.

Codex should:

- review branches or PRs against a named baseline
- identify regressions, misleading states, and mixed-scope changes
- decide whether work is:
  - safe to merge
  - safe with small cleanup
  - WIP only
  - better split before merge
- help choose the cleanest commits to merge if only part of a branch is good

Codex is the final quality gate before `main`.

## Preferred Workflow

### 1. Start with one larger goal

Use one larger goal per work stream. This can be:

- a GitHub issue
- a migration phase
- a clearly named feature

Examples:

- `V2 Phase 0: delete prototype overlay`
- `V2 Phase 1: shell scaffold`
- `Dock AI into right panel`

### 2. Use one working branch

Kimi should usually work on one branch per feature or phase.

Examples:

- `kimi/v2-phase0`
- `kimi/v2-shell`
- `kimi/docked-ai`

A branch may contain many commits. That is normal.

### 2A. Use two worktrees max by default

The default setup is:

- Main worktree: Codex lane
- Side worktree: Kimi lane

Use them like this:

- Main worktree holds `main`, current review branches, and merge/integration work
- Side worktree holds the active forward-development branch

This supports parallel progress without creating too much coordination overhead.

### 3. Make multiple meaningful commits

Good commit examples:

- `remove prototype from shared overlay types`
- `remove prototype from canvas overlay registry`
- `disable Prototype Studio save during Phase 0`

Bad commit examples:

- `fix stuff`
- `more changes`
- `try again`

One branch with many meaningful commits is preferred over many tiny branches.

### 4. Open a PR only at a real checkpoint

Do not open a PR for every tiny task.

Open a PR when the branch has reached a reviewable milestone.

A checkpoint is reviewable when:

- the branch has one clear purpose
- the user-facing behavior is honest
- basic verification has been run

Examples of good PR checkpoints:

- Phase 0 deletion is complete
- shell scaffold is usable
- docked AI is working
- collaboration footer is working

### 5. Codex reviews the PR

Codex reviews the PR or branch against the baseline.

Codex should answer:

- Is this safe to merge?
- Is this still WIP?
- Should this be split?
- Are only some commits worth merging?

### 6. Merge only reviewed work

Only after Codex review should work go to `main`.

## Branch Types

### Working branch

Purpose: active development.

Rules:

- can contain multiple commits
- can contain temporary experiments
- is the default place where Kimi works

### Snapshot branch

Purpose: preserve a messy state before cleanup or splitting.

Rules:

- may be incomplete
- may be mixed-scope
- should not be merged directly

Use this only when needed.

## Worktree Policy

Default:

- 1 main worktree
- 1 side worktree

Roles:

- Main worktree = review lane = Codex lane
- Side worktree = build lane = Kimi lane

Why:

- Kimi can keep building while Codex reviews or integrates the current phase
- `main` stays safer
- the workflow stays easy to understand

If Phase 1 is being built while Phase 0 is under review, keep:

- Phase 0 review/integration in the main worktree
- Phase 1 WIP in the side worktree

Once the reviewed phase is finalized, update the side-worktree branch so it sits on top of the approved result before opening the next PR.

## PR Rules

### Good PR size

A PR should be:

- large enough to represent real progress
- small enough to review clearly

Usually this means:

- one meaningful phase checkpoint
- one coherent user-facing milestone
- one architectural move

### Too small

Do not create PRs for:

- tiny internal steps
- random refactors with no review value
- every single subtask

### Too big

Split or delay review if:

- the PR mixes multiple phases
- the PR contains both deletion work and an unfinished replacement
- the reviewer must understand too many separate ideas
- the branch includes good work plus unrelated risky work

## Honest Behavior Rule

A reviewable PR must not mislead the user.

Bad:

- Save button exists but does nothing
- feature appears active but silently drops work
- placeholder action looks real

Good:

- disabled button
- clear temporary unavailable message
- route hidden or blocked
- explicit follow-up noted for the next phase

## Review Outcomes

Codex should classify PRs as one of:

- `Safe to merge`
- `Safe to merge with small cleanup`
- `Safe as WIP only`
- `Split before merge`
- `Do not merge`

Codex should also state:

- what was verified
- what remains unverified
- whether the PR matches the intended phase

## Handoff Format

When asking Codex to review, use this format:

- Baseline: `<commit or branch>`
- Branch: `<branch name>`
- Scope: `<one sentence>`
- Completed:
- Intentionally incomplete:
- Temporarily disabled:
- Verification:
- Requested decision:
  - safe to merge
  - safe with cleanup
  - WIP only
  - split guidance

Example:

- Baseline: `turnaround`
- Branch: `kimi/v2-phase0`
- Scope: remove prototype overlay from canvas flows
- Completed: removed prototype from shared types, canvas definitions, AI insertion paths
- Intentionally incomplete: focused prototype view not built yet
- Temporarily disabled: Prototype Studio save
- Verification: `bunx --bun tsc -p apps/web/tsconfig.json --noEmit`
- Requested decision: safe to merge or list blockers

## Commit Selection Rule

If one branch has many commits, Codex may recommend:

- merge the whole branch
- merge after one small cleanup
- merge only specific commits
- split the branch into a clean follow-up PR

That is normal.

One branch may contain many commits. One PR may represent that branch. Codex may still decide only part of it is ready.

## GitHub as the Shared Surface

Recommended use:

- Issue: larger goal or phase
- Branch: active implementation
- Commit: internal checkpoints
- PR: review checkpoint
- Review comments: back-and-forth discussion
- Merge: approved integration into `main`

## Practical Default

Use this by default:

- 1 larger goal
- 1 working branch in the side worktree
- multiple meaningful commits
- 1 PR when the work becomes reviewable
- Codex review before merge
- at most 2 worktrees total: main/review and side/build

Avoid:

- too many tiny PRs
- too many tiny issues
- too many worktrees
- merging mixed unfinished work directly into `main`
