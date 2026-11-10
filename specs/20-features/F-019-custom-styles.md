---
id: F-019
title: Custom colour and size
status: draft
milestone: M-1b
priority: P1
personas: [PER-01]
entities: [ENT-Style]
rules: [RULE-04, RULE-07, RULE-08, RULE-10, RULE-11, RULE-19, RULE-21]
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
- **R1** CMP-StylePanel's colour choices for annotations, including the drawing colour in canvas settings (D-047) but not the background choices (D-049), end with a custom swatch (COPY-style.color_custom / COPY-style.color_custom_value) as the ninth option of the colour radio group. Choosing it (click, tap or arrow keys) applies the remembered custom colour (RULE-21) when there is one, like any palette colour. Clicking or tapping it, or pressing Enter or Space on it, also opens the browser's colour picker, starting at the swatch's colour. Arrow keys never open the picker. Before any custom colour is picked, arrowing onto the swatch applies nothing, and choosing it only opens the picker.
- **R2** When the subject's colour is a custom colour, the custom swatch shows that colour and is marked. Otherwise it shows the custom colour last picked on this page, unmarked (RULE-21). When a picked colour equals a palette colour, that palette swatch is marked instead. With a multi-selection whose colours differ, the custom swatch shows the last picked colour and nothing is marked.
- **R3** Wherever a size is offered, CMP-StylePanel adds a number field (COPY-style.size_px) in image pixels after S, M and L; on the wide layout a slider with the same range follows it. The field shows the subject's size in pixels, also when a preset is chosen (RULE-21).
- **R4** A value entered in the field, or set with the slider, becomes a custom size: S, M and L are then unmarked; picking S, M or L returns to the image-relative preset (RULE-04, RULE-21).
- **R5** The number field applies on Enter or when focus leaves it, and only if its text changed since it was last shown. Values are rounded to whole pixels (halves up) and kept within RULE-21's range. An empty field, or text that is not a number, restores the shown value. A changed value becomes a custom size even if it equals a preset's width. Esc in the field restores the shown value without applying it. The slider applies while it moves.
- **R6** Custom colours and sizes follow the current-style and selection rules of every other style choice: they become the current style of the tool or the shared colour group (RULE-04), they change a selection as one undo step (RULE-11), and a step badge and a text outline on a custom colour use the contrast pairing of RULE-07.
- **R7** With a multi-selection, the field and slider are offered only when every selected annotation is sized the same way (RULE-21). The field is empty when their widths in pixels differ; a preset is marked only when every selected annotation uses that preset.
- **R8** While the user moves through colours in the picker, the subject follows each colour at once. All colours from one opening of the picker until it closes, or until focus moves to another control, form one undo step for a selection (RULE-11). If the picker reports a cancel, the subject returns to its colour from when the picker opened, and no step is recorded.
- **R9** While a text is being edited, using the custom swatch, its picker, the size field or the slider keeps editing (F-005.R3) and changes that text; when the field or slider is left, focus returns to the text.

