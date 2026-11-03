---
id: F-002
title: Zoom and pan the view
status: ready
milestone: M-1
priority: P0
personas: [PER-01]
entities: [ENT-Session]
rules: [RULE-12, RULE-19]
screens: [SCR-Annotator]
components: [CMP-Canvas, CMP-StatusBar]
nfr: [NFR-02, NFR-06]
events: []
depends_on: [F-001]
---

## Intent
Screenshots are often larger than the space the tool gets; users need to see the whole image
and zoom in to place marks precisely. The view never affects the export (INV-05).

## Scope
- In: fit to view, actual size, zoom in/out, zoom at pointer, pan.
- Out: rotating the view.

## Requirements
- **R1** A newly loaded image is fitted so the whole canvas is visible, never above 100 % (RULE-12).
- **R2** The user can zoom in and out in steps, fit the image to the view, and show it at 100 %, within RULE-12's range.
- **R3** Zooming with the pointer (wheel with Ctrl/Cmd, or pinch on a trackpad or touch screen) keeps the point under the pointer in place.
- **R4** The user can pan when the canvas is larger than the visible area (scrolling, Space+drag, two-finger drag on touch, or arrow keys with nothing selected, RULE-19). A canvas smaller than the visible area is centred on that axis; a larger one pans until its edge reaches the Fit margin.
- **R5** The current zoom level is always visible.

## Acceptance criteria
- **AC1** Given a 3840 × 2160 image in a 1200 × 800 area, when it loads, then the whole image is visible and the zoom shown is below 100 %. (R1, R5)
- **AC2** Given a 400 × 300 image in a 1200 × 800 area, when it loads, then it is shown at 100 %. (R1)
- **AC3** Given the image at 50 %, when the user zooms in one step, then the zoom is 67 %; at 800 % zooming in does nothing. (R2)
- **AC4** Given any zoom, when the user chooses COPY-action.zoom_fit, then the whole canvas is visible; when they choose COPY-action.zoom_actual, then the zoom is 100 %. (R2)
- **AC5** Given the pointer is over a detail, when the user zooms with Ctrl+wheel, then that detail stays under the pointer. (R3)
- **AC6** Given the canvas is larger than the area, when the user holds Space and drags, then the view moves and no annotation is created or moved. (R4)
- **AC7** Given annotations exist, when the user zooms and pans, then exporting produces the same image as before (INV-05) and no undo step is added. (R2, R4)
- **AC8** Given a 16,384 × 1024 image in a 1200 × 800 area, when it loads, then the whole canvas is visible at a zoom below 10 %; zooming out does nothing; zooming in goes to 10 %. (R1, R2)
- **AC9** Given the zoom is 31 % after fitting, when the user zooms in one step, then it is 50 %; zooming out instead gives 25 %. (R2)
- **AC10** Given the canvas is larger than the area and nothing is selected, when the user presses the Right arrow key, then the view pans right. (R4)

## UX notes
Zoom controls and level live in CMP-StatusBar (COPY-action.zoom_in, COPY-action.zoom_out,
COPY-action.zoom_fit, COPY-action.zoom_actual, COPY-status.zoom). CMP-Canvas handles pointer
zoom and pan.

## Edge cases
- The host resizes the tool → the zoom level is kept; if the image was fitted, it is refitted.
- No image loaded → zoom controls are disabled.

## Open questions
