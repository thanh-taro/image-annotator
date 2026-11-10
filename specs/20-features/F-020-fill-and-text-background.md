---
id: F-020
title: Fill colour and text background
status: draft
milestone: M-1c
priority: P1
personas: [PER-01]
entities: [ENT-Style, ENT-Annotation]
rules: [RULE-04, RULE-07, RULE-08, RULE-11, RULE-14, RULE-21, RULE-22]
screens: [SCR-Annotator]
components: [CMP-StylePanel, CMP-Canvas, CMP-TextEditor]
nfr: [NFR-06, NFR-08]
events: []
depends_on: [F-003, F-005, F-008, F-019]
---

## Intent
On a screenshot full of text, a label in an outline is hard to find, and a filled box in the
same colour as its outline hides what it points at. The owner wants a text that sits on its own
background, and rectangles and ellipses whose fill has its own colour, for example a red outline
around a translucent white fill (D-051, D-052, D-053).

## Scope
- In: a fill colour for rectangles and ellipses, separate from their colour; a background for
  texts (none, solid or translucent) with its own colour; palette colours and the custom swatch
  (F-019) for both (RULE-22).
- Out: a fill or background for lines, arrows, strokes, highlights, steps and redactions; an
  opacity other than RULE-04's and RULE-22's; turning a shape's outline off; gradients; a
  background padding or corner radius chosen by the user; wrapping text to the background's width.

## Requirements
- **R1** For a rectangle or ellipse whose fill is solid or translucent, CMP-StylePanel shows the fill colour choice (COPY-style.fill_color) after COPY-style.fill: the 8 palette colours and the custom swatch, which behaves as F-019.R1, R2 and R8 state, with the subject's fill colour in place of its colour. With fill none the choice is not shown.
- **R2** Until a fill colour is picked for a tool or an annotation, its fill colour is automatic (RULE-22): the fill is drawn in the annotation's colour, as before M-1c, and follows it when the colour changes; the fill colour choice marks the swatch of that colour. Picking any fill colour, even the one marked, makes it the fill colour, and it no longer follows the colour.
- **R3** For a text, CMP-StylePanel shows COPY-style.text_background after the size, with the choices COPY-style.fill_none, COPY-style.fill_solid and COPY-style.fill_translucent (default none), and, when the background is solid or translucent, the background colour choice (COPY-style.text_background_color): the 8 palette colours and the custom swatch, as in R1.
- **R4** A text with a background is drawn on a box with rounded corners that surrounds its text box with a margin on every side, opaque when solid and at 70 % opacity when translucent, and without the text outline (RULE-08, RULE-22). Until a background colour is picked, it is the contrast pairing colour of the text's colour (RULE-07) and follows it, as R2 states for a fill.
- **R5** The background box is part of the text: it moves, duplicates, deletes and reorders with it; a press anywhere on it selects or (with the text tool, F-005.R1) edits the text; the selection outline surrounds the box. The anchor is still the top-left corner of the text box (RULE-08).
- **R6** Fill, fill colour, background and background colour follow the current-style and selection rules of every other style choice (RULE-04): they are per tool (rectangle, ellipse, text), not shared with the drawing colour; changing them on a selection is one undo step (RULE-11) and becomes the current style of the selected annotations' tools.
- **R7** With a multi-selection, fill and fill colour are offered only when every selected annotation is a rectangle or ellipse, and background and background colour only when every one is a text; the colour choice is offered only when every selected annotation's fill or background is solid or translucent, and a swatch is marked only when all their fill or background colours (automatic ones as drawn) are the same.
- **R8** While a text is being edited, it shows its background as typed, and choosing a background or background colour keeps editing (F-005.R3, F-019.R9). A text removed when editing ends (RULE-08) is removed with its background.
- **R9** Exported fills and backgrounds look the same as on screen at 100 % (NFR-08).

