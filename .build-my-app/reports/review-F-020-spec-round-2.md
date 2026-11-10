# Spec review: F-020 Fill colour and text background, round 2

Fix commit 46e3e16 (branch build/1.2), compared with round 1 (4e80a9c). D-051, D-052 and D-053 were not reopened.

## Lint
`python3 tools/spec_lint.py`: 661 IDs, 2838 references, **0 errors, 0 warnings**.

## Round 1 findings
| Finding | Status | Where |
|---|---|---|
| M1 marked swatch while automatic | Resolved (orchestrator's simpler option, accepted): F-020.R2 says choosing the marked swatch applies nothing (F-019.R1), and AC17 tests it. No contradiction found. For a custom colour, the marked custom swatch still opens the picker (F-019.R1), and moving to another colour there sets the fill colour (F-019.R8), so this stays testable. | F-020:34, :60 |
| M2 margin press and editing outline | Resolved | F-020.R8 :40, AC18 :61; F-005.R3 :28; CMP-TextEditor :20 |
| M3 empty text with a background | Resolved | RULE-22 (rules.md:29), F-020.R8, AC19 :62 |
| M4 AC4 tool fill | Resolved | F-020:47 |
| m1 RULE-07 "used here…" | Resolved | rules.md:14 |
| m2 no way back to automatic | Resolved (Out) | F-020:30 |
| m3 fill before outline | Resolved | MOD-Render.md:12 |
| m4 one remembered custom colour | Resolved (R1); AC5 tests it | F-020:33, :48 |
| m5 vague ACs (AC6, AC8, AC9, AC11) | Resolved (see n1 for the AC11/AC18 size) | F-020:49–54 |
| m6 CMP-StylePanel "differ" list | Resolved | CMP-StylePanel.md:42 |
| m7 MOD-Core bounds | Resolved | MOD-Core.md:38 |
| m8 glossary "automatic" and "text background colour" | Resolved (see n3 for the one remaining use) | glossary.md:17–18, model.md, RULE-22, F-020 |
| m9 requirements without an AC | Resolved: AC20, AC14 (mixed fill), AC11 (marquee), AC21, AC16 (both groups) | F-020:54–64 |
| m10 background colour equal to the text's colour | Resolved (edge case) | F-020:79–80 |

## Verdicts
| Item | Verdict |
|---|---|
| F-020 | **ready after minor fixes** (n1, n2) |
| RULE-22, RULE-04, RULE-07, RULE-08, RULE-11, RULE-21 | ready |
| F-005 (R3, R5) | ready |
| F-019 (referenced, not changed) | ready |
| CMP-StylePanel, CMP-TextEditor | ready |
| MOD-Render, MOD-Core, ENT-Style (`fillColor`), glossary | ready |
| style.md | ready after minor fixes (n3, optional) |

Counts: **0 blockers, 0 major, 3 minor.**

Also checked: AC8 (8 = 0.25 × 32, 6.4 = 0.2 × 32); AC9 (pixel 4 px inside the 8 px margin, 255 × 0.3 = 76.5, so 77); AC10 pairings; AC17 against F-019.R1 and RULE-11 (no step); AC19 against RULE-08, RULE-11 and F-005.AC4; R7's multi-selection marking against R2 (a marked swatch in a mixed automatic/picked selection applies nothing, which is consistent); and neutrality (no tool, platform or pixel values outside the technical layer). No new contradictions with F-005, F-008, F-019 or RULE-04/07/08/11/21/22.

---

## Minor

### n1: AC11 and AC18 use a 4-pixel margin offset without a text size
**Where:** specs/20-features/F-020-fill-and-text-background.md:54 (AC11), :61 (AC18).
**Problem:** The margin is 0.25 × the text size. At S on a small image (text size 12), the margin is 3, so "4 image pixels left of the text box" is outside the box. AC11 states it is "inside the box", which then contradicts itself, and AC18 would end editing. Both ACs are correct only at text size ≥ 16.
**Proposed:** start both with "Given a 1000 × 800 image and a text at M (margin 8) …". For example, AC18: "Given a 1000 × 800 image and a text "Bug" at M with a solid background being edited with the caret at its end, when the user clicks 4 image pixels left of the text box at its vertical centre, then editing continues with the caret before "B"; when they click 20 image pixels outside the box, then editing ends. (R8)"

### n2: AC21 relies on the rectangle tool's fill without stating it
**Where:** F-020:64.
**Problem:** "then the rectangle has no fill" holds only if the rectangle tool's fill is none. That is the default, but the Given doesn't say so, and an earlier step in the same session could have set it.
**Proposed:** "Given a new page and the text tool with a solid Yellow text background, when the user picks the rectangle tool (fill none), draws a rectangle and picks the text tool again, then …".

### n3: style.md still says "background colour"
**Where:** specs/30-experience/style.md:58 ("for a text, its background and background colour").
**Problem:** This is the only remaining bare use. The glossary term is "text background colour" (m8), and the bare wording can be read as the canvas background.
**Proposed:** "for a text, its text background and text background colour, F-020".

## Conclusion
F-020 can be marked **ready** once n1 and n2 are applied. They are wording changes to two ACs and need no design change. n3 is optional.
