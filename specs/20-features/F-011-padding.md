---
id: F-011
title: Add padding and background
status: draft
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
- **R1** The user can add padding around the image in one of the sizes in RULE-14, or remove it.
- **R2** The user can choose a transparent background or a palette colour for the whole canvas (visible in the padding and under transparent image pixels).
- **R3** Annotations can be placed or moved into the padding, and are exported there.
- **R4** Changing padding keeps the frame per RULE-13, and is one undo step together with the frame change it causes.
- **R5** Padding sizes that would make the canvas exceed the size limits are unavailable (RULE-14).

## Acceptance criteria
- **AC1** Given a 1000 × 500 image, when the user chooses padding M, then the canvas is 1120 × 620 with 60 pixels on each side. (R1)
- **AC2** Given padding M with background white, when the user exports, then the padding area is white; with transparent, it is transparent. (R2)
- **AC3** Given padding, when the user drags an arrow from the padding into the image, then the export includes the whole arrow. (R3)
- **AC4** Given an uncropped frame, when the user adds padding, then the frame grows to the whole canvas; given a cropped frame, then it keeps its place over the image. (R4)
- **AC5** Given padding was added, when the user undoes, then the padding is removed. (R4)
- **AC6** Given a 4096 × 4096 image, when the user opens the padding choices, then S, M and L are unavailable. (R5)
- **AC7** Given a 100 × 100 frame lying entirely in padding L, when padding is set to none, then the frame is the whole canvas; one undo restores both the padding and the frame. (R4)

## UX notes
Canvas settings in CMP-StylePanel when nothing is selected: COPY-canvas.padding,
COPY-canvas.background, COPY-canvas.transparent. Transparent areas show a checkerboard on screen.

## Edge cases
- Padding none with a coloured background → the background has no visible effect except under
  transparent parts of the image.

## Open questions
