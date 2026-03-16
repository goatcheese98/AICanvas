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

- `/Users/rohanjasani/Desktop/Projects/AICanvas-overlay-runtime-lod`
- `/Users/rohanjasani/Desktop/Projects/AICanvas-assistant-image-pipeline`
- `/Users/rohanjasani/Desktop/Projects/AICanvas-prototype-workflow`

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

- `AICanvas-overlay-runtime-lod`
- `AICanvas-assistant-image-pipeline`
- `AICanvas-prototype-workflow`

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
- `AICanvas-overlay-runtime-lod` -> web `5174`
- `AICanvas-assistant-image-pipeline` -> web `5175`
- `AICanvas-prototype-workflow` -> web `5176`

`apps/web/vite.config.ts` supports:

- `VITE_PORT` or `PORT`
- `VITE_API_PROXY_TARGET` or `API_PROXY_TARGET`

Use them explicitly. Agents should not assume ports are assigned automatically.

### Default local lane model

By default, all local web lanes can share one API on `8787`.

Current local-dev defaults treat these preview origins as the standard lane set:

- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:5175`
- `http://localhost:5176`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`
- `http://127.0.0.1:5175`
- `http://127.0.0.1:5176`

This is implemented on the API side via
[local-dev-origins.ts](/Users/rohanjasani/Desktop/Projects/AICanvas/apps/api/src/lib/local-dev-origins.ts),
which is used by:

- [index.ts](/Users/rohanjasani/Desktop/Projects/AICanvas/apps/api/src/index.ts) for CORS
- [auth.ts](/Users/rohanjasani/Desktop/Projects/AICanvas/apps/api/src/middleware/auth.ts) for Clerk `authorizedParties`

Behavior:

- in development and test, configured origins/authorized parties are merged with the default local lane set
- in production, configured values remain scoped and are not expanded automatically

This means a shared local API on `8787` is the default and simplest setup when
the backend is not changing.

### When to use dedicated API ports

Use one shared API on `8787` when:

- the work is frontend-only
- multiple worktrees can safely talk to the same backend behavior
- you want the least operational overhead

Use dedicated API ports per worktree when:

- a branch changes API behavior
- you need isolated backend state or environment variables
- you want to compare backend variants side by side

Example dedicated backend lanes:

- `AICanvas-main` -> web `5173`, api `8787`
- `AICanvas-overlay-runtime-lod` -> web `5174`, api `8788`
- `AICanvas-assistant-image-pipeline` -> web `5175`, api `8789`
- `AICanvas-prototype-workflow` -> web `5176`, api `8790`

If a worktree needs its own API, point that worktree's web app at it with
`VITE_API_PROXY_TARGET`.

### Local auth/env sync requirement

New worktrees do not automatically receive local-only auth files.

To make `/login` work in a fresh sibling worktree, ensure these exist there:

- `apps/web/.env.local`
- `apps/api/.dev.vars`

Missing `apps/web/.env.local` causes the frontend to fail early with
`Missing VITE_CLERK_PUBLISHABLE_KEY`.

Missing or stale `apps/api/.dev.vars` can cause CORS failures or Clerk token
verification failures even if the frontend boots correctly.

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

- overlay runtime / LOD performance work
- assistant image pipeline work
- prototype workflow polish

## Launch Commands

### Integration lane

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-main/apps/web
bun run dev
```

### Overlay runtime lane

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-overlay-runtime-lod/apps/web
VITE_PORT=5174 bun run dev
```

### Assistant image pipeline lane

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-assistant-image-pipeline/apps/web
VITE_PORT=5175 bun run dev
```

### Prototype workflow lane

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-prototype-workflow/apps/web
VITE_PORT=5176 bun run dev
```

Shared API default:

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas/apps/api
bun run dev
```

If an execution lane needs its own API too, start that worktree's API on its
dedicated port and point `VITE_API_PROXY_TARGET` at it.

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
