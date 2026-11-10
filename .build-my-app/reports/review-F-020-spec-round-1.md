# Spec review — F-020 Fill colour and text background, round 1

Commit 4e80a9c (branch build/1.2). Owner decisions D-051, D-052, D-053 were taken as given and not reopened.

## Lint
`python3 tools/spec_lint.py`: 656 IDs, 2804 references, **0 errors, 0 warnings**.

## Verdicts
| Item | Verdict |
|---|---|
| F-020 | **not ready** (M1–M4) |
| RULE-22 | ready after minor fixes (M3 adds a clause) |
| RULE-04, RULE-08, ENT-Style (`fill`, `fillColor`) | ready |
| RULE-07 (not changed, but now also used by RULE-22) | ready after minor fixes (m1) |
| F-003.R3 | ready |
| F-005 scope / R5 | ready after minor fixes (R3 needs the margin rule, M2) |
| CMP-TextEditor (not changed, but affected) | **not ready** (M2, M3) |
| CMP-StylePanel | ready after minor fixes (m6) |
| style.md, copy (3 strings), roadmap M-1c, changelog | ready |
| MOD-Render | ready after minor fixes (m3) |
| MOD-Core | ready after minor fixes (m7) |
| glossary | ready after minor fixes (m8) |

Counts: **0 blockers, 4 major, 10 minor.**

Checked and found consistent: RULE-04 numbers (M text size on 1000 × 800 = max(16, 0.04·800) = 32, so the margin is 8 and the radius 6.4); AC9 (70 % black over white = 255 × 0.3 = 76.5, so 77 ± 2); AC10 pairings (blue → white, yellow → black); F-008.AC5/R4 (rectangle + text: no fill); F-019 picker undo chain (F-019.R8 through R1); F-019.R9 through R8; INV-02/RULE-10 (a background is part of the text, drawn over earlier redactions, never sampled by blur or pixelate); RULE-14 clipping; RULE-19 (no new keys needed: radio groups use the existing arrow and Space behaviour); the narrow summary bar (COPY-style.sheet_summary shows only subject and size, so it needs no change); hit-testing inside filled shapes (already covered by "visible mark"); neutrality (no tool, platform or pixel values added outside the technical layer); events: [] matches every other feature.

---

## Major

### M1 — Picking the swatch that is already marked while the colour is automatic contradicts F-019.R1, and its undo effect is undefined
**Where:** specs/20-features/F-020-fill-and-text-background.md:33 (R2), :35 (R4 "as R2 states"), :38 (R7); in conflict with specs/20-features/F-019-custom-styles.md:31 (R1: "when the swatch is already checked, choosing it applies nothing").
**Problem:** While the fill colour is automatic, R2 marks the swatch of the annotation's colour and says "picking any fill colour, even the one marked, makes it the fill colour". This causes three problems:
1. A checked radio button does nothing on click or Space by default, so the implementation has to handle this case on purpose, and the spec doesn't say so.
2. When the annotation's colour is a custom colour, the marked swatch is the custom swatch. F-019.R1, which R1 applies here, says choosing a checked custom swatch applies nothing. R2 says it picks.
3. For a selection, the change is invisible (automatic → picked, same colour). Nothing says whether it is an undo step. RULE-11 counts restyling, but AC4/AC12 only cover visible changes.

No AC checks that picking the marked swatch stops it following the colour. The same applies to text backgrounds through R4 and to multi-selections through R7.
**Proposed wording (R2, replacing its last sentence):**
> Choosing the marked swatch while the fill colour is automatic (click, tap, Enter or Space; for the custom swatch this also opens the picker, F-019.R1) picks that colour: the fill colour no longer follows the colour, and for a selection this is one undo step even though nothing looks different. F-019.R1's "when the swatch is already checked, choosing it applies nothing" applies only to a fill colour that has been picked. With a multi-selection (R7), choosing the marked swatch picks it for every selected annotation.

**New AC:**
> **AC17** Given a selected red rectangle with fill solid and an automatic fill colour, when the user presses Space on the marked Red swatch of COPY-style.fill_color and then picks Blue in COPY-style.color, then the outline is blue and the fill stays red; one undo makes the outline red, and a second undo makes the fill colour automatic again (picking Green in COPY-style.color then makes the fill green). (R2)

