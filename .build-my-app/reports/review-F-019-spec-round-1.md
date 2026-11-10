# Spec review: F-019 custom colour and size, round 1

Commit 4124c44, branch build/1.1. Lint: `613 IDs, 2597 references, 0 errors, 0 warnings`.
Owner decisions D-048, D-049 and D-050 are taken as fixed; nothing below reopens them.
Arithmetic checked against RULE-04, where `s` is the image's shorter side: on a 1000 × 800 image `s` = 800. M stroke = max(3, 4.8) = 5 (AC4 ✓, F-003.AC3 ✓). L stroke = max(6, 9.6) = 10. M text = max(16, 32) = 32, so an M badge is 64 (F-006.AC5 ✓). The L highlight width is 3 × 10 = 30. A 64 text size gives a 128 badge (AC5 ✓). The RULE-21 ranges hold every preset up to s = 4096: L stroke 49 ≤ 100, highlight 147 ≤ 300, text 12…246 within 6–400 ✓.

## Verdicts
| Item | Verdict |
|---|---|
| F-019 | **not ready** (B1; M1–M7) |
| RULE-21 | ready after minor fixes (m1, m2, m3) |
| RULE-04, RULE-07, RULE-10 edits | ready |
| RULE-11 edit | ready after minor fixes (wording follows M2) |
| RULE-08 (not edited) | ready after minor fixes (m6) |
| ENT-Style | ready |
| CMP-StylePanel | **not ready** (B1, M4, M5) |
| copy.md (4 new strings) | ready after minor fixes (m8) |
| style.md | ready after minor fixes (m9) |
| platform-mapping.md | not ready until B1 is settled (the native colour input cannot be a radio in the group) |
| roadmap M-1b, changelog | ready |

## Blocker

### B1 — How the custom swatch behaves is undefined, and it conflicts with the radio group (F-019.R1/R2 lines 31–32, edge case line 60; CMP-StylePanel:45; platform-mapping:29)
**Problem.**
- CMP-StylePanel:45 makes the swatches "a labelled radio group". In a radio group, the arrow keys check the next option, which applies that colour at once. F-019 does not say what happens when the user arrows onto the custom swatch: does it open the picker (a change of context on focus, WCAG 3.2.1), apply the remembered colour, or do nothing?
- platform-mapping:29 maps the swatch to a native colour input, which is a button, not a radio.
- R2 remembers "the custom colour last picked", but nothing lets the user apply that colour to another annotation or tool. Line 60 says "picker closed without a choice → nothing changes". Choosing the same value again fires no change in the picker. So re-applying #1e90ff to a second, red rectangle is impossible unless the user moves to another colour and back.

The interaction model must be fixed before design.

**Proposed wording** (F-019, replace R1):
> **R1** CMP-StylePanel's colour choices end with a custom swatch (COPY-style.color_custom / COPY-style.color_custom_value) as the ninth option of the colour radio group. Choosing it (click, tap, or arrow keys) applies the remembered custom colour (RULE-21) when there is one, like any palette colour. Clicking or tapping it, or pressing Enter or Space on it, also opens the browser's colour picker, starting at the swatch's colour. Arrow keys never open the picker. Before any custom colour is picked, arrowing onto the swatch applies nothing, and choosing it only opens the picker.

Edge case line 60, replace with:
> The picker is closed without a choice → the subject keeps the colour it had when the picker opened (the remembered custom colour if the swatch applied it).

Add AC:
> **AC14** Given a custom colour #1e90ff picked earlier and a selected red rectangle, when the user clicks the custom swatch and closes the picker without changing it, then the rectangle is #1e90ff, as one undo step. Given focus on the Black swatch, when the user presses Right arrow, then the custom swatch is checked and the picker does not open. (R1)

platform-mapping:29: say that the swatch is a radio whose activation opens the native picker, which may be visually hidden. A bare `<input type="color">` is not a radio.

## Major

### M1 — The colour the custom swatch shows can contradict the marked state (F-019.R2 line 32; RULE-21 line 28)
**Problem.** The swatch "shows the custom colour last picked on this page" and "is marked when the subject's colour is a custom colour". Example: the user picks #1e90ff for the rectangle tool, then #00ff00 for the highlight tool, then switches back to the rectangle tool. The swatch is marked but shows #00ff00 while the rectangle colour is #1e90ff. The same happens when the user selects an annotation that has an older custom colour. Its accessible name (AC13) would then announce the wrong hex.

**Proposed wording** (R2):
> **R2** When the subject's colour is a custom colour, the custom swatch shows that colour and is marked. Otherwise it shows the custom colour last picked on this page, unmarked (RULE-21). When a picked colour equals a palette colour, that palette swatch is marked instead. With a multi-selection whose colours differ, the custom swatch shows the last picked colour and nothing is marked.

RULE-21 line 28: change "remembered for the custom swatch" to "remembered for the custom swatch when the subject has no custom colour (F-019.R2)". Add AC:
> **AC15** Given #1e90ff picked with the rectangle tool and then #00ff00 with the highlight tool, when the user picks the rectangle tool again, then the custom swatch shows #1e90ff and is marked; with the pen tool at red it shows #00ff00 and Red is marked. (R2)

