---
id: F-010
title: Crop the export frame
status: draft
milestone: M-1
priority: P0
personas: [PER-01]
entities: [ENT-Frame, ENT-Session]
rules: [RULE-11, RULE-13, RULE-19]
screens: [SCR-Annotator]
components: [CMP-Toolbar, CMP-Canvas, CMP-StylePanel]
nfr: [NFR-06]
events: []
depends_on: [F-001]
---

## Intent
Screenshots usually include more than matters. Cropping trims the export without throwing
anything away, so the user can widen it again (D-002, PRN-04).

## Scope
- In: setting the frame (ENT-Frame) by dragging its edges or a new box, by keyboard, or by
  resetting it; seeing what will be cut.
- Out: rotating, straightening, fixed aspect presets (M-2 candidate).

## Requirements
- **R1** With the crop tool, the user drags the frame's edges or corners to resize it, drags inside it to move it, or drags outside it to draw a new frame; values follow RULE-13.
- **R2** While the crop tool is active, areas outside the frame are dimmed on screen; they stay visible and editable, and nothing is deleted.
- **R3** The user can reset the frame to the whole canvas.
- **R4** The frame's size in pixels is shown while cropping.
- **R5** Changing the frame is an undo step (RULE-11) and can be adjusted again at any time before export.
- **R6** With the keyboard, the user can move and resize the frame by 1 or 10 image pixels (RULE-19), or set it with position and size fields (D-008).

## Acceptance criteria
- **AC1** Given a 1920 × 1080 image, when the user drags the crop tool's left edge 200 image pixels right, then the frame is 1720 × 1080 and the left 200 pixels are dimmed. (R1, R2, R4)
- **AC2** Given a frame smaller than the image, when the user exports, then the exported image is exactly the frame's size and content. (R1)
- **AC3** Given an arrow partly outside the frame, when the user selects it and then exports, then it is editable, and the export cuts it at the frame edge. (R2)
- **AC4** Given a cropped frame, when the user chooses COPY-action.crop_reset, then the frame covers the whole canvas again. (R3)
- **AC5** Given the user cropped and then cropped again, when they undo once, then the first crop is restored. (R5)
- **AC6** Given the crop tool, when the user drags the frame towards 5 × 5 pixels, then it stops at 16 × 16. (R1)
- **AC7** Given the crop tool and canvas focus, when the user presses Alt+Shift+Left arrow, then the frame's right edge moves 10 image pixels left. (R6)
- **AC8** Given a 1000 × 500 frame inside a 1920 × 1080 image, when the user drags inside the frame 100 image pixels right, then the frame moves and keeps its size. (R1)
- **AC9** Given the crop tool, when the user types 800 in the width field, then the frame is 800 pixels wide. (R6)

## UX notes
COPY-tool.crop in CMP-Toolbar. Frame size shown with COPY-crop.size; reset with
COPY-action.crop_reset in CMP-StylePanel.

## Edge cases
- Padding added after cropping → RULE-13 decides how the frame follows.

## Open questions