### M2 — How the background box works with the text editor is not specified (click in the margin while editing, editing outline)
**Where:** F-020.R8 (:39), F-020.R5 (:36), specs/20-features/F-005-text.md:28 (R3 "clicks outside the text … only ends the edit"), specs/30-experience/components/CMP-TextEditor.md:12, :20 (not changed).
**Problem:** Under ADR-0009 §2, CMP-TextEditor is a transparent field placed over the text box only, and it has its own dashed editing outline. With a background:
- **Click in the margin.** R5 says a press anywhere on the box edits the text. But while the text is being edited, a press in the margin (outside the field) counts as "outside the text" under F-005.R3, so it ends the edit. One reading keeps editing and moves the caret; the other ends editing. The implementation will pick one at random.
- **Editing outline.** Nothing says whether the editing outline surrounds the text box (it would then sit inside the background box) or the background box (as R5 says for the selection outline).
**Proposed wording (F-020.R8, replacing the first sentence):**
> While a text is being edited, the canvas draws its background as typed, and the editing outline surrounds the background box, as the selection outline does (R5). A press anywhere inside the box, margin included, belongs to the text being edited: it places the caret at the nearest position (F-005.AC5) and does not end editing. Only a press outside the box ends editing (F-005.R3).

**F-005.R3:** change "clicks outside the text" to "clicks outside the text (from M-1c, outside its background box, F-020.R8)".
**CMP-TextEditor Behavior:** add "From M-1c, for a text with a background, its outline surrounds the background box, and a press in the box's margin places the caret (F-020.R8)."
**New AC:**
> **AC18** Given a text "Bug" with a solid background being edited with the caret at its end, when the user clicks in the box's margin 4 image pixels left of the text box, then editing continues with the caret before "B"; when they click 20 image pixels outside the box, then editing ends. (R8)

### M3 — An empty text with a background (every new text when the tool's background is on) has no defined box
**Where:** specs/10-domain/rules.md:29 (RULE-22), F-020.R8 (:39), AC13 (:55); CMP-TextEditor.md:12 (COPY-text.placeholder while empty).
**Problem:** The text box of an empty text is 0 wide and one line high (ADR-0020: as wide as the longest line). RULE-22 would draw a box 0.5 × the text size wide (16 × 56 at text size 32). The editor's placeholder "Type here" would overflow it. Every text placed with the text tool's background set to solid or translucent starts in this state, so the first thing the user sees is undefined. AC13 starts from "Bug" and so avoids the case.
**Proposed wording (add to RULE-22):**
> While the text being edited is empty, its background box surrounds the placeholder (COPY-text.placeholder) at the text's size, and the placeholder shows on it. An empty text is removed when editing ends (RULE-08), so this box is never exported.

(The other option, also acceptable: "…the box surrounds a text box one line high and 0 wide, and the placeholder is drawn past it". Either way, state which.)
**New AC:**
> **AC19** Given the text tool with a solid background, when the user clicks empty canvas, then before anything is typed the placeholder shows inside the box; when they press Esc, then no text and no box remain and no undo step is added. (R8)

### M4 — AC4 depends on an unstated tool fill, so it fails against a correct implementation
**Where:** F-020:46 (AC4).
**Problem:** "…and the next rectangle's fill is black". Under RULE-04, only the changed choice (the fill colour) becomes the rectangle tool's current style. src/core/tools.ts already works this way ("a style choice that becomes tool's current style"). The tool's fill stays at its default none, so the next rectangle has no fill and AC4 fails. If an implementation instead copies the whole style to the tool to make the AC pass, it breaks RULE-04.
**Proposed wording:**
> **AC4** Given the rectangle tool with fill solid and a selected rectangle with fill solid, when the user picks Black in COPY-style.fill_color, then the selected rectangle's fill is black, as one undo step, and a rectangle drawn next has a black fill; one undo restores the selected rectangle's earlier fill colour. (R6)

---

## Minor

### m1 — RULE-07 says the contrast pairing is used "here and in RULE-08", which is now incomplete
**Where:** specs/10-domain/rules.md:14. **Proposed:** "**Contrast pairing**, used here, in RULE-08 and in RULE-22:".

### m2 — No way back to automatic, and it isn't stated
**Where:** F-020:27 (Out), RULE-22. Once a fill or background colour is picked, only undo makes it automatic again. Implementers may add a reset, or testers may expect one. **Proposed (add to Out):** "a way to return a picked fill or background colour to automatic, other than undo".

