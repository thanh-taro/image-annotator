# Code review — F-020 D-054 (fill colour separate from the colour)

Diff: `git diff e013e42 feature/F-020-D-054` (b78b051). Spec: F-020 R1–R9, AC1–AC24 (D-054 edits fc08b8c, e013e42, ddb91be), RULE-04, RULE-22, ENT-Style, MOD-Core `withFill`.
Verified: unit suite in the worktree passes (76 files, 788 tests); `tsc --noEmit` is clean.

**Verdict: can merge.** 0 blockers, 0 majors, 2 minors.

## What was checked and holds
- **R2 / RULE-22.** `withFill` (src/core/custom.ts:87) copies `color` only when the fill goes from none to on while `unset`; a kept fill colour stays (AC20, AC23, AC24). `fillColourOf` returns the fill colour as stored for shapes, so changing the colour never moves the fill (AC3, AC17).
- **Selection, one undo step.** `withCopiedFill` (src/app/drawing.ts:252) adds the copied `fillColor` to each annotation's own patch. Patches that differ go into separate groups of one `history.apply`, so it is one step (RULE-11), and undo restores `fill: none, fillColor: unset` (AC22, second half).
- **R6, tool gets the shared colour.** The tool update in `setStyle` passes the original patch (without the copied colours) to `withToolStyle`. `withToolStyle` (src/core/tools.ts:150) copies `colours[colourGroup(tool)]`, so a copied annotation colour never becomes the tool's fill colour (AC22, first half). AC6 is per tool.
- **New shapes inherit the tool's fill colour, unset included.** Defaults are `unset` for every tool except text (`automatic`), and a new shape takes its tool's style (AC24 unit test).
- **'automatic' never on a rectangle or ellipse, 'unset' never on a text.** The only sources are the tool defaults and `setStyle({fillColor: StyleColour})`, and no path writes `unset` or `automatic`. `withFill` never copies into `automatic`. No styles are persisted (no localStorage or sessionStorage), so old `automatic` shape values can't come back.
- **Consumers.**
  - Render (src/render/index.ts:444) fills in the stored colour.
  - Hit-testing (core/shapes.ts:393, 727) depends only on `fill`.
  - Duplicate and export copy the style or reuse the renderer.
  - Panel `fillChoices` compares stored colours. A mixed blue/green selection marks none; any fill none hides the group (R7, AC22).
  - Custom swatch: a copied hex fill colour marks the custom swatch, and it is not "remembered" because `remember(patch.fillColor)` sees only the user's patch, as RULE-21 requires ("last picked").
  - The picker chain is unchanged and gets valid fill colours through `fillColourOf`.
- **Edited tests outside F-020.**
  - F-008.AC7 (tests/e2e/edit.spec.ts:221): picking Blue for both the colour and the fill colour keeps the two fills distinct, so the pixel at (250, 250) still proves the drawing order.
  - F-009.AC3 (tests/e2e/undo.spec.ts:130–142) now samples the outlines (left edges), which carry the colour, after the recolour and after the undo, and still checks that both are selected again. It still tests what the AC says.
  - The render.paint F-003.AC5 fixture (`withFill(style, fill)`) builds a valid filled shape. The test checks alpha and order, as before.
- **AC test coverage.** AC1, AC3, AC6, AC17 and AC22–AC24 each have unit and e2e tests that assert the D-054 behaviour.

## Findings

### MINOR-1 — Three unit fixtures build an impossible state that the renderer silently hides
- **Where:** tests/unit/canvas.select.test.ts:11, tests/unit/core.edit.test.ts:245 and tests/unit/core.shapes.test.ts:94 build `{ ...DEFAULT_STYLES.rectangle, fill: 'solid' | 'translucent' }`, which is a filled shape with `fillColor: 'unset'`. RULE-22 says "a rectangle, ellipse or tool whose fill is solid or translucent always has a fill colour".
- **Problem:** src/render/index.ts:445 (`&& fillColour`) silently draws no fill for that state. The three tests only cover hit-testing, so they pass, but the fixtures model a state the app can't produce. If a future code path produces it, the user just sees a missing fill, with no test failing.
- **Fix:** build these fixtures with `withFill(DEFAULT_STYLES.rectangle, 'solid')`, as render.paint.test.ts now does. Optionally, also add a unit test showing that every route that sets fill on (tool, selection) gives a non-`unset` fill colour. The `FillColour` type does not enforce the per-kind split, and that is acceptable.

### MINOR-2 — R2's custom-colour case has no test
- **Where:** tests/unit/app.fill.test.ts and tests/unit/core.fill.test.ts.
- **Problem:** R2 says that when the fill is turned on while the colour is a custom colour, the fill colour choice marks the custom swatch. core.fill.test.ts:52 checks that `withFill` copies the hex. No test checks that the panel's custom swatch is then `{ colour: hex, checked: true }`. No test checks that the copy leaves the remembered custom colour (RULE-21) alone. Neither is an AC, but R2 states the first one explicitly.
- **Fix:** add one unit test to app.fill.test.ts. Pick a custom colour for the rectangle tool, set fill solid, and assert `customSwatch(model(), 'fill')` is checked with that hex. Then pick a different custom colour elsewhere and assert the copied fill colour did not change the remembered one.

## Simplicity
- The copy logic is in one place, `withFill`, used by both the tool path (`withToolStyle`) and the selection path (`withCopiedFill`). That is the smallest design that keeps "the tool gets the shared colour; each annotation its own".
- The `fillColourOf` overload (text → `StyleColour`) is justified by the text background render site.
- No needless complexity found.
