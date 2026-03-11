# AI Canvas

AI Canvas is a visual workspace for thinking through ideas, organizing work, and turning rough concepts into something a team can actually use.

## Why This App Exists

Most product, design, and strategy work gets scattered across too many tools:

- whiteboards for brainstorming
- docs for notes
- task boards for execution
- chat tools for discussion
- prototypes for showing what an idea might become
- AI tools that live in a separate window from the work itself

That creates a simple problem: people can have the idea, but still struggle to explain it, shape it, and move it forward in one place.

## The Problem

Teams often need to do all of this at once:

- sketch a concept visually
- write down decisions and context
- break work into tasks
- prototype a direction
- collaborate with others
- ask AI for help while staying inside the same workflow

When those steps happen in separate apps, context gets lost. Non-technical stakeholders see fragments instead of the full picture, and builders waste time moving information from one tool to another.

## The Solution

AI Canvas brings those activities into one workspace.

Instead of jumping between a whiteboard, a notes app, a kanban tool, and an AI chat, a team can open one canvas and:

- place formatted notes directly on the canvas
- add rich text documents with comments
- create kanban boards for planning and execution
- embed websites or references
- attach interactive prototype overlays
- collaborate live with other people
- use the assistant to generate content and place it onto the canvas

In plain terms: this app exists to help people go from "we have an idea" to "we can show it, explain it, and act on it" without losing momentum.

## What Is Built Today

The current standalone rebuild includes:

- a dashboard for creating, browsing, renaming, favoriting, and deleting canvases
- canvas previews and saved canvas metadata
- an Excalidraw-based canvas with custom overlays
- markdown notes with formatting and images
- rich text notes powered by Lexical
- kanban boards for planning work
- web embeds
- prototype overlays with preview support
- an AI assistant panel that can generate canvas-ready artifacts
- real-time collaboration through PartyKit
- local and server-backed persistence

## Who It Is For

AI Canvas is useful for:

- founders shaping a product idea
- designers mapping flows and sharing context
- product managers turning messy thinking into a plan
- developers discussing implementation visually
- teams that need a shared workspace instead of a pile of disconnected tools

## Tech Stack

- React 19 + Vite + TypeScript
- TanStack Router + TanStack Query
- Zustand
- Hono API
- Drizzle + Cloudflare D1
- Cloudflare R2
- Clerk authentication
- PartyKit collaboration
- Excalidraw canvas
- Lexical editor
- Bun + Turborepo

## Running Locally

Requirements:

- Node.js 20+
- Bun 1.1+

Install dependencies:

```bash
bun install
```

Start the workspace:

```bash
bun run dev
```

Useful commands:

```bash
bun run test
bun run typecheck
bun run lint
```

## Project Notes

- Architecture rationale: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Rebuild progress and porting notes: [REBUILDING.md](./REBUILDING.md)

## Status

This repository is an active standalone rebuild of the original canvas product. The goal is to preserve the product behaviors that already work, remove framework complexity, and make the app easier to extend.