### m3 — The order of fill and outline is not specified, and now matters
**Where:** specs/40-technical/modules/MOD-Render.md:12. With a fill colour different from the outline, a fill drawn after the stroke would cover the inner half of the outline (AC2: "red outline"). The current code draws the fill first, but nothing in the spec requires it. **Proposed:** "rectangles and ellipses (solid or 30 % fill over the shape's box, in the fill colour from M-1c, RULE-22, then the outline over it)".

### m4 — The remembered custom colour across the three custom swatches is not stated
**Where:** F-020.R1 (:32). RULE-21 says "the custom colour last picked on the page", which suggests one value for all three swatches (colour, fill colour, background colour), but R1 only says "with the subject's fill colour in place of its colour". **Proposed (add to R1):** "The remembered custom colour (RULE-21) is the same one for the colour, fill colour and background colour choices: a custom colour picked in any of them is shown on the others' custom swatch when their subject has no custom colour."

### m5 — Some ACs are vague or leave out the setup they need
- **AC6 (:48)** "is its own (automatic unless picked)" can't be tested. **Proposed:** "Given a new session, the rectangle tool with fill solid and fill colour White, when the user picks the ellipse tool, sets fill solid and draws, then the ellipse's fill is red (automatic, the current colour) and COPY-style.fill_color marks Red. (R6)"
- **AC9 (:51)** leaves out the text colour and where the pixel is. **Proposed:** "Given a 1000 × 800 white image and a white text at M with a translucent background with Black picked, when the result is exported, then the pixel 4 image pixels left of the text box's left edge, at its vertical centre, is (77, 77, 77) within 2 per channel. (R4, R9)"
- **AC8 (:50)** add "in its rendering parameters" after "radius 6.4 pixels", as F-019.AC5 does, so the fractional values can be tested.
- **AC11 (:53)** "clicks inside the box's margin" → "clicks 4 image pixels left of the text box, inside the box".

### m6 — CMP-StylePanel's "differ" rule doesn't list the new choices
**Where:** specs/30-experience/components/CMP-StylePanel.md:42. **Proposed:** "When the selected annotations differ in a choice (colour, size, kind, fill, fill colour, background or background colour; automatic colours compared as drawn, F-020.R7), no option of that choice is marked…".

### m7 — MOD-Core lists the box for marquee hits only, not for hit-testing and bounds
**Where:** specs/40-technical/modules/MOD-Core.md:38. RULE-22 makes the box the text's area for hit-testing, selection outline and bounds (scrolling into view, RULE-19). **Proposed:** after `hitTest(…)`, `boundsOf(…)` add "(a text with a background: its background box, RULE-22)".

### m8 — Glossary: "automatic" and "background colour" are undefined or ambiguous
**Where:** specs/00-product/glossary.md:16–17; RULE-22, ENT-Style, F-020 use "background colour", which can be confused with the canvas background (RULE-14, COPY-canvas.background). **Proposed:** change the Text background entry to "…with its own colour, the *text background colour*: automatic (the contrast pairing of the text's colour, RULE-07) until one is picked (RULE-22)." Use "text background colour" (not "background colour") in RULE-22, ENT-Style `fillColor` and F-020.R3–R8.

### m9 — Requirements without an AC
- RULE-22 / edge case :66 "picked colour kept through none → solid": **AC** "Given a selected rectangle with fill solid and fill colour White, when the user picks COPY-style.fill_none and then COPY-style.fill_solid, then the fill is white. (R2)"
- R7 colour choice hidden when the selection mixes fill none and fill solid: **AC** "Given two rectangles selected, one with fill none and one solid, then COPY-style.fill has no option marked and COPY-style.fill_color is not shown. (R7)"
- R5 marquee and duplicate offset: **AC** "Given a text with a background and the select tool, when the user drags a selection box that touches only the box's margin, then the text is selected. (R5)"
- R6 text tool on its own: **AC** "Given the text tool with a solid Yellow background, when the user picks the rectangle tool and then the text tool again, then the background is still solid Yellow; a rectangle drawn in between has no fill. (R6)"
- AC16 covers only COPY-style.fill_color: add "…and the same for COPY-style.text_background_color".

### m10 — A text background in the same colour as the text (text and caret invisible)
**Where:** F-020 Edge cases (:66–72). A picked background equal to the text colour hides the text. CMP-TextEditor's caret also uses the text colour, so the caret disappears too. **Proposed edge case:** "A background colour equal to the text's colour → allowed and drawn as chosen (the user sees the text vanish and can pick again); nothing warns."
