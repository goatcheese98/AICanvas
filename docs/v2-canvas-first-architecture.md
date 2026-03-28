# V2 Canvas-First Architecture

Status: Proposed

Companion spec: `docs/v2-shell-layout-interaction-spec.md`

Purpose: Define the active v2 architecture for AI Canvas. This document is the current source of truth for product identity, layout, navigation, data contracts, and migration order.

## 1. Executive Summary

V2 is a canvas-first product.

We are not building a Notion-style workspace home first.
We are not building a large artifact operating system first.
We are not keeping Excalidraw as the host runtime for heavy editors.

We are building a project workspace where:

- opening a project lands the user directly in a canvas
- the canvas is the visual map of the project
- a left sidebar lists the rest of the project resources
- heavy resources open in focused views outside Excalidraw
- AI becomes a docked contextual tool, not a floating canvas modal
- collaboration/presence moves into the account/workspace area, not a giant primary button

This is a deletion-first simplification, not a net-new platform expansion.

## 2. Product Identity

AI Canvas is a whiteboard-first workspace.

Its core differentiator is:

- spatial thinking
- visual connections
- lightweight notes and references
- AI-assisted visual work
- linking from the canvas into deeper work

It is not primarily:

- a tiled workspace launcher
- a general artifact dashboard
- a document-first product
- a kanban-first product

That means the canvas is the emotional and navigational center of the product.

## 3. Core Principles

### 3.1 Whiteboard First

Projects open into a canvas, not a tiled project home.

### 3.2 Delete Before Add

Any new structural layer must replace or remove an old one.

We do not accept "add sidebar now, delete overlays later" as a valid outcome.

### 3.3 One Place Per Job

Each major user job should have one primary surface.

- spatial thinking -> canvas
- deep writing -> document view
- task planning -> board view
- code/prototype editing -> prototype view

### 3.4 Canvas Is a Map, Not a Host

The canvas can represent heavy resources, but should not fully host their deep editing runtime.

### 3.5 Navigation Is Stable, Tools Are Contextual

Global navigation belongs in one place.
Contextual editing tools belong in one place.

We do not scatter major controls around the corners of the screen.

## 4. Scope Decisions

### 4.1 What V2 Includes

- project shell
- canvas-first entry
- left sidebar navigation
- focused views for heavy resources
- right-side contextual panel
- docked AI panel
- simplified collaboration affordance
- deletion of canvas-hosted heavy overlays over time

### 4.2 What V2 Does Not Include Initially

- tiled project home as the default entry
- first-class user-facing asset browser as a major navigation section
- full heavy artifact editing inside Excalidraw
- a large standalone workspace/profile side panel
- multiple competing global launch buttons

## 5. The Project Model

### 5.1 Project

A project is the top-level container.

Examples:

- `Study Review for CS50`
- `Mobile App Redesign`
- `Founding Narrative`

### 5.2 Resources Inside a Project

V2 resources:

- Canvas
- Document
- Board
- Prototype

Internal/supporting resources:

- images
- vectors
- stored assistant outputs

These supporting resources are important, but they are not first-class user navigation objects in v2.

### 5.3 Default Entry

When the user opens a project:

- the app opens directly to that project's default canvas
- this is usually an `Overview Canvas`

If no canvas exists yet:

- create one automatically
- open it immediately

There is no intermediate project home screen in v2.

## 6. App Shell

The shell has three stable zones:

```text
| Left Sidebar | Main Content Area | Right Panel |
```

There is also a small right-edge trigger area or inline header controls for opening panel modes, but there is no giant independent floating utility surface.

### 6.1 Left Sidebar

The left sidebar is the persistent project spine.

Purpose:

- show where the user is
- list project resources
- provide create actions
- hold account/workspace/collaboration controls

Contents:

- project title
- current view label
- `+ New` action
- resource list area
- bottom area with avatar, presence, share, settings

The sidebar is part of layout.
It is not an overlay on top of Excalidraw.

If the sidebar is visible:

- the canvas or focused view gets less width

