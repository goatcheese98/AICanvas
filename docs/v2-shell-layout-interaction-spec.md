# V2 Shell Layout and Interaction Spec

Status: Proposed

Companion to: `docs/v2-canvas-first-architecture.md`

Purpose: Convert the canvas-first architecture into a precise shell, navigation, and interaction specification that engineering and design can implement directly.

## 1. Design Intent

The shell must make one thing obvious at all times:

- where the user is
- what they are working on
- what tools apply to the current context

The shell must not make the user scan the whole perimeter of the screen to find core actions.

This spec is intentionally strict.

## 2. Core UX Principles

### 2.1 One Navigation Spine

All primary project navigation lives in the left sidebar.

### 2.2 One Primary Work Surface

The center pane shows exactly one main thing:

- canvas
- board
- document
- prototype

### 2.3 One Contextual Tool Surface

The right panel is the only major contextual tool container.

It can show:

- AI
- Details
- Activity later if needed

### 2.4 No Floating Control Centers

The shell should not rely on:

- floating AI windows
- floating collaboration panels
- floating profile/workspace panels
- detached bottom-corner primary actions

### 2.5 Canvas Is the Default, Not the Only View

Projects open into a canvas.
Heavy resources open into focused views.
The shell stays consistent.

## 3. Audit of the Current UI

The current canvas UI has too many competing control centers.

### 3.1 Current Major Control Surfaces

Based on the current implementation:

- Excalidraw top toolbar
- top-left `Back To Dashboard` pill
- top-right `Insert` button
- top-right avatar button
- bottom-right `Live` button
- bottom-right `AI` button
- floating `Profile & Workspace` panel
- floating `Live Collaboration` panel
- floating resizable `AI Chat` panel
- left-side Excalidraw style inspector

Primary files:

- `apps/web/src/components/canvas/CanvasTopToolbar.tsx`
- `apps/web/src/components/canvas/CanvasBottomToolbar.tsx`
- `apps/web/src/components/canvas/CanvasPanels.tsx`
- `apps/web/src/components/canvas/ProfilePanel.tsx`
- `apps/web/src/components/canvas/CollaborationPanel.tsx`
- `apps/web/src/components/canvas/CanvasUI.tsx`

### 3.2 Core Problems

Problems with the current UI:

- major actions are spread across top-left, top-right, bottom-right, and floating side panels
- profile/workspace, insert, collaboration, and AI each behave like separate mini-products
- chat overlays the canvas instead of coexisting with it cleanly
- collaboration is given oversized visual importance relative to its actual role
- the user has multiple "homes" on one screen instead of one stable shell

## 4. Target Shell

The shell is:

```text
| Left Sidebar | Main Content Area | Right Panel |
```

This is the stable desktop layout.

Everything else is subordinate to it.

## 5. Desktop Layout

### 5.1 Primary Zones

#### Left Sidebar

Purpose:

- project navigation
- resource lists
- create actions
- workspace/account/presence controls

#### Main Content Area

Purpose:

- show the currently active primary resource

#### Right Panel

Purpose:

- show contextual tools for the current resource or current selection

### 5.2 Width Guidance

Desktop width targets:

- left sidebar collapsed: `64px`
- left sidebar expanded: `240px`
- right panel closed: `0px`
- right panel open: `420px` default
- right panel max: `480px`

Main content area:

- takes all remaining width

### 5.3 Height Guidance

The shell should fill the viewport.

Structure:

- no giant floating bottom toolbar
- no stacked fixed-position utility windows
- top-level shell should own the full height

## 6. Left Sidebar Spec

The left sidebar is the project's persistent spine.

### 6.1 Top Section

Contents:

- project title
- current resource label or breadcrumb summary
- `+ New` create button

Optional:

- collapse/expand toggle

### 6.2 Resource Sections

Default order:

1. Canvases
2. Documents
3. Boards
4. Prototypes

Rules:

- sections must be collapsible
- only the active section must be guaranteed open
- the shell must not assume projects stay tiny forever
- if the separate sections become noisy in real usage, we should collapse them into a unified `Resources` list with type icons rather than let the sidebar bloat

Each section contains:

- section heading
- ordered list of resources
- active resource highlight
- lightweight counts only if useful

### 6.3 Footer Section

Contents:

- user avatar
- collaborator avatars or presence indicator
- share/invite
- settings

This is also where collaboration status lives.

### 6.4 Sidebar Footer Behavior

Clicking the avatar/footer area should open a compact popover or menu, not a full right-side panel by default.

Menu content:

- account/profile
- collaborators present
- share link / invite
- collaboration room status
- settings
- sign out

