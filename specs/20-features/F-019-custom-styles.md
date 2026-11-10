---
id: F-019
title: Custom colour and size
status: draft
milestone: M-1b
priority: P1
personas: [PER-01]
entities: [ENT-Style]
rules: [RULE-04, RULE-07, RULE-10, RULE-11, RULE-21]
screens: [SCR-Annotator]
components: [CMP-StylePanel]
nfr: [NFR-06, NFR-07]
events: []
depends_on: [F-003, F-004, F-005, F-006, F-007, F-008]
---

## Intent
The 8 palette colours and the S, M and L sizes cover most screenshots, but not all: a brand colour,
a line thin enough for a dense UI, or a label large enough for a 4K capture. The owner wants any
colour and any size, without losing the quick choices (D-048, D-049, D-050).

## Scope
- In: a custom colour for every annotation that has a colour (rectangle, ellipse, line, arrow,
  pen, highlight, text, step, solid redaction); a custom size in pixels for the stroke of
  rectangles, ellipses, lines, arrows and pen strokes, the width of highlights, and the text size of
  texts and steps (RULE-21).
- Out: a custom canvas background (D-049); custom blur or pixelate strength; opacity; saved or
  named custom colours; colour formats other than sRGB.

## Requirements
- **R1** CMP-StylePanel's colour choices end with a custom swatch (COPY-style.color_custom) that opens the browser's colour picker; the colour picked there becomes the colour of the subject, as a palette colour does (RULE-04, RULE-21).
- **R2** The custom swatch shows the custom colour last picked on this page, and is marked when the subject's colour is a custom colour; when that colour equals a palette colour, the palette swatch is marked instead (RULE-21).
- **R3** Wherever a size is offered, CMP-StylePanel adds a number field (COPY-style.size_px) in image pixels next to S, M and L; on the wide layout a slider with the same range follows it. The field shows the subject's size in pixels, also when a preset is chosen (RULE-21).
- **R4** A value entered in the field, or set with the slider, becomes a custom size: S, M and L are then unmarked; picking S, M or L returns to the image-relative preset (RULE-04, RULE-21).
- **R5** The number field applies on Enter or when focus leaves it; values are whole pixels kept within RULE-21's range, and anything that is not a number restores the shown value. The slider applies while it moves.
- **R6** Custom colours and sizes follow the current-style and selection rules of every other style choice: they become the current style of the tool or the shared colour group (RULE-04), they change a selection as one undo step (RULE-11), and a step badge and a text outline on a custom colour use the contrast pairing of RULE-07.
- **R7** With a multi-selection, the field and slider are offered only when every selected annotation is sized the same way (RULE-21); the field is empty when their sizes differ.

## Acceptance criteria
- **AC1** Given the rectangle tool, when the user picks #1e90ff with the custom swatch and draws a rectangle, then it is drawn in #1e90ff and the custom swatch is marked; when the user then picks the arrow tool, the custom swatch is still marked and the next arrow is #1e90ff. (R1, R2, R6)
- **AC2** Given a selected step, when the user picks #ffe4b5 with the custom swatch, then the badge is #ffe4b5 with a black number, as one undo step; given #2f4f4f instead, the number is white. (R1, R6)
- **AC3** Given the rectangle tool, when the user picks the palette red's value (RULE-21) with the custom swatch, then Red is marked and the custom swatch is not. (R2)
- **AC4** Given a 1000 × 800 image and the rectangle tool with size M, when the user looks at the panel, then M is marked and the field shows 5; when the user types 7 and presses Enter, then M is unmarked, the field shows 7 and the next rectangle has a 7-pixel stroke. (R3, R4)
- **AC5** Given the text tool, when the user enters 64 in the field, then the next text is 64 pixels high in text size; given the step tool with 64, the next badge is 128 pixels across. (R3, R4)
- **AC6** Given the highlight tool, when the user enters 40 in the field, then the next highlight is 40 pixels wide. (R3, R4)
- **AC7** Given a selected rectangle with a custom 7-pixel stroke, when the user picks L, then the rectangle has the L stroke for its image and L is marked, as one undo step. (R4, R6)
- **AC8** Given the pen tool, when the user enters 0, 5000 or "abc" in the field, then the size becomes 1, the RULE-21 maximum, or stays as it was, respectively. (R5)
- **AC9** Given a selected arrow on the wide layout, when the user drags the slider from 5 to 20, then the arrow's stroke follows while dragging, and one undo restores 5. (R3, R5, R6)
- **AC10** Given a rectangle and a text selected together, when the user looks at the panel, then S, M and L are offered and the field and slider are not; given two rectangles with strokes 5 and 7 selected, the field is empty and no preset is marked. (R7)
- **AC11** Given the rectangle tool with a custom 7-pixel stroke and a new image loaded, when the user draws a rectangle, then its stroke is still 7 pixels. (R4, R6)
- **AC12** Given the narrow layout, when the sheet shows a tool with a custom size of 7, then the summary bar's detail reads COPY-style.size_value with 7, and the sheet shows the field without the slider. (R3)
- **AC13** Given focus on the custom swatch, when a screen reader reads it, then it is named COPY-style.color_custom followed by the hex value of the custom colour (none before one is picked), and reports whether it is marked. (R1, R2)

## UX notes
COPY-style.color_custom, COPY-style.color_custom_value, COPY-style.size_px,
COPY-style.size_value. Narrow widths: the 9 colour choices (the 8 palette colours and the custom
swatch) are laid out in 2 rows of 5, like the background choices.

## Edge cases
- The picker is closed without a choice → nothing changes.
- No image loaded → the field shows nothing and the field and slider are unavailable; presets
  still work.
- A custom size larger than the image → allowed within RULE-21's range; the export draws it as is.
- A custom colour on a solid redaction → fully opaque, like any solid colour (RULE-10).

## Open questions