## Acceptance criteria
- **AC1** Given the rectangle tool with fill none, when the user looks at CMP-StylePanel, then COPY-style.fill_color is not shown; when they pick COPY-style.fill_solid, then it is shown with the current colour's swatch marked. (R1, R2)
- **AC2** Given the rectangle tool, red, fill solid, when the user picks White in COPY-style.fill_color and drags, then the rectangle has a red outline and an opaque white inside. (R1)
- **AC3** Given the ellipse tool, fill translucent and no fill colour picked, when the user picks Blue in COPY-style.color and draws, then the ellipse has a blue outline and a blue fill at 30 % opacity; when they then pick Yellow in COPY-style.fill_color and Green in COPY-style.color and draw again, then the new ellipse has a green outline and a yellow fill. (R2)
- **AC4** Given a selected rectangle with fill solid, when the user picks Black in COPY-style.fill_color, then its fill is black, as one undo step, and the next rectangle's fill is black; one undo restores its earlier fill colour. (R6)
- **AC5** Given a selected ellipse with fill solid, when the user picks #1e90ff with the custom swatch of COPY-style.fill_color, then its fill is #1e90ff and its outline colour is unchanged. (R1)
- **AC6** Given the rectangle tool with fill colour White, when the user picks the ellipse tool, then the ellipse's fill colour is its own (automatic unless picked for the ellipse). (R6)
- **AC7** Given the text tool, when the user looks at CMP-StylePanel, then COPY-style.text_background shows COPY-style.fill_none marked and no COPY-style.text_background_color. (R3)
- **AC8** Given a 1000 × 800 image and the text tool at M (text size 32), red, background solid, when the user types "Bug", then the text is red without an outline on an opaque white box that extends 8 pixels beyond the text box on every side with corners of radius 6.4 pixels. (R3, R4)
- **AC9** Given a text with a translucent black background on a white image, when the result is exported, then a pixel of the box's margin is (77, 77, 77) within 2 per channel. (R4, R9)
- **AC10** Given a red text with a solid automatic background, when the user picks Blue in COPY-style.color, then the box is white (the pairing of blue); when they pick Yellow, then it is black. (R4)
- **AC11** Given a text with a background and the select tool, when the user clicks inside the box's margin, outside the text box, then the text is selected and its selection outline surrounds the box; given the text tool instead, then that text is edited. (R5)
- **AC12** Given a selected text with a solid background, when the user picks COPY-style.fill_none in COPY-style.text_background, then the box is gone and the outline is back, as one undo step. (R3, R6)
- **AC13** Given a new text "Bug" being edited, when the user picks COPY-style.fill_solid in COPY-style.text_background and Yellow as its colour, then the text is still being edited and shows on a yellow box; when the user types "s", then the box grows with the text. (R8)
- **AC14** Given a rectangle and a text selected, when the user looks at CMP-StylePanel, then neither COPY-style.fill nor COPY-style.text_background is offered; given two texts with solid black and solid white backgrounds selected, then COPY-style.text_background_color is offered with no swatch marked, and picking Blue makes both boxes blue as one undo step. (R7)
- **AC15** Given a rectangle with a red outline and a solid white fill and a text with a solid yellow background, when the user duplicates both and exports, then the copies have the same fill and background, and the exported pixel at the rectangle's centre is white and a pixel of the box's margin is yellow. (R5, R9)
- **AC16** Given focus on COPY-style.fill_color, when a screen reader reads it, then it is a radio group named COPY-style.fill_color whose options are named by their colour names and the custom swatch, and it reports which one is checked. (R1)

## UX notes
COPY-style.fill_color, COPY-style.text_background, COPY-style.text_background_color; the fill
choices reuse COPY-style.fill_none, COPY-style.fill_solid and COPY-style.fill_translucent. Layout
of the colour choices: CMP-StylePanel.

## Edge cases
- Fill none, then solid again → the fill colour picked before is kept (R2).
- A text with a background placed near the canvas edge → the part of the box outside the canvas
  is not exported (RULE-14).
- A text with a background over a solid redaction → drawn over it like any later annotation
  (INV-02).
- A white text with an automatic background → black box; a custom-colour text → black or white
  box by RULE-07's pairing for custom colours.

## Open questions