## Acceptance criteria
- **AC1** Given the rectangle tool, when the user picks #1e90ff with the custom swatch and draws a rectangle, then it is drawn in #1e90ff and the custom swatch is marked; when the user then picks the arrow tool, the custom swatch is still marked and the next arrow is #1e90ff. (R1, R2, R6)
- **AC2** Given a selected step, when the user picks #ffe4b5 with the custom swatch, then the badge is #ffe4b5 with a black number, as one undo step; given #2f4f4f instead, the number is white. (R1, R6)
- **AC3** Given the rectangle tool, when the user picks #d62828 (the palette red) with the custom swatch, then Red is marked and the custom swatch is not. (R2)
- **AC4** Given a 1000 × 800 image and the rectangle tool with size M, when the user looks at the panel, then M is marked and the field shows 5; when the user types 7 and presses Enter, then M is unmarked, the field shows 7 and the next rectangle has a 7-pixel stroke. (R3, R4)
- **AC5** Given the text tool, when the user enters 64 in the field, then the next text is 64 pixels high in text size with an outline 5.12 pixels wide (RULE-08: 0.08 × 64); given the step tool with 64, the next badge is 128 pixels across. (R3, R4)
- **AC6** Given a 1000 × 800 image and the highlight tool at L, when the user looks at the field, then it shows 30; when the user enters 40, then the next highlight is 40 pixels wide. (R3, R4)
- **AC7** Given a 1000 × 800 image and a selected rectangle with a custom 7-pixel stroke, when the user picks L, then the stroke is 10 pixels, L is marked and the field shows 10, as one undo step. (R4, R6)
- **AC8** Given the pen tool, when the user enters 0, -3, 7.5, 5000 or "abc" in the field, then the size becomes 1, 1, 8, 100, or stays as it was, respectively. (R5)
- **AC9** Given a 1000 × 800 image and a selected arrow at M on the wide layout, when the user drags the slider from 5 to 20, then the arrow's stroke follows while dragging, and one undo restores M. (R3, R5, R6)
- **AC10** Given a rectangle and a text selected together, when the user looks at the panel, then S, M and L are offered and the field and slider are not; given on a 1000 × 800 image one rectangle at M (5) and one at a custom 7 selected, then the field is empty and no preset is marked. (R7)
- **AC11** Given the rectangle tool with a custom 7-pixel stroke and a new image loaded, when the user draws a rectangle, then its stroke is still 7 pixels. (R4, R6)
- **AC12** Given the narrow layout, when the sheet shows a tool with a custom size of 7, then the summary bar's detail reads COPY-style.size_value with 7, and the sheet shows the field without the slider. (R3)
- **AC13** Given focus on the custom swatch, when a screen reader reads it, then it is named COPY-style.color_custom before a colour is picked and COPY-style.color_custom_value with the hex (#1E90FF) once one is, and it reports whether it is checked. (R1, R2)
- **AC14** Given a custom colour #1e90ff picked earlier and a selected red rectangle, when the user clicks the custom swatch and closes the picker without changing it, then the rectangle is #1e90ff, as one undo step; given focus on the Black swatch, when the user presses Right arrow, then the custom swatch is checked and the picker does not open. (R1)
- **AC15** Given #1e90ff picked with the rectangle tool and then #00ff00 with the highlight tool, when the user picks the rectangle tool again, then the custom swatch shows #1e90ff and is marked; with the pen tool at red it shows #00ff00 and Red is marked. (R2)
- **AC16** Given a selected red arrow, when the user opens the picker, moves through 3 colours, ends on #2f4f4f and closes it, then the arrow is #2f4f4f and one undo makes it red. (R8)
- **AC17** Given a 1000 × 800 image and a selected rectangle with size M, when the user tabs into the field (showing 5) and out again, then M is still marked and no undo step is added; when they type 5 and press Enter, then M is unmarked and the stroke is a custom 5 pixels. (R4, R5)
- **AC18** Given the select tool and nothing selected, when the user looks at the panel, then COPY-style.color ends with the custom swatch and COPY-canvas.background does not; picking #1e90ff there makes the next rectangle #1e90ff and records no undo step. (R1)
- **AC19** Given a new text "Bug" being edited, when the user picks #1e90ff with the custom swatch and enters 64 in the field, then the text is still being edited and shows in #1e90ff at text size 64. (R9)
- **AC20** Given a rectangle with stroke #1e90ff at a custom 7 pixels on a 1000 × 800 image, when the user duplicates it and exports, then the copy and the exported pixels both show a 7-pixel #1e90ff stroke. (R6)
- **AC21** Given a selected solid redaction, when the user picks #1e90ff, then it is fully opaque #1e90ff; given a blur redaction selected, then no colour and no size field are offered. (R1, R3)
- **AC22** Given no image loaded and the rectangle tool at M, when the user looks at the panel, then the field shows nothing and the field and slider are unavailable; with a custom 7 the field shows 7. (R3)

## UX notes
COPY-style.color_custom, COPY-style.color_custom_value, COPY-style.size_px,
COPY-style.size_value. Layout of the 9 colour choices: CMP-StylePanel.

## Edge cases
- The picker is closed without a choice → the subject keeps the colour it had when the picker
  opened (the remembered custom colour if the swatch applied it).
- No image loaded → the field shows the current custom size if there is one, otherwise nothing;
  with a preset the field and slider are unavailable; presets and the custom swatch still work.
- A custom size larger than the image → allowed within RULE-21's range; the export draws it as is.
- A custom colour on a solid redaction → fully opaque, like any solid colour (RULE-10).

## Open questions
