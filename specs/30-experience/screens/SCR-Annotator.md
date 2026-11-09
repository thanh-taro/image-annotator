---
id: SCR-Annotator
title: Annotator
status: ready
features: [F-001, F-002, F-003, F-004, F-005, F-006, F-007, F-008, F-009, F-010, F-011, F-012, F-013, F-014, F-015, F-016, F-017, F-018]
components: [CMP-Toolbar, CMP-StylePanel, CMP-Canvas, CMP-TextEditor, CMP-EmptyState, CMP-DropOverlay, CMP-StatusBar, CMP-Notice, CMP-ConfirmDialog, CMP-ShortcutHelp]
---

## Purpose
The only screen: load an image, annotate it, and export it.

## Layout regions
1. Toolbar — CMP-Toolbar: open, tools, undo/redo, redaction count, copy, download, overflow.
2. Work area — CMP-Canvas (with CMP-TextEditor while editing text), or CMP-EmptyState when no
   image is loaded; CMP-DropOverlay over everything while a file is dragged in.
3. Style panel — CMP-StylePanel for the active tool, the selection, or the canvas.
4. Status bar — CMP-StatusBar: privacy statement and source link, image size, zoom.
Overlays: CMP-Notice, CMP-ConfirmDialog, CMP-ShortcutHelp.

## States
| State | When | What the user sees |
|---|---|---|
| empty | No image loaded | CMP-EmptyState across the whole work area; tools, export and zoom disabled; the style panel is hidden |
| default | Image loaded, drawing tool active | Canvas fitted, style panel for the active tool |
| canvas-settings | Select tool active, nothing selected | Style panel shows padding and background |
| selecting | One or more annotations selected | Handles on a single selection, an outline on each of several (CMP-Canvas); style panel for the selection |
| editing-text | A text annotation is being edited | CMP-TextEditor has focus; shortcuts off; the style panel shows the edited text's colour and size, and changes apply to it |
| cropping | Crop tool active | Frame handles, dimmed outside, COPY-crop.size |
| dragging-file | A file is dragged over the tool | CMP-DropOverlay |
| loading | Decoding takes longer than 0.5 s | COPY-load.loading in CMP-Notice over the current state (the empty state, or the image being replaced) |
| exporting | Export takes longer than 0.5 s | COPY-export.preparing |
| error | Load or export failed | CMP-Notice with the matching error message (e.g. COPY-error.export_failed); session unchanged |

## Entry & exit
- Entered from: the host portal, or opened standalone.
- Exits to: none (single screen). Leaving with unexported work warns (F-014).

## Accessibility
Reading and focus order: toolbar, canvas, style panel, status bar (D-036); the style panel follows the canvas whether it is shown beside it or as the narrow sheet. A visually hidden level-1 heading COPY-app.title starts the tool. The canvas is one focusable region
whose annotations are reachable with Tab (F-013); every drag has a single-pointer non-drag
alternative (position and size fields in CMP-StylePanel) and a keyboard alternative (NFR-06).
The page title is COPY-app.title when standalone.
