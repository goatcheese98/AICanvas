# Pragmatic Worktree Workflow

A simplified worktree setup for solo developers with AI assistance. One command starts everything.

## The Setup

**Main workspace (where you are 90% of the time):**
```
/Users/rohanjasani/Desktop/Projects/AICanvas   <-- main worktree, main branch
```

**Occasional side worktrees (1-2 at a time, small scope):**
```
/Users/rohanjasani/Desktop/Projects/AICanvas-fix-auth-bug
/Users/rohanjasani/Desktop/Projects/AICanvas-try-experiment
```

## Core Principle

> **Main worktree = main branch = your primary workspace**
> 
> **Side worktrees = feature branches = quick tasks only**

---

## Daily Workflow (Main Worktree)

This is where you do most of your work.

```sh
cd /Users/rohanjasani/Desktop/Projects/AICanvas

# Start on main
git checkout main
git pull

# Create a feature branch
git checkout -b task/my-feature

# Work with AI, commit, push, PR
# When done: merge on GitHub, delete branch
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

## Creating a Side Worktree

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

- **Small scope:** 1-3 commits max
- **Quick turnaround:** Same day or next day
- **Merge fast:** Don't let side worktrees linger
- **Delete after:** Remove worktree + delete branch after merge

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
- **Simple:** One command per worktree
- **Isolated:** Each worktree has its own ports, no conflicts
- **Fast:** Create → Code → Commit → PR → Delete

---

## Quick Reference

```sh
# List worktrees
git worktree list

# Create side worktree for quick task
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
| **Branch** | `main` or long-lived feature | short-lived `task/` or `fix/` |
| **Duration** | Ongoing | Hours to 1-2 days |
| **Scope** | Primary development | Quick fixes/experiments |
| **Count** | Always 1 | 0-2 at a time |
| **Start command** | `bun run dev` | `bun run dev` |

**Keep it simple. Main worktree for real work. Side worktrees for quick detours. One command starts everything.**
