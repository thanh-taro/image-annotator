---
id: MOD-Canvas
title: Canvas — view, pointer and touch input, tool state machine, handles, crop, text overlay
status: draft
depends_on: [MOD-Core, MOD-Document, MOD-Render, MOD-Effects, MOD-Keys, MOD-Copy]
---

## Responsibility
The interactive canvas (CMP-Canvas, CMP-TextEditor). It owns the view transform (zoom, pan, fit
per RULE-12, zoom at the pointer, pan by scroll, Space+drag, two fingers and arrow keys), a display
canvas sized to its box × device pixel ratio (capped at 2), and `requestAnimationFrame` scheduling
that calls MOD-Render. It runs the tool state machine for Pointer Events (mouse, pen, touch; one
finger draws, two pan and zoom; `touch-action: none`; pointer capture): drawing each kind with
RULE-05 clicks and RULE-06 Shift constraints, marquee and Shift+click selection, moving (also
Alt+drag with a drawing tool), handles for resize/end points/scale, and the crop tool (edges,
corners, move, draw a new frame, 16 px minimum, the whole-image crop view with dim and no padding,
keeping the zoom and the frame's place on screen when entering or leaving, F-010.R2, RULE-12).
Transient drag state stays in a plain mutable controller; only completed edits go to MOD-Document
as one step. It places and edits text through the transparent `<textarea>` overlay (ADR-0009). It
hosts the accessible region: the focusable canvas, annotations as a multi-selectable list in
drawing order, Tab/Shift+Tab through annotations, announcements per CMP-Canvas, and keeping a
newly placed or selected annotation in view (RULE-19). It accepts a bottom inset from MOD-App so
the view moves (and refits if fitted) above the narrow bottom sheet and restores when it closes
(D-019). Drawing is enabled only after the fonts settle.

## Not responsible for
- What a key means (MOD-Keys) or app-level commands such as export, load and undo (MOD-App).
- The pixels of blur/pixelate (MOD-Effects) or how annotations look (MOD-Render).

## Public surface
- `<Canvas>` component bound to the document, selection, tool, current-style and view signals.
- `viewCommands`: `zoomIn`, `zoomOut`, `fit`, `actualSize`, `setBottomInset(px)`.
- `canvasCommands`: `placeAtCentre(tool)`, `nudge(dx, dy)`, `altResize(dx, dy)`, `selectNext/
  Previous`, `cancelDrag`, `beginTextEdit`, `endTextEdit`.

## Implements
CMP-Canvas, CMP-TextEditor; F-002.R1/R2/R3/R4/R5, F-003.R1/R4/R5/R6, F-004.R1/R2/R3/R4,
F-005.R1/R2/R3/R4, F-006.R1/R4, F-007.R1/R3, F-008.R1/R2/R3/R6, F-010.R1/R2/R4/R6,
F-013.R4; INV-05; RULE-05, RULE-06, RULE-12, RULE-19; NFR-02, NFR-06, NFR-07. Decided by ADR-0004,
ADR-0009, ADR-0016, ADR-0020, ADR-0022.

SP-engine outcome (ADR-0016, ADR-0022): keeps a device-sized image layer for the current view, rebuilt whenever its inputs change (zoom, pan, viewport size, device pixel ratio, theme, image, frame, padding or background, crop view on or off). While drawing, moving or resizing, it also caches the annotations below the lowest and above the highest dragged one in two layers; anything in between, and every blur or pixelate above the lowest dragged solid, is drawn each frame (ADR-0022). Pointer thresholds follow RULE-05.

F-002 outcome: the view controller exposes `viewCommands` (zoom in/out, fit, actual size, zoom at a point, `panKey`, `holdSpace`) for MOD-App and MOD-Keys.