### 6.2 Main Content Area

This is the primary working pane.

It shows exactly one thing at a time:

- Excalidraw canvas
- board view
- document view
- prototype view

It is never shared with a second full editor.

### 6.3 Right Panel

The right panel is the only contextual tool surface.

Possible modes:

- AI
- Details
- Activity later if needed

Rules:

- closed by default
- only one mode open at a time
- docks into layout
- shrinks the main content area when open
- never appears as a giant floating modal over the canvas by default

## 7. Control Placement Rules

This is the strict placement model for global actions.

### 7.1 Navigation

Navigation belongs in the left sidebar.

That includes:

- switching canvases
- opening documents
- opening boards
- opening prototypes
- returning to other project resources

### 7.2 Creation

Creation belongs in:

- the `+ New` affordance in the left sidebar
- command menu / keyboard shortcuts
- contextual insert actions inside the current view

It does not belong as an unrelated top-right global button.

### 7.3 Contextual Tools

Contextual tools belong in the right panel.

That includes:

- AI assistant
- selected item details
- contextual actions for current selection or current resource

### 7.4 Account / Presence / Collaboration

Account and collaboration belong at the bottom of the left sidebar.

That includes:

- avatar
- collaborators/presence
- share/invite
- workspace status
- settings

This is where `Live` moves.

`Live` is treated as workspace/session state, not as a major creation or editing surface.

## 8. Canvas View

The canvas remains the default project entry and the core workspace surface.

### 8.1 What Stays Canvas-Native

These things remain directly editable or natively represented on canvas:

- Excalidraw shapes
- arrows
- spatial composition
- Markdown quick notes
- lightweight web embeds
- raster images
- vector assets

### 8.2 What Leaves the Canvas Runtime

These stop being full canvas-hosted overlays:

- full Kanban board editor
- full Lexical document editor
- full prototype editor/runtime

### 8.3 What Replaces Heavy Overlays on Canvas

Heavy resources become lightweight cards on the canvas.

Examples:

- Board card
- Document card
- Prototype card

These cards show:

- title
- summary
- preview thumbnail or snippet
- status metadata
- counts where useful

These cards do not host the real editor.

## 9. Canvas Card Interaction Model

The interaction model for heavy-resource cards is fixed.

### 9.1 Single Click

- select card
- open `Details` in the right panel
- show preview metadata and available actions

### 9.2 Double Click

- open the focused view for that resource

### 9.3 Details Panel Actions

Typical actions:

- Open
- Reveal linked references
- Add summary note to canvas
- Ask AI about this item

### 9.4 Back Behavior

When returning from a focused view to canvas:

- restore the prior canvas
- restore camera position
- restore the relevant selected card if possible

The user should feel they are resuming context, not starting over.

## 10. Focused Views

A focused view is a full main-content replacement for a heavy resource.

It is not:

- a browser pop-up
- a modal
- a floating panel
- an embedded overlay on the canvas

It is simply the center pane of the app showing a different resource.

### 10.1 Board View

Board view is the full kanban editor.

Layout:

- same project shell
- same left sidebar
- board editor in center
- optional right panel for AI/details

### 10.2 Document View

Document view is the full Lexical editor.

Layout:

- same project shell
- same left sidebar
- document editor in center
- optional right panel for AI/details

### 10.3 Prototype View

Prototype view is the full prototype studio.

Layout:

- same project shell
- same left sidebar
- file tree/editor/preview in center
- optional right panel for AI/details

### 10.4 Breadcrumb / Return Model

Every focused view must provide:

- breadcrumb path
- explicit `Back to Canvas`
- visibility into which project resource is open

## 11. Notes Strategy

This is a deliberate product decision to support both formats.

### 11.1 The Hybrid Approach

We support two note formats:

- **Quick Note** (Markdown) — canvas-native, lightweight, always visible
- **Document** (Lexical) — rich text, focused view, full editing experience

This is `Path B: Markdown + Document`.

### 11.2 Quick Note (Markdown)

