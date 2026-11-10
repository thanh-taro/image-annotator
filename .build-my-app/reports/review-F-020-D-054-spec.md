# Spec review: F-020 / D-054 (fill colour separate from the colour)

Commit fc08b8c, branch build/1.2. D-054 was not reopened.
Lint: `662 IDs, 2865 references, 0 errors, 0 warnings`.

## Verdicts
| Item | Verdict |
|---|---|
| RULE-22 | ready after minor fixes |
| RULE-04 | ready |
| F-020 (R1, R2, R6, R7, AC1–AC22) | not ready: 2 major findings, each a one-sentence fix |
| ENT-Style (`fillColor`) | ready after minor fixes |
| Glossary (Fill colour, Automatic) | ready after minor fixes |
| CMP-StylePanel | ready after minor fixes |
| MOD-Core | ready after minor fixes |

Counts: 0 blocker, 2 major, 4 medium, 5 minor.

## Major

**M1. F-020.R4 still says the text background follows its colour "as R2 states for a fill"**
- Location: specs/20-features/F-020-fill-and-text-background.md:36
- Problem: R2 now says the opposite (a fill never follows the colour). An implementer who follows the cross-reference may make both behave the same way, or may read R2 as automatic again.
- Proposed: "Until a text background colour is picked, it is automatic: the contrast pairing colour of the text's colour (RULE-07), following later changes of that colour (RULE-22). Unlike a fill colour (R2), it is never copied once."

**M2. The tool's fill colour is not defined when a selection turns the fill on**
- Location: F-020.R6 (line 38); AC22 (line 65); RULE-22 (rules.md:29)
- Problem: R6 says the changed choice becomes the current style of the selected annotations' tools. Take a new page: the rectangle tool has fill none and its fill colour is unset. Turning fill solid on a blue and a green rectangle makes the tool's fill solid. Its fill colour could then be:
  - the shared colour (by RULE-22, applied to the tool itself),
  - one of the copied colours, or
  - still unset, which leaves fill on with no colour.
  The spec does not say which. The ambiguity could also lead to a state where fill is on but no colour is set.
- Proposed (R6, add): "When turning the fill on for a selection also turns it on for their tool and the tool has no fill colour yet, the tool's fill colour becomes the shared current colour (RULE-22). The colours copied to the selected annotations are not a picked fill colour and do not become the tool's fill colour."
- Proposed (AC22, append): "…; then, with the rectangle tool, red, the next rectangle drawn has a solid red fill."
- If the owner wants something else here (for example, the selection's colour when all selected annotations share one), that is a small new decision. It is not a reopening of D-054.

## Medium

**MD1. AC1's Given does not determine the marked swatch**
- Location: F-020:44
- Problem: "the rectangle tool with fill none" may already have a kept fill colour (for example White, from AC20-like use). In that case White is marked, not "the current colour".
- Proposed: "Given a new page and the rectangle tool, red, fill none, when the user looks at CMP-StylePanel, then COPY-style.fill_color is not shown; when they pick COPY-style.fill_solid, then it is shown with Red marked. (R1, R2)"

**MD2. No AC covers the main D-054 case: a colour change while fill is none, then fill on again**
- Location: F-020 AC list and Edge cases (line 73)
- Problem: AC20 uses a picked White, so it cannot tell "copy once" apart from "copy every time fill is turned on". An implementation that re-copies the colour on every none→solid would pass AC20.
- Proposed AC23: "Given a selected red rectangle with fill solid and fill colour Red, when the user picks COPY-style.fill_none, picks Blue in COPY-style.color and picks COPY-style.fill_solid, then the outline is blue and the fill is red. (R2)"
- Proposed edge case (line 73): "Fill none, then solid again → the fill colour is kept, whether it was picked or copied from the colour, even if the colour changed meanwhile (R2, AC20, AC23)."

**MD3. Undo of the copy does not say the fill colour returns to unset**
- Location: F-020 AC22 (line 65); R2
- Problem: "one undo removes both fills" can be met by restoring fill none while keeping blue and green as their fill colours. Turning the fill on again later would then give stale colours. The copy has to be part of the same step and has to be undone with it.
- Proposed (R2, add): "Turning the fill on and the copy of the colour are one change: on a selection one undo step (RULE-11), and undo returns the fill colour to unset."
- Proposed (AC22, replace end): "…; one undo removes both fills and their fill colours: when the user then picks Purple in COPY-style.color and COPY-style.fill_solid, then both fills are purple."

**MD4. Annotations drawn with fill none inherit the tool's kept fill colour, and this is not stated**
- Location: RULE-22 (rules.md:29); F-020.R2 (line 34)
- Problem: By RULE-04, a new annotation gets the tool's fill colour. A rectangle drawn while the tool has fill none but a kept White gets White, not unset. Turning its fill on later gives White, not its own colour. This follows from the rules, but it is easy to implement as "new annotations start unset", which would be a wrong design.
- Proposed (RULE-22, add): "A new rectangle or ellipse takes its tool's fill colour (RULE-04), unset included, also while its fill is none."
- Proposed AC: "Given a new page and the rectangle tool, red, fill solid, fill colour White, when the user picks COPY-style.fill_none, draws a rectangle, selects it and picks COPY-style.fill_solid, then its fill is white. (R2, R6)"

## Minor

**m1. No invariant says a filled rectangle or ellipse always has a fill colour**
- Location: RULE-22 (rules.md:29) or ENT-Style (model.md:46)
- Proposed: "A rectangle or ellipse, or a tool, whose fill is solid or translucent always has a fill colour; `unset` only occurs with fill none."
- This lets MOD-Core and MOD-Render skip any fallback for unset.

**m2. "First turned on" is imprecise**
- Location: glossary.md:16, model.md:46
- Problem: The colour is copied whenever fill is turned on while the fill colour is unset. That is not always the first time (after undo, or for a tool), and an inherited colour is never copied at all.
- Proposed (glossary): "…separate from its colour; while it has none, turning the fill on sets it to the colour at that moment (RULE-22)."
- Proposed (model): "`unset` until the fill is turned on while unset (RULE-22), then a palette or custom colour".

**m3. "Automatic colours" in the multi-selection marking text is now too broad**
- Location: specs/30-experience/components/CMP-StylePanel.md:42
- Proposed: "automatic text background colours compared as drawn, F-020.R7".

**m4. R2's "marks that swatch" is contradicted by AC22**
- Location: F-020:34
- Problem: For a mixed-colour selection, AC22 marks no swatch.
- Proposed: "…and the fill colour choice marks that swatch (the custom swatch for a custom colour; for a selection, as R7 states)."

**m5. MOD-Core's fill-colour functions don't match D-054, and the copy has no single owner**
- Location: specs/40-technical/modules/MOD-Core.md:32
- Problem: `fillColourOf` says "automatic resolved". That now applies only to text. Also, no pure function is named for "turn fill on, copying the colour when unset". Without one, the tool path and the selection path are likely to implement the copy twice.
- Proposed: "`fillColourOf(kind, style)` (a rectangle's or ellipse's fill colour as stored; a text background colour with automatic resolved), `withFill(style, fill)` (sets fill; from none to solid/translucent with an unset fill colour, copies `color`, RULE-22, used for tools and for each selected annotation)".

## Checked, no finding
- RULE-04 defaults ("fill colour unset, text background colour automatic").
- AC3, AC6 and AC17: concrete and consistent with D-054.
- Scope Out ("unset a fill colour … other than undo").
- Changelog entry present (F-020 is `shipped`).
- No migration needed: nothing persists (INV-04).
- No other feature or module text implies the fill follows the colour.
