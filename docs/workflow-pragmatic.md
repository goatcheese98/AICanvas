# Pragmatic Worktree Workflow

A simplified worktree setup for solo developers with AI assistance. One command starts everything.

## The Setup

**Main workspace (where you are 90% of the time):**
```
/Users/rohanjasani/Desktop/Projects/AICanvas   <-- main worktree, main branch
```

**One side worktree (used as the build lane):**
```
/Users/rohanjasani/Desktop/Projects/AICanvas-fix-auth-bug
```

## Core Principle

> **Main worktree = review and merge lane**
>
> **One side worktree = build lane**

---

## Daily Workflow (Main Worktree)

This is the Codex lane.

Use it for:

- `main`
- review branches
- merge preparation
- final integration work

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas

# Start on main
git checkout main
git pull

# Review, fix, merge, and sync approved work
```

### Start all services (one command)

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas
bun run dev
```

This starts via **Turbo**:
- ✅ **Web** (React frontend) → http://localhost:5173
- ✅ **API** (Hono backend) → http://localhost:8787  
- ✅ **PartyKit** (WebSocket collaboration) → http://localhost:1999

All logs appear in one terminal with labels like `[web]`, `[api]`, `[partykit]`.

> **⚠️ First time only:** Turbo can't handle interactive prompts. If the API asks about database migrations, stop (Ctrl+C) and run the API standalone first:
> ```sh
> cd apps/api && bun run dev
> # Type Y to apply migrations, wait for "Ready on 8794"
> # Then stop (Ctrl+C) and run `bun run dev` from root
> ```
> Subsequent runs work fine with `bun run dev`.

---

## Creating the Side Worktree

Use the automated script:

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas
bun run worktree:new -- fix-login-redirect
```

This creates:
- Worktree: `../AICanvas-fix-login-redirect`
- Branch: `task/fix-login-redirect`
- Auto-assigned ports (5181/8791, 5182/8792, etc.)
- Synced docs and env files

### Working in the side worktree

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas-fix-login-redirect

# Install deps (first time only)
bun install

# Start all services (one command)
bun run dev
```

### Side worktree rules

- **One active side worktree:** Use one build lane at a time by default
- **Main purpose:** forward development for the next reviewable checkpoint
- **Meaningful commits:** save progress in clear checkpoints
- **Merge fast:** Don't let the side worktree drift too far from reviewed work
- **Delete after:** Remove worktree + delete branch after merge

## Two-Lane Model

Use this by default:

- Main worktree = Codex lane
- Side worktree = Kimi lane

This means:

- Kimi can keep building in the side worktree
- Codex can review and integrate in the main worktree
- `main` stays cleaner

If Phase 1 is being built while Phase 0 is still under review:

- keep Phase 0 review in the main worktree
- keep Phase 1 WIP in the side worktree

When the reviewed phase is finalized:

- sync the side-worktree branch to the approved result
- then open the next PR

---

## Port Conventions

| Worktree | Web Port | API Port | PartyKit |
|----------|----------|----------|----------|
| `AICanvas` (main) | 5173 | 8787 | 1999 |
| `AICanvas-<task1>` (side) | 5181 | 8791 | 1999 |
| `AICanvas-<task2>` (side) | 5182 | 8792 | 1999 |

**Note:** PartyKit uses port 1999 for all worktrees (shared service).

---

## Why This Workflow?

### For AI Assistance
- **One log stream:** Copy-paste everything for AI to debug
- **Full context:** AI sees frontend + backend + WebSocket interactions
- **No context switching:** `bun run dev` starts everything

### For Solo Development
- **Simple:** two lanes, not a maze of branches and worktrees
- **Isolated:** Each worktree has its own ports, no conflicts
- **Fast:** build in one lane while review happens in the other

---

## Quick Reference

```sh
# List worktrees
git worktree list

# Create side worktree for the build lane
bun run worktree:new -- <task-name>

# Start all services in any worktree
bun run dev

# Remove side worktree when done
git worktree remove ../AICanvas-<task-name>
git branch -d task/<task-name>
```

---

## Summary

| | Main Worktree | Side Worktree |
|--|---------------|---------------|
| **Branch** | `main` or current review/integration branch | active feature or phase branch |
| **Duration** | Ongoing | active build lane |
| **Scope** | review, fix, integrate, merge | forward development |
| **Count** | Always 1 | Usually 1 |
| **Start command** | `bun run dev` | `bun run dev` |

**Keep it simple. One review lane and one build lane. One command starts everything.**