Markdown notes are canvas-native.

Role:

- quick capture
- annotations
- spatial thinking
- lightweight context on the canvas
- always visible alongside other canvas elements

### 11.3 Document (Lexical)

Documents are rich text resources edited in focused views.

Role:

- longer structured writing
- comments and collaboration
- review workflows
- rich formatting capabilities
- heavy editor with full feature set

### 11.4 Product Language

Use distinct, user-facing terminology:

| User Term | Format | Location | Use Case |
|-----------|--------|----------|----------|
| **Quick Note** | Markdown | On canvas | Quick thoughts, context, annotations |
| **Document** | Lexical | Focused view | Deep writing, structured content, collaboration |

### 11.5 When to Use Each

Use **Quick Note** when:
- Jotting down quick thoughts
- Adding context to canvas items
- Annotating diagrams
- Working spatially

Use **Document** when:
- Writing longer content
- Needing rich formatting
- Collaborating with comments
- Focusing on writing without canvas distractions

### 11.6 Bridge

`Promote Quick Note to Document` is not part of the baseline v2 plan.

Add only after users prove they need it.

## 12. AI Architecture

AI is no longer a floating canvas modal.

### 12.1 Placement

AI lives in the right panel as a panel mode.

### 12.2 Context

AI is app-level, but the context model should stay simple.

Primary rule:

- AI works on whatever is in the main content area.

Examples:

- in canvas mode -> AI sees the current canvas
- in board view -> operate on board
- in document view -> operate on document
- in prototype view -> operate on prototype files

Canvas mode can still use selection as a refinement:

- selected markdown note
- selected board/document/prototype card

But we should not build a complicated multi-source mixed-context system.

### 12.3 AI Output Categories

Canvas-native AI outputs:

- markdown note generation
- image generation
- vectorization
- visual placement suggestions

Heavy resource AI outputs:

- board planning/update operations
- document drafting/revision
- prototype code changes

### 12.4 Key Rule

AI should operate on the current resource, not treat the Excalidraw scene as the universal source of truth.

## 13. Collaboration Architecture

Collaboration must be simplified in the UI and isolated in the data model.

### 13.1 Placement

Collaboration/presence belongs in the avatar/workspace zone at the bottom of the left sidebar.

### 13.2 Surface

Default surface:

- compact avatars / presence indicator
- click opens small popover or menu

Contents:

- who is here
- share/invite
- room status
- collaboration settings

### 13.3 Priority

In v2:

- keep canvas collaboration first-class
- do not block the architecture simplification on full multi-user support for every heavy resource

## 14. Data Contracts

### 14.1 Resource Types

We need first-class resource records for:

- canvases
- documents
- boards
- prototypes

### 14.2 Canvas Resource Card Contract

Resource cards on canvas should store only lightweight data.

Candidate fields:

- `resourceId`
- `resourceType`
- `displayTitle`
- `displaySummary`
- `previewImageId`
- `status`
- `snapshotVersion`

### 14.3 What Must Not Live in Canvas Card Data

Do not store:

- full board columns/cards
- full Lexical editor state
- document comments state
- prototype file trees/code
- any heavy content with an independent save lifecycle

### 14.4 Markdown Exception

Markdown remains canvas-native in v2.

Its content can remain local to canvas objects, because it is intentionally being kept as the lightweight note type.

## 15. Routing Direction

We keep routing simple.

Target route shape:

- `/projects/:projectId/canvases/:canvasId`
- `/projects/:projectId/documents/:documentId`
- `/projects/:projectId/boards/:boardId`
- `/projects/:projectId/prototypes/:prototypeId`

The project route should redirect to the default canvas.

We are not building a user-facing project home route as the main starting point for v2.

## 16. What We Are Explicitly Deleting

The following UI patterns are targeted for removal or relocation:

- floating AI window over the canvas
- floating `LIVE` primary button
- floating `AI` primary button
- standalone top-right global `Insert` button
- large right-side profile/workspace panel as a general control center
- canvas-hosted heavy Kanban runtime
- canvas-hosted heavy Lexical runtime
- canvas-hosted heavy Prototype runtime

