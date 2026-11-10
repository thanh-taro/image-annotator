---
id: F-020
title: Fill colour and text background
status: shipped
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
- In: a fill colour for rectangles and ellipses, separate from their colour; a text background
  (none, solid or translucent) with its own text background colour; palette colours and the
  custom swatch (F-019) for both (RULE-22).
- Out: a fill or background for lines, arrows, strokes, highlights, steps and redactions; an
  opacity other than RULE-04's and RULE-22's; turning a shape's outline off; gradients; a
  background margin or corner radius chosen by the user; wrapping text to the background's width;
  a way to unset a fill colour or return a picked text background colour to automatic, other than undo.

## Requirements
- **R1** For a rectangle or ellipse whose fill is solid or translucent, CMP-StylePanel shows the fill colour choice (COPY-style.fill_color) after COPY-style.fill: the 8 palette colours and the custom swatch, which behaves as F-019.R1, R2 and R8 state, with the subject's fill colour in place of its colour. With fill none the choice is not shown. The remembered custom colour (RULE-21) is one for the colour, fill colour and text background colour choices: a custom colour picked in any of them shows on the others' custom swatch when their subject has no custom colour of its own.
- **R2** The fill colour is separate from the colour (D-054, RULE-22): changing the colour never changes the fill colour. When the fill is turned on (none to solid or translucent) for a tool or annotation that has no fill colour yet, the fill colour starts as its colour at that moment, and the fill colour choice marks that swatch (the custom swatch for a custom colour; for a selection, as R7 states). Turning the fill on and the copy of the colour are one change: on a selection one undo step (RULE-11), and undo returns the fill colour to unset. Choosing the marked swatch applies nothing, as for any checked swatch (F-019.R1); picking another colour makes it the fill colour.
- **R3** For a text, CMP-StylePanel shows COPY-style.text_background after the size, with the choices COPY-style.fill_none, COPY-style.fill_solid and COPY-style.fill_translucent (default none), and, when the text background is solid or translucent, the text background colour choice (COPY-style.text_background_color): the 8 palette colours and the custom swatch, as in R1.
- **R4** A text with a background is drawn on a box with rounded corners that surrounds its text box with a margin on every side, opaque when solid and at 70 % opacity when translucent, and without the text outline (RULE-08, RULE-22). Until a text background colour is picked, it is automatic: the contrast pairing colour of the text's colour (RULE-07), following later changes of that colour (RULE-22). Unlike a fill colour (R2), it is never copied once.
- **R5** The background box is part of the text: it moves, duplicates, deletes and reorders with it; a press anywhere on it, or a selection box touching it, selects the text, and with the text tool a press on it edits the text (F-005.R1); the selection outline surrounds the box. The anchor is still the top-left corner of the text box (RULE-08).
- **R6** Fill, fill colour, text background and text background colour follow the current-style and selection rules of every other style choice (RULE-04): they are per tool (rectangle, ellipse, text), not shared with the drawing colour; changing them on a selection is one undo step (RULE-11) and the changed choice becomes the current style of the selected annotations' tools. When turning the fill on for a selection also turns it on for their tool and the tool has no fill colour yet, the tool's fill colour becomes the shared current colour (RULE-22); the colours copied to the selected annotations do not become the tool's fill colour.
- **R7** With a multi-selection, fill and fill colour are offered only when every selected annotation is a rectangle or ellipse, and text background and text background colour only when every one is a text; the colour choice is offered only when every selected annotation's fill or text background is solid or translucent, and a swatch is marked only when all their colours (automatic text background colours as drawn) are the same.
- **R8** While a text is being edited, the canvas draws its background as typed, and the editing outline, like the selection outline (R5), surrounds the background box. A press anywhere inside the box, margin included, belongs to the text being edited: it places the caret at the nearest position (F-005.AC5) and does not end editing; only a press outside the box ends editing (F-005.R3). While the text is empty, the box surrounds the placeholder (COPY-text.placeholder) at the text's size (RULE-22). Choosing a text background or its colour in the panel keeps editing (F-005.R3, F-019.R9). A text removed when editing ends (RULE-08) is removed with its background.
- **R9** Exported fills and backgrounds look the same as on screen at 100 % (NFR-08).

