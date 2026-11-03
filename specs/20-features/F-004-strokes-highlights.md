---
id: F-004
title: Draw strokes and highlights
status: shipped
milestone: M-1
priority: P0
personas: [PER-01]
entities: [ENT-Annotation, ENT-Style]
rules: [RULE-04, RULE-05, RULE-06, RULE-09, RULE-19]
screens: [SCR-Annotator]
components: [CMP-Toolbar, CMP-Canvas, CMP-StylePanel]
nfr: [NFR-02]
events: []
depends_on: [F-001]
---

## Intent
Free drawing covers what shapes can't (underlining, circling irregular areas), and a
highlighter marks text without hiding it (PRN-03).

## Scope
- In: pen strokes and translucent highlights, with their styles (RULE-04, RULE-09).
- Out: pressure sensitivity, shape recognition, an eraser (users delete whole annotations, F-008).

## Requirements
- **R1** With the pen tool, dragging draws a smooth stroke along the pointer's path in the current colour and stroke size.
- **R2** With the highlight tool, dragging draws a wide translucent mark (RULE-09); the image underneath stays readable.
- **R3** Holding Shift while dragging a highlight keeps it on a straight horizontal or vertical line (RULE-06), for marking a line of text.
- **R4** Each finished drag is one annotation; a click, or Enter with the tool active (RULE-19), places a dot (RULE-05).

## Acceptance criteria
- **AC1** Given the pen tool, when the user drags a zig-zag, then one stroke annotation follows the path, with consecutive sampled points joined by a smooth curve (no visible angle between samples at 400 % zoom). (R1, R4)
- **AC2** Given the highlight tool over black text on white, when the user drags across the text, then the text is still readable under a yellow mark at 40 % opacity. (R2)
- **AC3** Given the highlight tool, when the user drags back over the same spot within one drag, then that spot is no darker than the rest of the highlight. (R2)
- **AC4** Given the highlight tool, when the user holds Shift and drags mostly sideways, then the highlight is perfectly horizontal. (R3)
- **AC5** Given the pen tool, when the user clicks without dragging, then a dot of the stroke size is placed. (R4)
- **AC6** Given the highlight tool and canvas focus, when the user presses Enter, then a highlight dot appears at the centre of the view and is selected. (R4)

## UX notes
Tools in CMP-Toolbar: COPY-tool.pen, COPY-tool.highlight. Colour and size in CMP-StylePanel.

## Edge cases
- Touch input → drawing follows one finger; a second finger cancels the stroke and pans/zooms (F-002).

## Open questions
