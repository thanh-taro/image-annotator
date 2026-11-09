# Review — F-010 Crop the export frame, round 1

Diff: `build/m1...worktree-agent-a0b988aa6fd2b3bf6` (4d92962). Paths are relative to the worktree.
Unit suite: 60 files / 551 tests green, tsc and eslint clean. E2E not re-run.

## Blockers
None.

## Major

**M1. RULE-11 frame-nudge coalescing is new behaviour without a spec. Fix: approve the spec change before merge.** `src/app/crop.ts:48,55`
- RULE-11 coalesces repeated arrow nudges or resizes only for "the same selection". F-010.R5 says "changing the frame is an undo step".
- Today, holding Right for 30 presses becomes one undo step. That is sensible, and the chain breaks correctly (tool change, Tab or selection change, zoom or pan, field commit, a drag commit, undo).
- Accept builder gap 1, but it changes a domain rule. Proposed RULE-11 text: "Repeated arrow-key nudges or resizes of the same selection, **or of the frame with the crop tool**, with no other action in between, are one step."

## Minor

**m1. A selection keeps its handles in the crop view, but they don't respond.** `src/canvas/Canvas.tsx:567,576`
- Scenario: select an arrow, press C, then drag one of its visible handles inside the frame. The frame moves instead, because `crop.down` takes every press.
- The artboard shows no handles, and CMP-Canvas "cropping" lists only frame handles.
- Fix: pass `selection: []` (or an outline only) while cropping. Keep the selection itself, as CMP-Toolbar requires.

**m2. The view is not tested for the non-fitted half of RULE-12.** Missing test.
- The rule is "entering or leaving keeps the zoom level and the frame's place on screen". AC10 covers only the fitted case.
- The behaviour is right: `setContent` keeps `view.x/y`, the image origin, then `clampView`. But nothing tests it.
- Fix: add a unit test on `ViewController.setContent` and/or `Canvas`. At 200 % with a cropped frame, switching to crop and back keeps the zoom and the frame's screen position, except where F-002.R4 clamps it.

**m3. No NFR-02 / ADR-0016 test for frame drags.** Missing test.
- `prepare()` at pointerdown (via `schedule()`, then `drag.prepare` when `crop.active`) and the `cropScene` identity cache look right, but nothing pins them down.
- Fix: follow the existing `rebuilds` / `builds` tests in `tests/unit/render.paint.test.ts`. Assert that a crop drag builds the drag layers once, and that an annotation edit in the crop view doesn't rebuild the image layer.

**m4. No test that a blur patch is recomputed after a frame change.** Missing test.
- `src/effects/client.ts:260-272` keys patches on the frame, which is correct.
- The F-007.AC13 crop test (`tests/e2e/crop.spec.ts` "F-007.AC13 (crop…)") sets the frame *before* drawing the blur, so a stale cache would still pass.
- Fix: draw the blur first, then crop, then export and compare with `referenceBlur`.

**m5. The "announced once" assertion doesn't check "once".** `tests/e2e/crop.spec.ts:117`
- `toContainText` passes with duplicates. The unit test (`tests/unit/app.crop.test.ts:28`) covers it, so this is low risk.
- Fix: assert the exact text, or drop the comment.

**m6. The size chip forces a layout on every drag frame.** `src/canvas/Canvas.tsx:471-475`
- `placeChip` writes `textContent`, then reads `offsetWidth`/`offsetHeight` on every rAF during a frame drag. That is a forced synchronous layout per frame (NFR-02).
- Fix: update the text and measure only when the size string changes; otherwise reuse the cached chip size.

**m7. Spec inconsistency: the status-bar size.** `src/app/crop.ts:75-80`
- MOD-App.md:15 and the artboards show the size only "once a crop or padding exists" (D-017). The builder follows that.
- CMP-StatusBar.md:23 reads as always shown.
- Fix in the spec: add "shown once the canvas differs from the image (a crop or padding, D-017)" to CMP-StatusBar. No code change.

**m8. Spec question: a whole-image frame can't be redrawn from inside.** `src/core/frame.ts:75`
- With the default frame (the whole image), every press inside the image is `move`, which is a no-op. A new frame can only start in the margin outside the image.
- When zoomed in so the image fills the work area, no outside area exists, and the user can only resize from the edges.
- This follows F-010.R1 literally, so it is not a bug. Consider a spec change: "inside a frame that covers the whole image, a drag draws a new frame".

## Builder's spec gaps — rulings
1. **RULE-11 frame coalescing.** Accept and amend RULE-11 (M1).
2. **CMP-Canvas "drawn everywhere".** Accept the implementation:
   - annotations are drawn over the whole image and dimmed with it outside the frame, which shows what will be cut (AC3);
   - parts beyond the image edge are not shown, since the padding is not drawn.
   - Proposed wording: "With the crop tool, annotations are drawn over the whole image and dimmed with it outside the frame; parts beyond the image are not shown."
3. **RULE-12 "frame's place on screen".** Accept. F-002.R4 pan limits always apply, for example when a smaller-than-area image is centred. Proposed wording: "…keeps the zoom level and, within the pan limits (F-002.R4), the frame's place on screen…".

## Uncertain points — rulings
- **Selection handles in the crop view:** remove them (m1). The artboard and CMP-Canvas agree, and as drawn they mislead.
- **The crop panel replaces the selection panel:** correct. Without it, AC9 and R4/R6 can't be reached with a selection present, and CMP-StylePanel's "crop" variant is the tool's panel.
- **Per-grip hover cursors:** fine. They fit "pointer cursor per tool", use only standard cursors, and the "new" grip falls back to the crosshair.

## Checked, no issues
- **Frame maths and clamping:** `dragFrame` (edges, corners, move, new), `clampFrame` and the RULE-13 16 px minimum, including images smaller than 16 px. The reset frame. One step per drag, field or reset; the same frame is no step.
- **Fit while cropping:** the whole image. AC10 refits on enter and leave.
- **Dim and clipping:** the dim is in device pixels over the image rect. Outside the crop tool, the clip to the canvas is unchanged.
- **Export:** it paints the document's frame and padding, never the crop view.
- **Padding step-down:** `setFrame` steps the padding down in the same step. `availablePaddings` / `stepDownPadding` are pure and reusable for F-011.
- **Keys:** arrows and Alt+arrows act on the frame and are kept from the browser. They wait while a drag is in progress, and are the field's own when a field has focus.
- **COPY and tokens:** only through `t()`, values only from tokens. The compact breakpoint (1000 px) matches components.css.
- **StylePanel `NumberField` fix (`src/app/StylePanel.tsx:132-139`):** the draft is replaced only when `value` changes. I found no regression for F-008: blur applies before a selection changes, and a clamped or unchanged result is reset by `apply`.
- **Toolbar e2e tests (End → Crop):** correctly updated.
- **Test hygiene:** no sleeps or timeouts. F-018.AC6 tests both locales. The F-007.AC13 crop half compares against `referenceBlur` over the frame. The padding half remains a named `fixme` for F-011.
