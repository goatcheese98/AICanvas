# Multi-Agent Orchestration

This document defines how AI Canvas should be operated when multiple coding agents
work in parallel on separate Git worktrees.

The goal is simple:

- keep agent work isolated
- keep previews isolated
- keep merges predictable
- keep orchestration centralized

## Topology

Use three kinds of checkouts:

### 1. Orchestration worktree

Path:
`/Users/rohanjasani/Desktop/Projects/AICanvas`

Purpose:

- create and remove worktrees
- inspect branch and worktree status
- assign tasks to agents
- monitor progress across branches
- coordinate merges and cleanup

This is the control center. Avoid using it as the main implementation workspace.

### 2. Integration worktree

Path:
`/Users/rohanjasani/Desktop/Projects/AICanvas-main`

Purpose:

- stay on `main`
- validate integrated behavior
- resolve merge conflicts when needed
- run final smoke checks before or after merges

This should be opened less often than execution worktrees.

### 3. Execution worktrees

Examples:

- `/Users/rohanjasani/Desktop/Projects/AICanvas-assistant-image-pipeline`
- `/Users/rohanjasani/Desktop/Projects/AICanvas-prototype-workflow`
- `/Users/rohanjasani/Desktop/Projects/AICanvas-kanban-ui-polish`

Purpose:

- one active task per worktree
- one implementation agent thread per worktree
- one preview lane per worktree

Rule:
one worktree = one branch = one task = one preview URL

## Naming Conventions

Prefer task-based naming, not agent-based naming.

### Worktree folder names

Use:

- `AICanvas-main`
- `AICanvas-<task>`

Examples:

- `AICanvas-assistant-image-pipeline`
- `AICanvas-prototype-workflow`
- `AICanvas-kanban-ui-polish`

### Branch names

Use neutral prefixes:

- `task/<name>` for normal feature work
- `fix/<name>` for targeted bug fixes
- `spike/<name>` for experiments
- `chore/<name>` for repo maintenance

Avoid agent-specific prefixes like `codex/` or `claude/` for long-term workflow.

## Preview Port Conventions

Reserve the integration lane when possible:

- web `5173`
- api `8787`

Assign stable web ports to each execution worktree.

Example:

- `AICanvas-main` -> web `5173`
- `AICanvas-assistant-image-pipeline` -> web `5181`
- `AICanvas-prototype-workflow` -> web `5182`
- `AICanvas-kanban-ui-polish` -> web `5183`

`apps/web/vite.config.ts` supports:

- `VITE_PORT` or `PORT`
- `VITE_API_PROXY_TARGET` or `API_PROXY_TARGET`

Use them explicitly. Agents should not assume ports are assigned automatically.

### Fixed lane model

The integration lane stays on `5173` / `8787`.

Every execution worktree gets its own dedicated backend, and the frontend/backend
pair always share the same trailing digits:

- `AICanvas-assistant-image-pipeline` -> web `5181`, api `8791`
- `AICanvas-prototype-workflow` -> web `5182`, api `8792`
- `AICanvas-kanban-ui-polish` -> web `5183`, api `8793`

Going forward, new execution lanes continue from that pattern:

- next frontend port starts at `5181`
- next API port starts at `8791`
- frontend/backend pairs should keep matching final digits

Each worktree's `apps/web/.env.local` and `apps/api/.dev.vars` should be
patched to that worktree's own lane. Do not rely on a shared API by default.

### Local auth/env sync requirement

New worktrees do not automatically receive local-only auth files.
This is expected because `.env.local` and `.dev.vars` are gitignored local files,
not tracked project files.

To make `/login` work in a fresh sibling worktree, ensure these exist there:

- `apps/web/.env.local`
- `apps/api/.dev.vars`

Missing `apps/web/.env.local` causes the frontend to fail early with
`Missing VITE_CLERK_PUBLISHABLE_KEY`.

Missing or stale `apps/api/.dev.vars` can cause CORS failures or Clerk token
verification failures even if the frontend boots correctly.

Preferred shortcut:

```sh
bun run worktree:new -- <name>
```

