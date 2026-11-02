---
id: F-011
title: Add padding and background
status: ready
milestone: M-1
priority: P2
personas: [PER-01]
entities: [ENT-Padding, ENT-Frame]
rules: [RULE-02, RULE-11, RULE-13, RULE-14]
screens: [SCR-Annotator]
components: [CMP-StylePanel, CMP-Canvas]
nfr: []
events: []
depends_on: [F-001]
---

## Intent
A screenshot pasted into docs or chat often looks better with space around it, and annotations
near the edge need room (PRN-03).

## Scope
- In: padding sizes and a background (RULE-14).
- Out: gradients, shadows, rounded corners, device frames (M-2+ candidates).

## Requirements
- **R1** The user can add padding around the frame in one of the sizes in RULE-14, or remove it.
- **R2** The user can choose a transparent background or a palette colour for the whole canvas (visible in the padding and under transparent pixels inside the frame).
- **R3** Annotations can be placed or moved into the padding, and are exported there, drawn over the background (never over image pixels outside the frame).
- **R4** Changing padding never changes the frame (RULE-13) and is one undo step.
- **R5** Padding sizes that would make the canvas exceed the size limits are unavailable (RULE-14).
- **R6** When a frame change would make the canvas exceed RULE-02's limits, the padding becomes the largest size that fits, in the same undo step (RULE-14).

## Acceptance criteria
- **AC1** Given a 1000 × 500 image, when the user chooses padding M, then the canvas is 1120 × 620 with 60 pixels on each side. (R1)
- **AC2** Given padding M with background white, when the user exports, then the padding area is white; with transparent, it is transparent. (R2)
- **AC3** Given padding, when the user drags an arrow from the padding into the image, then the export includes the whole arrow. (R3)
- **AC4** Given a 1000 × 500 image cropped to a 400 × 200 frame, when the user chooses padding M with a white background and exports, then the export is 448 × 248: the frame's content with 24 white pixels on each side and no image pixels from outside the frame. (R1, R2, R4)
- **AC5** Given padding was added, when the user undoes, then the padding is removed. (R4)
- **AC6** Given a 4096 × 4096 image, when the user opens the padding choices, then S, M and L are unavailable. (R5)
- **AC7** Given a 3600 × 3600 image cropped to a 1000 × 1000 frame with padding L, when the user resets the crop, then the padding becomes M (canvas 4032 × 4032, the largest size within RULE-02); one undo restores the 1000 × 1000 frame and padding L. (R6)

## UX notes
Canvas settings in CMP-StylePanel when nothing is selected: COPY-canvas.padding,
COPY-canvas.background, COPY-canvas.transparent. Transparent areas show a checkerboard on screen.

## Edge cases
- Padding none with a coloured background → the background has no visible effect except under
  transparent parts of the image.
- Padding after a crop → the padding wraps the cropped frame and is sized from the frame (D-020).
- Annotations keep their image coordinates when the frame changes, so one in the padding may end up over image content, or outside the canvas (kept, not exported).

## Open questions
