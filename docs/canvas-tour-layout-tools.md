# Canvas Tour Layout Tools

This page explains how the experimental canvas tour authoring tools work in `/experiments/canvas-tour`.

## Modes

### Guide mode

- The canvas is presented as a guided experience.
- The board uses the saved guide scene and saved guide overlay for the active chapter.
- The toolbar stays visible so the page still feels like Excalidraw, but the guide surface is not meant to be edited directly.

### Explore demo

- The canvas behaves like a sandbox for moving items, checking camera framing, and previewing overlay changes.
- Layout tools are available here in development so you can capture the current scene state and tune the guide overlay.

## What a "scene" means

A scene is the saved presentation state for one tour chapter.

Each registered scene can store:

- `elements`: the Excalidraw elements for that chapter
- `camera`: the saved center point and zoom level
- `overlay`: the guide card content and placement
- `capturedAt`: when that scene snapshot was last saved

Right now the tour is chapter-based, so the selected scene in Layout tools decides which chapter you are editing.

## Capture scope

The capture scope controls what gets written when you register the selected scene.

### Scene + camera

- Saves both the board layout and the camera framing.
- Use this when you moved boxes around and also adjusted zoom or pan.

### Camera only

- Saves only the camera framing.
- The already-saved elements stay untouched.
- Use this when the board layout is correct and you only want a new pan or zoom target.

### Elements only

- Saves only the scene elements.
- The already-saved camera stays untouched.
- Use this when you repositioned content on the board but want to preserve the same presentation framing.

## Scene actions

### Register selected scene

- Captures the current Explore demo state for the selected scene.
- What gets saved depends on the current capture scope.
- This updates the local development registry used by the experimental page.

### Load selected scene

- Restores the registered scene snapshot for the selected chapter.
- In Explore demo, this reapplies the saved working state so you can continue editing from it.
- In Guide mode, this reloads the saved presentation state for that chapter.

### Copy selected JSON

- Copies the registered scene snapshot as JSON.
- Useful for debugging, comparing states, or promoting a captured scene into code later.

### Clear selected scene

- Removes the registered snapshot for the selected chapter.
- After clearing, that scene falls back to its code-defined default chapter content.

## Overlay editor

The overlay editor controls the guide card that appears over the Excalidraw canvas.

It edits:

- label
- title
- description
- hint
- placement
- width
- accent color
- surface opacity

### Preview overlay

- Applies the current draft to the live active scene preview.
- This is mainly for iterating without committing the overlay to the selected scene yet.

### Save overlay

- Persists the current overlay draft into the selected scene snapshot in the local registry.

## Placement model

The overlay placement is intentionally split into two ideas:

### Guide placement

- This is the saved placement used by the actual guide presentation.
- Presets like `Top left`, `Top center`, `Top right`, and `Bottom left` target the guide viewport, not the editor panel.

### Editor-safe preview

- While Layout tools are open, the preview may shift to stay visible instead of hiding under the panel.
- This does not change the saved guide placement by itself.
- It only makes the live editing preview easier to read.

This is why the panel shows both:

- the guide safe area
- the editor safe area
- the current preview shift

## Live camera stats

Layout tools show:

- `Live zoom`: the current Explore demo zoom
- `Live center`: the current Explore demo camera center
- `Saved zoom`: the registered zoom for the selected scene
- `Saved at`: when that scene was last stored

These help compare the board you are currently looking at with the saved chapter state.

## How the registry works

- Registered scenes are stored locally in development.
- They are scene-aware, so each chapter can have its own elements, camera, and overlay.
- The registry is intended as an authoring aid so layouts can be captured exactly and then refined over time.
- Clearing the registry for a scene returns that scene to the code-defined baseline.

## Recommended workflow

1. Switch to `Explore demo`.
2. Pick the target scene in Layout tools.
3. Move the board items or adjust zoom.
4. Choose the correct capture scope.
5. Click `Register selected scene`.
6. Tweak the overlay and use `Preview overlay`.
7. Click `Save overlay` once the overlay looks right.
8. Switch back to `Guide mode` to confirm the saved presentation result.