## 17. Migration Strategy

This plan must be executed in a deletion-first way.

Deletion is not a cleanup tail.
Deletion is the entry ticket for each phase.

### Phase 0: Delete Prototype Overlay

Goals:

- remove the prototype overlay runtime from the canvas
- remove the prototype overlay components
- allow the product to be temporarily incomplete while the focused prototype view is built

Important:

- there are no production users
- temporary breakage is acceptable if it buys real simplification

Exit criteria:

- prototype editing no longer exists inside Excalidraw

### Phase 1: Minimal Shell + Prototype View

Goals:

- introduce the minimal shell:
  - left sidebar
  - main content area
- do not build the full right-panel system yet
- build the focused prototype view
- connect prototype cards/resources to the focused view
- remove legacy prototype routes/components as part of the same phase

Important:

- shell work must replace current top-right / bottom-right control clutter, not coexist with it indefinitely

Exit criteria:

- canvas runs inside the new shell
- prototype opens in a focused view
- old prototype canvas-hosted path is gone

### Phase 2: Delete Kanban Overlay + Add Board View

Goals:

- remove canvas-hosted kanban overlay
- build focused board view
- replace board overlay with board card/reference behavior

Exit criteria:

- board editing no longer depends on Excalidraw

### Phase 3: Delete Lexical Overlay + Decide Note Model

Goals:

- remove canvas-hosted Lexical overlay
- make the explicit v2 note decision:
  - `Path A: Markdown-only`
  - `Path B: Markdown + Document`

If `Path A`:

- no document view in v2
- Markdown remains the only note/writing surface

If `Path B`:

- build focused document view in the same phase
- keep Markdown for canvas-native quick notes

Exit criteria:

- Lexical no longer lives inside Excalidraw
- the note strategy is explicit, not ambiguous

### Phase 4: Delete Floating AI + Add Docked Right-Panel AI

Goals:

- remove floating AI launcher and floating AI panel
- add docked right-panel AI
- retarget AI to current main-content context

Exit criteria:

- AI no longer floats over the canvas
- AI does not depend on scene state as the universal source of truth

### Phase 5: Delete Floating Collaboration + Move It to Sidebar Footer

Goals:

- remove floating collaboration launcher and panel
- move presence/share/collaboration into sidebar footer

Exit criteria:

- collaboration is treated as workspace/session state, not a major detached surface

## 18. Success Metrics

We should measure simplification directly.

Primary metrics:

- number of heavy editors mounted inside Excalidraw
- number of floating global UI control centers
- number of heavy resource edits that mutate the scene
- median scene payload size
- median canvas load time for large projects

Target direction:

- heavy canvas-hosted editor count: `3 -> 0`
- major floating utility surfaces: `many -> 0`

Product metrics:

- time from project open to active canvas
- time to open board/document/prototype from canvas
- return-to-canvas success without loss of context

## 19. Non-Negotiable Rules

These rules should govern implementation.

1. Projects open to a canvas, not a tiled home.
2. The left sidebar is layout, not overlay.
3. The right panel is the only contextual tool panel.
4. AI lives in the right panel.
5. Collaboration lives with avatar/workspace state in the sidebar footer.
6. Insert/create is not a floating global CTA.
7. Heavy resource editors do not live inside Excalidraw.
8. Every migration phase must delete something old.

## 20. Immediate Next Steps

Recommended next work:

1. Update planning docs and backlog to match this architecture.
2. Decide the note-model path before starting the document migration.
3. Delete the prototype overlay first.
4. Build the minimal shell around the simpler canvas.
5. Migrate Prototype, then Board, then notes/documents.

## 21. Final Decision Statement

V2 is a canvas-first whiteboard workspace with structured sidebar navigation and focused views for heavy resources.

The canvas stays central.
The shell gets simpler.
Heavy editors move out of Excalidraw.
The UI stops scattering major controls around the screen.
