---
id: F-003
title: Draw shapes
status: draft
milestone: M-1
priority: P0
personas: [PER-01]
entities: [ENT-Annotation, ENT-Style]
rules: [RULE-04, RULE-05, RULE-06, RULE-19]
screens: [SCR-Annotator]
components: [CMP-Toolbar, CMP-Canvas, CMP-StylePanel]
nfr: [NFR-02, NFR-06]
events: []
depends_on: [F-001]
---

## Intent
Pointing at things is the most common annotation: circle the bug, box the button, arrow to the
field (PRN-03).

## Scope
- In: rectangle, ellipse, line and arrow annotations; their style (RULE-04); constraining with
  Shift (RULE-06); placing by click or keyboard as well as by drag.
- Out: editing after creation (F-008); rotation; curved arrows; other arrowheads.

## Requirements
- **R1** With the rectangle or ellipse tool, dragging creates that shape spanning the drag.
- **R2** With the line or arrow tool, dragging creates a line from the start to the end point; an arrow has its head at the end point, with head length 4 × and head width 3 × its stroke size.
- **R3** New shapes get the tool's current style (RULE-04); rectangles and ellipses can be outlined, filled solid, or filled translucent.
- **R4** Holding Shift while dragging constrains the shape (RULE-06).
- **R5** A click without dragging places a default-size shape (RULE-05); with the keyboard, the user can place one at the centre of the view (RULE-19).
- **R6** After creating a shape, it is selected and the tool stays the same, so the next drag draws another.

## Acceptance criteria
- **AC1** Given the rectangle tool, when the user drags from (100, 100) to (300, 200) in image pixels, then a rectangle with that box exists in the current colour and stroke size. (R1, R3)
- **AC2** Given the ellipse tool, when the user drags, then an ellipse that fits the dragged box is created. (R1)
- **AC3** Given the arrow tool, when the user drags from A to B, then an arrow from A with its head at B is created; on a 1000 × 800 image with stroke M (5 pixels), its head is 20 pixels long and 15 pixels wide. (R2)
- **AC4** Given the line tool, when the user drags, then a line with no head is created. (R2)
- **AC5** Given the rectangle tool with fill translucent set in CMP-StylePanel, when the user drags, then the rectangle is filled at 30 % opacity in its colour. (R3)
- **AC6** Given the ellipse tool, when the user holds Shift and drags 200 × 120, then a 200 × 200 circle is created; with the arrow tool and Shift, the arrow snaps to the nearest 45°. (R4)
- **AC7** Given the rectangle tool, when the user clicks without dragging on a 1000 × 800 image, then a 160 × 160 rectangle centred on the click is created. (R5)
- **AC8** Given the arrow tool and focus on the canvas, when the user presses Enter, then a default-size arrow appears at the centre of the view and is selected. (R5)
- **AC9** Given the arrow tool, when the user draws an arrow, then it is selected and the arrow tool is still active. (R6)

## UX notes
Tools in CMP-Toolbar: COPY-tool.rectangle, COPY-tool.ellipse, COPY-tool.line, COPY-tool.arrow.
Fill choices in CMP-StylePanel: COPY-style.fill_none, COPY-style.fill_solid,
COPY-style.fill_translucent.

## Edge cases
- A drag that leaves the canvas → the shape is clipped to the canvas edge while dragging.
- Esc during a drag → nothing is created (RULE-19).

## Open questions
