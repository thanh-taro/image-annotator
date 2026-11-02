# Design D4 (narrow 390 + FLOW-02) — round 1 triage

Reviews: spec audit (0 blocker · 2 major · 10 minor), UI critique (0 · 3 · 6), accessibility (0 · 4 · 6). The D-020 spec review before this round is in `spec-change-D-020.md`.

## Fixed
| Finding | Fix |
|---|---|
| UI M1: the open sheet hides the selection and the frame | Spec: while the sheet is open the view moves (refits if fitted) so the canvas or frame shows above it. Boards: selecting and cropping show the image above the sheet |
| UI M2 / audit / a11y m5: no "more tools" cue | Tools gap is 8 px at 390, so the 8th icon is about half cut |
| a11y M1: the active tool can be off-screen | Spec: the active or focused tool is scrolled into view, and the fade shows only while more tools follow. Cropping board: row scrolled to the end, no fade |
| UI M3: the sheet scroll cue looks like a smudge | Replaced with a plain bottom fade |
| UI m3: the sheet is taller than half | The cap includes the bar (235 + 47 px) |
| a11y M2 / audit: step names | New COPY-a11y.step_annotation "Step {number} at {x}, {y}" (CMP-Canvas) |
| a11y M3: summary bar label in name | Name = COPY-style.sheet_toggle + visible summary (aria-labelledby); spec updated |
| a11y M4 / audit tokens: 36 px swatches | 44 px in the sheet |
| Audit: crop fields never shown on narrow | The cropping board shows the sheet open with the fields |
| Audit: COPY-canvas.title unused | New board canvas-settings narrow ("Canvas · Padding None"); detail format in copy.md |
| Audit: FLOW-02 step 1 doesn't show the open | Label points to FLOW-01 step 1 for the just-opened state (same screen state) |
| UI m1: highlight overshoots the text | Ends trimmed to the line |
| UI m5: crop includes a grey band | Frame snapped to the card (1,171 × 771); padding M 70 px; canvas 1,311 × 911; fit 67 % |
| Audit: sample subtitles touch the toggles | Shortened |
| Audit: badge colour raw #FFF | var(--ann-white) |
| a11y m6: crop panel landmark named "Crop" | Named "Style" (also the D3 cropping board) |
| a11y m7, m9 | Sheet tabindex removed; space between link name parts |
| Audit: titles disagree, `_vi` file name | One title per board; file renamed `SCR-Annotator_default_narrow-vi` |

## Not changed
- UI m2 (empty narrow zoom gap): same as the approved D3 empty board.
- UI m4 (notice over the canvas edge): matches D2/D3 placement (bottom centre of the work area).
- UI m6 (Copy height 44 px): kept for the 44 px target.
- Audit: board connectors (the canvas tool has none; FLOW-01 was accepted the same way); en count fit with Manrope confirmed in renders.
- a11y m8, m10: the colour is named in the sheet; document `lang` is a build item.
- Manual QA (a11y list): screen readers on the sheet, focus order versus visual order on narrow, 200 % text at 320 px, reduced motion, touch crop.

## Round 2 (re-check of the fixes)
- Accessibility and spec: all fixes landed; 0 blockers, 0 majors. Fixed 2 minors: the bar name is "{sheet_toggle}: {sheet_summary}" and the canvas detail join is spelled out (copy.md, CMP-StylePanel).
- UI: all fixes landed. Fixed N1 (Reset crop squashed in the sheet: sheet children no longer shrink), N3 (a left fade when earlier tools are scrolled out; CMP-Toolbar: a fade on each edge only while tools are hidden beyond it), N4 (highlight ends clear the first and last letters). Not changed: N2 selection outline 4 px outside the shape (approved D1 convention); the tool cut cue reads as "more tools" even though the 8th icon sits mostly under the fade.
- Converged in 2 rounds.