This creates the sibling worktree, syncs the current orchestration docs
(`AGENTS.md`, `CLAUDE.md`, worktree/auth docs), and copies local env files when
they exist in the orchestration worktree.

## Command Placement Rules

Run implementation commands inside the specific execution worktree.

Examples:

- `codex`
- `claude`
- `bun run dev`
- `bun run test`
- `git status`
- `git add`
- `git commit`

Run orchestration commands in the orchestration worktree.

Examples:

- `git worktree add`
- `git worktree list`
- `git worktree remove`
- branch planning
- merge planning

## Delegation Rules

### Prompting

Plan in the orchestration worktree.
Implement in the execution worktree.

This means:

1. Decide task scope in the orchestration thread.
2. Open the target worktree as its own Codex or Claude workspace.
3. Give the implementation prompt in that worktree, not in the orchestration thread.

Each implementation prompt should include:

- exact worktree path
- expected branch name
- exact preview URL
- exact launch command
- explicit instruction not to use `5173`

### Task selection

Good parallel tasks are:

- high-value
- independently mergeable
- isolated to different subsystems

Avoid assigning multiple agents to the same hot files unless it is intentional.

### Recommended parallelization pattern

Use the orchestration thread to assign a small number of independent branches.

Current safe examples:

- assistant image pipeline work
- prototype workflow polish
- kanban UI polish

## Launch Commands

### Integration lane

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-main/apps/web
bun run dev
```

### Assistant image pipeline lane

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-assistant-image-pipeline/apps/web
VITE_PORT=5181 VITE_API_PROXY_TARGET=http://localhost:8791 bun run dev
```

### Prototype workflow lane

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-prototype-workflow/apps/web
VITE_PORT=5182 VITE_API_PROXY_TARGET=http://localhost:8792 bun run dev
```

### Kanban UI polish lane

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-kanban-ui-polish/apps/web
VITE_PORT=5183 VITE_API_PROXY_TARGET=http://localhost:8793 bun run dev
```

### Assistant image pipeline API

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-assistant-image-pipeline/apps/api
bun run dev -- --port 8791
```

### Prototype workflow API

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-prototype-workflow/apps/api
bun run dev -- --port 8792
```

### Kanban UI polish API

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-kanban-ui-polish/apps/api
bun run dev -- --port 8793
```

## PR and Merge Management

Treat each execution worktree branch as one PR.

Recommended flow:

1. Create worktree from `main`.
2. Implement inside that worktree.
3. Commit inside that worktree.
4. Push the branch.
5. Open a PR into `main`.
6. Merge one PR at a time.
7. Validate in `AICanvas-main`.
8. Remove the worktree and delete the branch when done.

Prefer narrow PRs and frequent merges.

Avoid stacked PRs unless dependency makes them necessary.

## Cleanup and Lifecycle

Preferred lifecycle:

1. Create worktree
2. Assign task
3. Implement
4. Open PR
5. Merge
6. Remove worktree
7. Delete branch

For finished or canceled work, prefer removing worktrees over renaming them.

## Important Gotcha: Worktree Sync

If the orchestration worktree changes local docs or instructions after execution
worktrees have already been created, those worktrees do not automatically inherit
the new uncommitted changes.

To propagate updated instructions, either:

- commit and merge/cherry-pick the changes, or
- manually sync the relevant files into the execution worktrees

Do not assume local uncommitted changes in one checkout are visible in sibling
worktrees.

## Quick Commands

Create a new task worktree from orchestration:

```sh
git worktree add -b task/<name> ../AICanvas-<name> main
```

Create a new task worktree and bootstrap local env/docs:

```sh
bun run worktree:new -- <name>
```

List worktrees:

```sh
git worktree list
```

Remove a finished worktree:

```sh
git worktree remove ../AICanvas-<name>
git branch -d task/<name>
```

## Decision Defaults For Future Agent Chats

When unsure, follow these defaults:

- use the orchestration worktree for planning and delegation
- use the execution worktree for actual code changes
- keep `main` isolated in `AICanvas-main`
- choose task-based worktree and branch names
- include exact port instructions in every implementation prompt
- prefer three independent lanes over many overlapping ones
- merge small independent branches back into `main` frequently
