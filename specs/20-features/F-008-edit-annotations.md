---
id: F-008
title: Select and edit annotations
status: ready
milestone: M-1
priority: P0
personas: [PER-01]
entities: [ENT-Annotation, ENT-Style, ENT-Session]
rules: [RULE-04, RULE-05, RULE-06, RULE-07, RULE-08, RULE-11, RULE-19]
screens: [SCR-Annotator]
components: [CMP-Toolbar, CMP-Canvas, CMP-StylePanel]
nfr: [NFR-02, NFR-06]
events: []
depends_on: [F-003, F-004, F-005, F-006, F-007]
---

## Intent
Every annotation stays editable until export, so a misplaced arrow is a drag away from right,
not a redo (PRN-04).

## Scope
- In: selecting (click, Shift+click, drag a box, select all), moving, resizing, restyling,
  duplicating, deleting and reordering annotations, by pointer, keyboard and position/size
  fields (D-008).
- Out: rotation, grouping, alignment guides, copying annotations between sessions, adding to a
  selection from the keyboard (select all only).

## Requirements
- **R1** With the select tool, clicking an annotation selects it; Shift+click adds or removes it; dragging on empty canvas selects every annotation the box touches; select all selects every annotation. Clicking empty canvas clears the selection.
- **R2** Dragging a selected annotation moves the whole selection; arrow keys move it by 1 or 10 image pixels (RULE-19).
- **R3** A single selected annotation shows handles to resize it (rectangle, ellipse, redaction), to move its end points (line, arrow), or to scale it (stroke, highlight); text and steps have no handles (their size is S/M/L). Shift keeps proportions while dragging a handle (RULE-06).
- **R4** Changing a style while annotations are selected changes them all at once (RULE-04); only choices that apply to every selected annotation kind are shown.
- **R5** The user can delete, duplicate (offset 10 image pixels right and down) and bring forward or send backward the selection.
- **R6** With any drawing tool active, the user can move an existing annotation by dragging it with Alt held, or by switching to select; a plain drag always draws.
- **R7** Each completed edit is a single undo step (RULE-11, F-009).
- **R8** For a single selection, position and size fields show and set it in image pixels, as a non-drag alternative to moving and resizing (D-008): rectangles, ellipses and redactions show X, Y, W, H of their box; lines and arrows show start and end X and Y; strokes and highlights show X, Y, W, H of their bounding box, and changing W or H scales their points from the top-left corner; text shows X and Y of its top-left anchor; steps show X and Y of their centre.

## Acceptance criteria
- **AC1** Given three annotations, when the user drags a selection box around two of them with the select tool, then exactly those two are selected. (R1)
- **AC2** Given one selected arrow, when the user drags its head handle, then only the head moves and the tail stays. (R3)
- **AC3** Given a selected rectangle, when the user drags a corner handle with Shift, then its aspect ratio is kept. (R3)
- **AC4** Given a red arrow and a red rectangle selected, when the user picks blue, then both turn blue and the next new arrow or rectangle is blue. (R4)
- **AC5** Given a rectangle and a text selected, when the user looks at CMP-StylePanel, then colour and size are offered and fill is not. (R4)
- **AC6** Given a selected rectangle at (100, 100), when the user presses Delete, then it is removed; when they undo and press Mod+D, then a copy appears at (110, 110) and is selected. (R5)
- **AC7** Given two overlapping annotations, when the user sends the top one backward, then the other is drawn on top. (R5)
- **AC8** Given the arrow tool is active, when the user drags across an existing rectangle without Alt, then a new arrow is drawn and the rectangle doesn't move; with Alt, the rectangle moves. (R6)
- **AC9** Given a selected text, when the user presses Shift+Right arrow three times, then it moves 30 image pixels right, as one undo step. (R2, R7)
- **AC10** Given a selected 100 × 50 rectangle, when the user presses Alt+Right arrow, then it is 101 × 50 with its top-left corner unchanged; given a selected text, Alt+Right does nothing. (R3)
- **AC11** Given a selected text, when the user looks at it, then no resize handles are shown. (R3)
- **AC12** Given a selected rectangle, when the user types 200 in the width field and presses Enter, then the rectangle is 200 pixels wide, as one undo step. (R8)
- **AC13** Given a selected line, when the user types a new start X and Y using only the keyboard, then the tail moves there and the head stays. (R8)
- **AC14** Given a selected step, when the user looks at the position and size fields, then X and Y are shown and width and height are not. (R8)
- **AC15** Given a selected 100 × 40 highlight, when the user sets its width to 200, then its points are scaled so its bounding box is 200 × 40 with the same top-left corner. (R8)
- **AC16** Given focus in the width field with a rectangle selected, when the user presses Backspace, Left arrow and Enter, then the field's text is edited and applied, and the rectangle is neither deleted nor moved before the value applies. (R8)
- **AC17** Given the select tool and a rectangle at (100, 100) at 100 % zoom, when the user presses on it, moves the pointer 3 screen px and releases, then the rectangle is selected, still at (100, 100), and no undo step was added (one Undo removes the rectangle); when they press again and move 10 screen px right, then the rectangle ends at (110, 100). (R1, R2, R7)

## UX notes
COPY-tool.select in CMP-Toolbar. Selection actions in CMP-StylePanel: COPY-action.delete,
COPY-action.duplicate, COPY-action.bring_forward, COPY-action.send_backward; position and size
fields under COPY-geometry.title.

## Edge cases
- Moving a selection partly off the canvas → allowed; parts outside the frame aren't exported.
- Selecting a step and changing its size → its number stays.
- A selection with a solid redaction → no opacity or fill choice is ever shown (F-007.R2).

## Open questions