## Acceptance criteria
- **AC1** Given a new page and the rectangle tool, red, fill none, when the user looks at CMP-StylePanel, then COPY-style.fill_color is not shown; when they pick COPY-style.fill_solid, then it is shown with Red marked. (R1, R2)
- **AC2** Given the rectangle tool, red, fill solid, when the user picks White in COPY-style.fill_color and drags, then the rectangle has a red outline and an opaque white inside. (R1)
- **AC3** Given a new page and the ellipse tool, red, fill none, when the user picks COPY-style.fill_translucent, then COPY-style.fill_color marks Red; when they pick Blue in COPY-style.color and draw, then the ellipse has a blue outline and a red fill at 30 % opacity; when they then pick Yellow in COPY-style.fill_color and Green in COPY-style.color and draw again, then the new ellipse has a green outline and a yellow fill. (R2)
- **AC4** Given the rectangle tool with fill solid and a selected rectangle with fill solid, when the user picks Black in COPY-style.fill_color, then the selected rectangle's fill is black, as one undo step, and a rectangle drawn next has a black fill; one undo restores the selected rectangle's earlier fill colour. (R6)
- **AC5** Given a selected ellipse with fill solid, when the user picks #1e90ff with the custom swatch of COPY-style.fill_color, then its fill is #1e90ff and its outline colour is unchanged; when the user then selects a red text with a solid automatic background, the custom swatch of COPY-style.text_background_color shows #1e90ff unmarked. (R1)
- **AC6** Given a new page, the rectangle tool with fill solid and fill colour White, when the user picks the ellipse tool, sets fill solid and draws, then the ellipse's fill is red (the current colour when its fill was turned on) and COPY-style.fill_color marks Red. (R6)
- **AC7** Given the text tool, when the user looks at CMP-StylePanel, then COPY-style.text_background shows COPY-style.fill_none marked and no COPY-style.text_background_color. (R3)
- **AC8** Given a 1000 × 800 image and the text tool at M (text size 32), red, text background solid, when the user types "Bug", then the text is red without an outline on an opaque white box that extends 8 pixels beyond the text box on every side with corners of radius 6.4 pixels in its rendering parameters. (R3, R4)
- **AC9** Given a 1000 × 800 white image and a white text at M with a translucent text background with Black picked, when the result is exported, then the pixel 4 image pixels left of the text box's left edge, at its vertical centre, is (77, 77, 77) within 2 per channel. (R4, R9)
- **AC10** Given a red text with a solid automatic background, when the user picks Blue in COPY-style.color, then the box is white (the pairing of blue); when they pick Yellow, then it is black. (R4)
- **AC11** Given a 1000 × 800 image, a text at M (margin 8) with a background and the select tool, when the user clicks 4 image pixels left of the text box, inside the box, then the text is selected and its selection outline surrounds the box; given the text tool instead, then that text is edited; given the select tool and a selection box that touches only the box's margin, then the text is selected. (R5)
- **AC12** Given a selected text with a solid background, when the user picks COPY-style.fill_none in COPY-style.text_background, then the box is gone and the outline is back, as one undo step. (R3, R6)
- **AC13** Given a new text "Bug" being edited, when the user picks COPY-style.fill_solid in COPY-style.text_background and Yellow as its colour, then the text is still being edited and shows on a yellow box; when the user types "s", then the box grows with the text. (R8)
- **AC14** Given a rectangle and a text selected, when the user looks at CMP-StylePanel, then neither COPY-style.fill nor COPY-style.text_background is offered; given two texts with solid black and solid white backgrounds selected, then COPY-style.text_background_color is offered with no swatch marked, and picking Blue makes both boxes blue as one undo step; given two rectangles selected, one with fill none and one solid, then COPY-style.fill has no option marked and COPY-style.fill_color is not shown. (R7)
- **AC15** Given a rectangle with a red outline and a solid white fill and a text with a solid yellow background, when the user duplicates both and exports, then the copies have the same fill and background, and the exported pixel at the rectangle's centre is white and a pixel of the box's margin is yellow. (R5, R9)
- **AC16** Given focus on COPY-style.fill_color or COPY-style.text_background_color, when a screen reader reads it, then it is a radio group named by its label whose options are named by their colour names and the custom swatch, and it reports which one is checked. (R1, R3)
- **AC17** Given a selected red rectangle with fill solid and fill colour Red, when the user presses Space on the marked Red swatch of COPY-style.fill_color, then nothing changes and no undo step is added; when they pick Blue in COPY-style.color, then the outline is blue and the fill stays red. (R2)
- **AC18** Given a 1000 × 800 image and a text "Bug" at M (margin 8) with a solid background being edited with the caret at its end, when the user clicks in the box's margin 4 image pixels left of the text box, then editing continues with the caret before "B"; when they click 20 image pixels outside the box, then editing ends. (R8)
- **AC19** Given the text tool with a solid background, when the user clicks empty canvas, then before anything is typed the placeholder shows inside the box; when they press Esc, then no text and no box remain and no undo step is added. (R8)
- **AC20** Given a selected rectangle with fill solid and fill colour White, when the user picks COPY-style.fill_none and then COPY-style.fill_solid, then the fill is white. (R2)
- **AC21** Given a new page and the text tool with a solid Yellow text background, when the user picks the rectangle tool (fill none), draws a rectangle and picks the text tool again, then the rectangle has no fill and the text tool's background is still solid Yellow. (R6)
- **AC22** Given a blue and a green rectangle with fill none and no fill colour selected together, and the current colour red, when the user picks COPY-style.fill_solid, then the fills are blue and green, as one undo step, and COPY-style.fill_color marks no swatch; then, with the rectangle tool, red, the next rectangle drawn has a solid red fill. Given the same start instead, after picking COPY-style.fill_solid one undo removes both fills and their fill colours: when the user then picks Purple in COPY-style.color and COPY-style.fill_solid, then both fills are purple. (R2, R6, R7)
- **AC23** Given a selected red rectangle with fill solid and fill colour Red, when the user picks COPY-style.fill_none, picks Blue in COPY-style.color and picks COPY-style.fill_solid, then the outline is blue and the fill is red. (R2)
- **AC24** Given a new page and the rectangle tool, red, fill solid, fill colour White, when the user picks COPY-style.fill_none, draws a rectangle, selects it and picks COPY-style.fill_solid, then its fill is white. (R2, R6)

## UX notes
COPY-style.fill_color, COPY-style.text_background, COPY-style.text_background_color; the fill
choices reuse COPY-style.fill_none, COPY-style.fill_solid and COPY-style.fill_translucent. Layout
of the colour choices: CMP-StylePanel.

## Edge cases
- Fill none, then solid again → the fill colour is kept, whether it was picked or copied from the colour, even if the colour changed meanwhile (R2, AC20, AC23).
- A text with a background placed near the canvas edge → the part of the box outside the canvas
  is not exported (RULE-14).
- A text with a background over a solid redaction → drawn over it like any later annotation
  (INV-02).
- A white text with an automatic background → black box; a custom-colour text → black or white
  box by RULE-07's pairing for custom colours.
- A text background colour equal to the text's colour → allowed and drawn as chosen (the text
  and the caret vanish; the user can pick again); nothing warns.

## Open questions