### M2 — Live preview while the picker is open, and cancelling, are not specified (F-019.R1, line 60; RULE-11 line 18)
**Problem.** RULE-11 groups "the colours reported while the custom colour picker is open" into one step, and platform-mapping previews on `input`. Yet F-019 never says the subject changes while the user is still choosing, so a builder could apply only on close. Nothing covers moving through colours and then cancelling (Esc in the picker). In some browsers the picker panel stays open with no "close" event, so "while the picker is open" cannot be observed and cannot be tested.

**Proposed wording.** Add to F-019:
> **R8** While the user moves through colours in the picker, the subject follows each colour at once. All colours from one opening of the picker until it closes, or until focus moves to another control, form one undo step for a selection (RULE-11). If the picker reports a cancel, the subject returns to its colour from when the picker opened, and no step is recorded.

RULE-11: replace "the colours reported while the custom colour picker is open" with "the colours from one opening of the custom colour picker until it closes or focus leaves it (F-019.R8)". Add AC:
> **AC16** Given a selected red arrow, when the user opens the picker, moves through 3 colours, ends on #2f4f4f and closes it, then the arrow is #2f4f4f and one undo makes it red. (R8)

### M3 — A preset turns into a custom size when focus passes through the field unchanged (F-019.R4/R5 lines 34–35)
**Problem.** "Applies on Enter or when focus leaves it" plus "a value entered becomes a custom size" means that tabbing through a field showing 5 (M) can switch the selection to a custom 5 px. That unmarks M, adds an undo step and makes the size stop following the image. It is also undefined whether typing 5 while M = 5 marks M. That matters for AC10's "strokes 5 and 7".

**Proposed wording** (R5):
> **R5** The number field applies on Enter or when focus leaves it, and only if its text changed since it was last shown. Values are rounded to whole pixels (halves up) and kept within RULE-21's range. An empty field, or text that is not a number, restores the shown value. A changed value becomes a custom size even if it equals a preset's width. The slider applies while it moves.

Add AC:
> **AC17** Given a 1000 × 800 image and a selected rectangle with size M, when the user tabs into the field (showing 5) and out again, then M is still marked and no undo step is added; when they type 5 and press Enter, then M is unmarked and the stroke is a custom 5 px. (R4, R5)

### M4 — It is not stated which colour choices get the custom swatch: the drawing colour and the background (F-019.R1; CMP-StylePanel:13–16)
**Problem.** D-049 excludes the canvas background. R1 says "CMP-StylePanel's colour choices". In the canvas variant, the panel shows two colour groups: the drawing colour (D-047) and the background (palette colours, CMP-StylePanel:13 and :45). F-019 has no AC for either. A builder that reuses one swatch component would add the custom swatch to the background, or leave it off the drawing colour.

**Proposed wording** (R1, append):
> …in every colour choice for annotations, including the drawing colour in canvas settings (D-047), but not in the background choices (D-049).

Add AC:
> **AC18** Given the select tool and nothing selected, when the user looks at the panel, then COPY-style.color ends with the custom swatch and COPY-canvas.background does not. Picking #1e90ff there makes the next rectangle #1e90ff and records no undo step. (R1)

### M5 — Swatch layout: F-019 contradicts CMP-StylePanel, and the 386 px threshold no longer holds (F-019 UX notes lines 56–57; CMP-StylePanel:45)
**Problem.**
- F-019 says that on narrow widths the 9 colour choices sit in 2 rows of 5.
- CMP-StylePanel:45 says 2 rows of 5 only "on a coarse pointer the wide panel, and the narrow sheet below 386 px wide". The 386 px was worked out for 8 touch-sized swatches. A ninth swatch needs a wider viewport to fit in one row, so between 386 px and the new threshold, 9 swatches overflow.
- The same fact is stated twice, and the two statements differ.

**Proposed wording.** CMP-StylePanel:45:
> From M-1b, on narrow widths or a coarse pointer, the 9 colour choices (the 8 palette colours and the custom swatch) are laid out in 2 rows of 5 at touch size, like the 9 background choices.

This drops the 386 px case. Alternatively, recompute the width for 9 swatches. In F-019 UX notes, replace the sentence with "Layout of the 9 colour choices: CMP-StylePanel." (one fact, one place).

### M6 — Editing a text while using the picker or the size field (F-019; F-005.R3; RULE-19)
**Problem.** F-005.R3 keeps editing while "choosing a style in the panel". It does not say whether opening the browser picker (focus leaves the document) ends the edit, or whether Enter in the size field applies the size or goes to the text. A builder following F-005.R3 literally ("focus moves anywhere other than the text or CMP-StylePanel") ends the edit when the picker opens, and a new, still-empty text is then removed (RULE-08).

**Proposed wording.** Add to F-019:
> **R9** While a text is being edited, using the custom swatch, its picker, the size field or the slider keeps editing (F-005.R3) and changes that text; when the field or slider is left, focus returns to the text.

