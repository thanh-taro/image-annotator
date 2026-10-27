---
id: F-005
title: Add text
status: draft
milestone: M-1
priority: P0
personas: [PER-01]
entities: [ENT-Annotation, ENT-Style]
rules: [RULE-04, RULE-07, RULE-08, RULE-11, RULE-19]
screens: [SCR-Annotator]
components: [CMP-Toolbar, CMP-Canvas, CMP-TextEditor, CMP-StylePanel]
nfr: [NFR-06, NFR-08]
events: []
depends_on: [F-001]
---

## Intent
A short label ("Wrong total", "Click here") turns a mark into an explanation (PRN-03).

## Scope
- In: creating and editing text annotations, multi-line, in three sizes and the palette colours
  (RULE-04, RULE-08).
- Out: choosing typefaces, bold/italic, wrapping to a width, text boxes with backgrounds (M-2
  candidate), spell check beyond what the browser offers.

## Requirements
- **R1** With the text tool, clicking empty canvas places a text annotation whose top-left corner is the click point and starts editing it; clicking an existing text edits that text.
- **R2** While editing, the user types and edits text as in any text field, including new lines, and the text appears at its final size and colour; keys belong to the text except Esc and Mod+S (RULE-19).
- **R3** Editing ends when the user clicks outside the text (which only ends the edit) or presses Esc; the text stays and is selected, and the text tool stays active. Text left empty is removed (RULE-08).
- **R4** With the select tool, double-clicking a text annotation (or pressing Enter when it is the only selection) edits it again.
- **R5** Exported text looks the same as on screen at 100 % (NFR-08), with the outline from RULE-08, in the tool's own typeface including Vietnamese letters.
- **R6** Creating a text is one undo step; editing an existing text to empty deletes it as one undo step (RULE-11).

## Acceptance criteria
- **AC1** Given the text tool, when the user clicks and types "Wrong total", then the text's top-left corner is at the click point and it shows in the current colour and size while typing. (R1, R2)
- **AC2** Given a text being edited, when the user presses Enter and types, then the text has two lines. (R2)
- **AC3** Given a text being edited, when the user presses Esc, then editing ends, the text stays and is selected. (R3)
- **AC4** Given a text was placed and nothing typed, when the user clicks elsewhere, then no annotation remains and no undo step is added. (R3)
- **AC5** Given a selected text annotation and the select tool, when the user double-clicks it, then it can be edited with the caret where they clicked. (R4)
- **AC6** Given white text on a white area, when it is exported, then it has a black outline at least 1 pixel wide. (R5)
- **AC7** Given a text annotation, when the result is exported, then its position, line breaks and size match the on-screen view at 100 % within 2 image pixels. (R5)
- **AC8** Given a text being edited, when the user types the 2,001st character, then it is not accepted; when they paste 3,000 characters into an empty text, then the first 2,000 are kept. (R2)
- **AC9** Given a text being edited, when the user presses Backspace, Delete, an arrow key or Mod+A, then the text changes or the caret moves, and the annotation is neither deleted nor moved. (R2)
- **AC10** Given the text tool while editing a text, when the user clicks empty canvas, then editing ends and no new text is created; a second click creates one. (R3)
- **AC11** Given the text tool, when the user clicks an existing text, then that text is edited instead of a new one being created. (R1)
- **AC12** Given the user created a text "Bug", when they undo once, then the text is gone; when they edit an existing text to empty and undo, then the text is back. (R6)
- **AC13** Given the text tool and canvas focus, when the user presses Enter, then a text starts at the centre of the view in editing. (R1)
- **AC14** Given the user types "Đường dẫn lỗi" and downloads, when the export is opened, then every letter and diacritic is drawn in the tool's own typeface. (R5)

## UX notes
COPY-tool.text in CMP-Toolbar; editing happens in CMP-TextEditor over CMP-Canvas, with
COPY-text.placeholder while empty.

## Edge cases
- Pasting text while editing → inserted as plain text, cut at 2,000 characters.
- Text extending past the canvas edge → kept; the part outside the frame is not exported.

## Open questions