This replaces the current large `Profile & Workspace` panel.

## 7. Main Content Area Spec

The main content area is the dominant surface.

It shows one resource at a time.

### 7.1 Canvas Mode

Main content shows:

- Excalidraw canvas
- lightweight canvas-native content
- lightweight cards for heavy resources

### 7.2 Board Mode

Main content shows:

- full board editor

### 7.3 Document Mode

Main content shows:

- full Lexical document editor

### 7.4 Prototype Mode

Main content shows:

- full prototype studio

## 8. Right Panel Spec

The right panel is the only major contextual tool container.

### 8.1 Panel Modes

V2 modes:

- `AI`
- `Details`

Possible later addition:

- `Activity`

### 8.2 Panel Rules

- hidden by default
- one mode open at a time
- docked into layout
- never floats over the canvas by default
- opening it reduces the width of the main content area

### 8.3 AI Mode

Purpose:

- context-aware assistant
- works against current resource or selected canvas item

### 8.4 Details Mode

Purpose:

- inspect the current selection
- show metadata
- show resource-card actions

## 9. Top-Level Controls

We still allow contextual controls near the top of the screen, but only where they are native to the current resource.

### 9.1 Canvas Top Toolbar

Keep:

- Excalidraw drawing toolbar

Do not add unrelated project-level actions into that toolbar.

### 9.2 Breadcrumbs

Focused views should include a lightweight top header or breadcrumb inside the main content area.

Example:

- `CS50 Review / Study Plan Board`

Actions in the header:

- `Back to Overview Canvas`
- optional current-resource actions

## 10. Exact Control Migration

This is the strict keep/move/delete map from the current UI.

| Current control | Current location | Decision | New location / behavior |
|---|---|---|---|
| `Back To Dashboard` pill | top-left floating | Move / demote | folded into project/workspace navigation, not a large persistent canvas pill |
| `Insert` button | top-right floating | Move | `+ New` in left sidebar and command menu |
| avatar button | top-right floating | Move | footer of left sidebar |
| `Profile & Workspace` panel | floating right panel | Delete / replace | avatar popover in sidebar footer |
| `Live` button | bottom-right floating | Move / demote | sidebar footer presence/share/collaboration area |
| `Live Collaboration` panel | floating resizable panel | Replace | compact collaboration popover from sidebar footer |
| `AI` button | bottom-right floating | Move | right panel mode |
| floating AI chat panel | floating resizable window | Replace | docked right panel |
| canvas-hosted heavy inserts | insert menu and overlay runtime | Replace over time | focused resources + canvas cards |

## 11. Canvas Mode Detailed Behavior

### 11.1 What the User Sees

The user opens a project and lands in the default canvas.

The shell shows:

- left sidebar with project resources
- Excalidraw in the center
- right panel closed by default

### 11.2 Canvas-Native Content

Editable directly on canvas:

- shapes
- arrows
- Quick Notes
- lightweight web embeds
- images
- vector assets

### 11.3 Heavy Resource Cards

Shown on canvas as:

- Board card
- Document card
- Prototype card

These are reference cards, not full embedded editors.

### 11.4 Card Interactions

Single click:

- selects card
- opens `Details` panel

Double click:

- opens focused resource view

### 11.5 Details Panel Content for Resource Cards

Board card:

- title
- counts
- status summary
- actions:
  - Open Board
  - Ask AI
  - Add Summary Note
  - Reveal Linked References

Document card:

- title
- excerpt
- last updated
- actions:
  - Open Document
  - Ask AI
  - Add Summary Note
  - Reveal Linked References

Prototype card:

- title
- preview image
- issue count/status
- actions:
  - Open Prototype
  - Ask AI
  - Capture Preview
  - Reveal Linked References

## 12. Board Mode Detailed Behavior

### 12.1 Entry Points

Board view opens from:

- clicking a board in the sidebar
- double clicking a board card on canvas
- `Open Board` from Details panel

### 12.2 Shell Behavior

Same left sidebar.
Same right panel.
Main content replaced with board editor.

### 12.3 Header Behavior

Board header should show:

- breadcrumb
- `Back to Canvas`
- board title

### 12.4 Right Panel in Board Mode

AI mode:

- board-aware assistant actions

Details mode:

- selected card metadata later if useful

## 13. Document Mode Detailed Behavior

### 13.1 Entry Points

Document view opens from:

- clicking a document in the sidebar
- double clicking a document card on canvas
- `Open Document` from Details panel

### 13.2 Shell Behavior

Same left sidebar.
Same right panel.
Main content replaced with full Lexical document editor.

### 13.3 Header Behavior

Document header should show:

- breadcrumb
- `Back to Canvas`
- document title

### 13.4 Notes Model Reminder

In product language:

- Quick Note = Markdown on canvas
- Document = Lexical in focused view

## 14. Prototype Mode Detailed Behavior

### 14.1 Entry Points

Prototype view opens from:

- clicking a prototype in the sidebar
- double clicking a prototype card on canvas
- `Open Prototype` from Details panel

### 14.2 Shell Behavior

Same left sidebar.
Same right panel.
Main content replaced with prototype studio.

### 14.3 Prototype Layout

The center pane prototype view should be allowed to contain:

- file tree
- editor
- live preview
- diagnostics

This is the clearest case for a focused view because it is too heavy for Excalidraw.

## 15. Create / Insert Behavior

### 15.1 Primary Create Entry

The main create affordance is `+ New` in the left sidebar.

### 15.2 `+ New` Menu Contents

V2 options:

- New Canvas
- New Board
- New Prototype
- Quick Note on current canvas
- Web Embed on current canvas

Conditional option:

- New Document

This only appears if we choose the `Markdown + Document` path in the architecture note strategy decision.

Context-sensitive options can be added later.

### 15.3 Canvas Insert Behavior

When the user is currently in canvas mode:

- creating a Quick Note inserts it on the current canvas
- creating a Web Embed inserts it on the current canvas
- creating a Board/Document/Prototype creates the resource and may place a reference card on the current canvas

## 16. AI Interaction Spec

### 16.1 Open / Close

AI opens in the right panel.

If `Details` is open and user opens `AI`:

- `Details` closes
- `AI` opens

If `AI` is open and user closes it:

- main content expands
- current resource remains unchanged

### 16.2 AI Context in Canvas Mode

Possible contexts:

- selected Quick Note
- selected resource card
- general canvas context if nothing selected

### 16.3 AI Context in Focused Views

Possible contexts:

- current board
- current document
- current prototype

### 16.4 AI Output Rules

Canvas-native tasks:

- generate note
- generate image
- vectorize asset
- place visual output

Heavy-resource tasks:

- operate on board resource
- operate on document resource
- operate on prototype resource

## 17. Collaboration Spec

### 17.1 Collaboration Placement

Collaboration belongs in the left sidebar footer.

### 17.2 Collaboration Default Presentation

Show:

- current user avatar
- collaborator avatars if present
- presence/status dot

### 17.3 Collaboration Interaction

Clicking the footer area opens a compact popover with:

- current session status
- collaborator list
- start/stop collaboration
- share link / invite
- display name

This replaces the current large floating collaboration panel.

## 18. Navigation Flows

### 18.1 Opening a Project

Flow:

1. user clicks project
2. app opens default canvas
3. left sidebar shows all project resources
4. right panel is closed

### 18.2 Opening a Resource From Sidebar

Flow:

1. user clicks resource in sidebar
2. main content switches to that resource view
3. sidebar remains stable
4. right panel remains in its current closed/open state if appropriate

### 18.3 Opening a Resource From Canvas

Flow:

1. user single clicks card
2. details panel opens
3. user double clicks or presses `Open`
4. focused view replaces canvas in main content area

### 18.4 Returning to Canvas

Flow:

1. user clicks `Back to Canvas`
2. previously viewed canvas returns
3. camera position restores if available
4. relevant card selection restores if available

## 19. Responsive Behavior

### 19.1 Tablet

Tablet may:

- collapse the left sidebar by default
- keep the right panel as a slide-in pane

### 19.2 Mobile

Mobile is a secondary concern for the shell spec, but the likely behavior is:

- sidebar becomes drawer
- right panel becomes full-height drawer or bottom sheet
- one surface at a time remains the rule

We should not design mobile by simply overlaying all desktop surfaces.

## 20. Deletion List

These should be treated as intended removals, not optional cleanup.

- floating `Back To Dashboard` canvas pill
- top-right floating `Insert`
- top-right floating avatar control
- floating `Profile & Workspace` control center
- bottom-right `Live` button
- bottom-right `AI` button
- floating resizable AI panel
- floating collaboration panel

## 21. Implementation Order

Recommended order:

1. Delete prototype overlay/runtime
2. Build minimal shell
3. Add focused prototype view
4. Delete kanban overlay/runtime and add board view
5. Delete Lexical overlay/runtime and decide the note path
6. Move AI into right panel
7. Move collaboration into sidebar footer

## 22. Final Rule

If a user asks "where do I go for this?", the answer should be obvious:

- to navigate the project -> left sidebar
- to work on the current thing -> center
- to use tools on the current thing -> right panel
- to manage people/workspace state -> sidebar footer