Add AC:
> **AC19** Given a new text "Bug" being edited, when the user picks #1e90ff with the custom swatch and enters 64 in the field, then the text is still being edited and shows in #1e90ff at text size 64. (R9)

### M7 — Several edge cases have no acceptance criterion: no image loaded, export, duplicate, solid redaction (F-019 lines 59–64)
**Problem.** Every edge case needs an AC. The no-image case also contradicts AC11. Custom sizes are absolute, so the field can show a custom size without an image, yet line 61 says "the field shows nothing". Export and duplicate are not covered, and those are the places where a custom value is most likely to be lost: a value saved as a preset by mistake, or not copied with the annotation.

**Proposed wording.** Line 61:
> No image loaded → the field shows the current custom size if there is one, otherwise nothing; with a preset the field and slider are unavailable; presets and the custom swatch still work.

Add ACs:
> **AC20** Given a rectangle with stroke #1e90ff at a custom 7 px on a 1000 × 800 image, when the user duplicates it and exports, then the copy and the exported pixels both show a 7-pixel #1e90ff stroke. (R6)
> **AC21** Given a selected solid redaction, when the user picks #1e90ff, then it is fully opaque #1e90ff; given a blur redaction selected, no colour or size field is offered. (R1, R3)

## Minor

### m1 — RULE-21 (rules.md:28) points from the domain layer up to experience tokens, and the hex comparison is case-sensitive
**Problem.** "`annotation.color.*` in the tokens" breaks the dependency direction (README rule 5). The tokens are uppercase (#D62828) and the picker reports lowercase (platform-mapping:29), so a literal comparison makes AC3 fail.

**Proposed wording:** "a picked value equal to a palette colour's value, ignoring letter case, is that palette colour". Put the token mapping in platform-mapping or MOD-Core instead. In AC3, write the value: "picks #d62828 (the palette red)".

### m2 — Highlight width rounding (RULE-21 line 28, RULE-04)
**Problem.** "3 × the stroke size … rounded to whole pixels" can be read as 3 × round(stroke) or round(3 × stroke). For s = 750 these give 15 and 14.

**Proposed wording:** "a highlight: 3 × its stroke size, the stroke size rounded first". Add to AC6: "Given a 1000 × 800 image and the highlight tool at L, the field shows 30."

### m3 — Two custom sizes in a multi-selection: what "differ" means (F-019.R7 line 37; CMP-StylePanel:42)
**Proposed wording:** "the field is empty when their widths in pixels differ; a preset is marked only when every selected annotation uses that preset."

### m4 — ACs that are not concrete
- AC7 (line 46): "the L stroke for its image" → "Given a 1000 × 800 image … then the stroke is 10 px (L) and L is marked, and the field shows 10, as one undo step".
- AC8 (line 47): "the RULE-21 maximum" → "100". Add "7.5 → 8" and "-3 → 1".
- AC9 (line 48): add "on a 1000 × 800 image" (5 = M) or "a 5-pixel stroke".
- AC10 (line 49): state which rectangle is M on which image: "on a 1000 × 800 image, one rectangle at M (5) and one at a custom 7".
- AC5 (line 44): add "its outline is 5 pixels wide (RULE-08: max(1, 0.08 × 64))", which tests that the outline follows from the custom size.

### m5 — AC13 does not use the copy ID that exists (line 52)
**Proposed wording:** "…then it is named COPY-style.color_custom before a colour is picked and COPY-style.color_custom_value with the hex (#1E90FF) once one is, and it reports whether it is checked."

### m6 — Shipped specs still say sizes are S/M/L only
RULE-08 (rules.md:15) says "its size is set by S/M/L". F-008.R3 says "(their size is S/M/L)". The F-006 Scope says "in the palette colours and three sizes" and the F-005 Scope "in three sizes and the palette colours". From M-1b these are false.

**Proposed wording:** "set by S/M/L or a custom size (RULE-21)". Add a changelog line for each of these shipped items.

### m7 — Esc in the size field (RULE-19; F-019.R5)
**Problem.** Esc keeps its meaning in fields. On the narrow layout it closes the sheet, focus leaves the field, and the half-typed value is applied.

**Proposed wording** (R5, append): "Esc in the field restores the shown value without applying it."

### m8 — copy.md:58 gives the hex as uppercase, while platform-mapping and the ACs use lowercase
**Proposed wording** for the note: "hex shown in uppercase, e.g. #1E90FF, whatever case the picker reports".

### m9 — style.md:56–57 does not say how the custom swatch looks before a colour is picked
**Problem.** AC13 says it has no colour before one is picked. Without a visual, designers will make one up.

**Proposed wording:** "the custom swatch shows its colour once picked; before that it shows a neutral 'pick a colour' mark from the icon set (no colour of its own)".

### m10 — Glossary
**Problem.** "Custom colour", "custom size" and "custom swatch" will appear in code and tests but are not glossary terms.

**Proposed rows:** "Custom colour | An annotation colour outside the palette, chosen in the browser's colour picker (RULE-21) | other colour". "Custom size | A size in whole image pixels instead of S, M or L (RULE-21) | free size".
