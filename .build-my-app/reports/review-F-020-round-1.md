# Review F-020 round 1: fill colour and text background

Diff: `git diff build/1.2 feature/F-020` (commit bd32792). Spec: F-020 R1–R9 / AC1–AC21, RULE-04/07/08/11/21/22,
F-005, F-019, CMP-StylePanel, CMP-TextEditor.
Checks run in the worktree: `pnpm typecheck` clean, `pnpm test` 790/790 pass, eslint clean on the changed files.
E2E tests were not re-run.

**Counts: 0 blocker, 1 major, 4 minor.**

## Blocker
None.

## Major

### M1. The AC18 e2e test would pass without the editing margin, so the F-020.R8 field padding has no test
- Code: `src/canvas/Canvas.tsx:351-356` (padding = `--tk-space-1` + 0.25 × size × zoom). Test:
  `tests/e2e/fill-background.spec.ts:576-592`.
- Scenario: remove the new padding line. The field still reaches 6 CSS px left of the text box at 100 %
  (4 px `--tk-space-1` padding + 2 px `--tk-border-width-focus` border, `src/app/styles/drawing.css:484-485`).
  The click at image x = 96 (4 px left) still lands in the field's own padding. The browser puts the caret
  at 0 and editing goes on, so AC18 still passes. No unit test covers the field padding either. The main
  new mechanism of R8 (a press anywhere in the margin keeps editing, and the editing outline surrounds the
  box) can regress and nothing would catch it.
- Fix: keep the AC's literal click and add clicks that tell the two apart:
  - one at 7 image px left of the text box, inside the 8 px margin and beyond the old 6 px field;
  - one at 7 px above the first line, where the caret should be on line 1;
  - optionally one at 200 % zoom, where 4 image px = 8 screen px.
  Also assert that the editor's bounding box contains the background box (92…, at 100 %) on every side.

## Minor

### m1. Two of AC11's three e2e checks would pass without the feature (select-tool click, text-tool click)
- `tests/e2e/fill-background.spec.ts:401-418`. Both clicks are 4 px left of the text box, but
  `HIT_TOLERANCE_PX` = 6 (`src/core/shapes.ts:39`), so either click hits a plain text too.
- The marquee check and the outline-pixel check do tell the two apart, and `tests/unit/core.fill.test.ts:94`
  checks hit-testing at tolerance 0. So the logic is covered, but the e2e test does not show R5 end to end.
- Fix: add the same clicks at 7 px left (inside the margin, beyond the tolerance).

### m2. Below the box, a press up to about 13 px outside it still keeps editing
- `src/canvas/Canvas.tsx:368` makes the field 0.2 em taller (ADR-0020). Add `--tk-space-1` and the border
  on every side.
- Scenario: at M (size 32, 100 %) the field reaches about 7 + 4 + 2 = 13 px below the background box, and
  6 px beyond it on the other sides. A press there keeps editing. R8 says "only a press outside the box ends
  editing", and the editing outline is visibly lopsided at the bottom.
- The same slack already exists for plain texts (F-005), so this is low risk.
- Fix: either remove the extra height from the bottom padding when a background is shown (for example
  `padding-bottom: calc(space-1 + margin - extra)`, keeping the scroll guard), or note the field chrome as
  an accepted tolerance in CMP-TextEditor.

### m3. The first "F-020.AC14" e2e test claims more than it checks
- `tests/e2e/fill-background.spec.ts:463`. The title says "two texts' colours mark nothing and Blue is one
  step; mixed fills mark nothing", but the test only checks the rectangle + text case. The other two cases
  are covered by the separate tests at :479 and :505.
- Fix: rename it to its actual check, for example "a rectangle and a text offer neither fill nor background".

### m4. Small needless complexity
- `src/render/index.ts:768`: `contrastPair` now only forwards to `contrastPairing` from MOD-Core. Use
  `contrastPairing` at its call sites and delete the wrapper, or keep it and say why.
- `src/core/text.ts` `textArea(..., placeholder?)`: no caller passes `placeholder` (hit-testing, bounds and
  marquee never need it). Drop the parameter.

## Checked, no finding
- **Checked swatch applies nothing.** `ColourGroup.pick` now returns early when the swatch is already
  checked (`StylePanel.tsx:218`), in every colour group. This matches F-019.R1 / F-020.R2 ("as for any
  checked swatch").
  - F-019.AC14 is not affected: its arrow-onto-custom and click-custom paths go through
    `chooseCustomSwatch` / `beginCustomPick`, not `pick`.
  - A mixed multi-selection has `checked = null`, so picking still applies.
  - One behaviour change: clicking the already-marked palette colour on a selection no longer resets the
    shared current colour. That is consistent with "applies nothing".
- **Picker chain with two colour groups on screen.** `customPickOpen(target)` scopes each group's focusin
  watcher. Without that, the fill group would end the colour group's chain as soon as the colour picker
  opened. Focus moving from one group's picker to the other group's swatch ends the first chain. A cancel
  restores the styles and the remembered colour. Fill colour changes coalesce through `setStyle(...,
  coalesceKey)`.
- **Automatic semantics.** Panel models compare colours as drawn (`fillColourOf`), so an automatic fill on
  a custom colour marks the custom swatch. A picked colour is kept through none → solid. Fill and fill
  colour are per tool via `withToolStyle`. Both picked colour kinds feed one remembered custom colour.
- **Background box as the text's area.** It is used for hit-testing (`hitsText` → `textArea`), bounds and
  the selection outline (`boundsOf`, `render/index.ts:618`), the marquee (`boxesMeet(boundsOf)`), reveal
  and the export (`drawText`). The anchor is unchanged. The editor's content box stays at the anchor at
  every zoom, because left/top subtract the computed padding.
- **Placeholder box.** It is screen-only, matches the field width (same font, `ta.placeholder`), and is
  never exported.
- **contrastPairing move to MOD-Core.** It respects module boundaries; the app imports it from `../core`.
