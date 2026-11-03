# Review F-006 (Add numbered steps), round 1

Commit 9a4ef27 on `worktree-agent-a7cc7ea818a908be2`, diffed against `build/m1`. Checked against F-006, RULE-04, RULE-07 (including the spec commit 6e4ed65 on pill width and a press that moves), RULE-11, RULE-19, ADR-0009, NFR-08, MOD-Document, MOD-Render and MOD-Canvas. The badge outline is an open owner decision and is not reviewed here.

**Verdict: approve once finding 1 is fixed.** There are no blockers. Numbering, renumbering, undo, duplicates, reorder, contrast pairing, the size-M diameter, Enter at the centre, and a press that moves placing one step at the press point all match the spec, and each has a test.

## Major

### 1. The pill width uses the widest digit for every digit, not the digits' real width
- `src/core/steps.ts:80`: `Math.ceil(label.length * STEP_DIGIT_ADVANCE_EM * text + text)`. The comment at line 7 says the digits are "at most 0.642 em wide", so Manrope's digits differ in width. A number such as "111" or "101" therefore gets a pill wider than "its digits plus one text size" (RULE-07, settled in 6e4ed65). The extra space is about 3 × (0.642 − narrowest advance) × text.
- The rounding is also wrong. `Math.ceil` breaks the rules.md convention that sizes round to the nearest whole pixel, with halves rounding up.
- The test at `tests/unit/core.steps.test.ts:80` only checks that the pill is "wider than the circle", so the rule's formula is never checked.
- **Fix:**
  - Put a table of the ten Manrope 600 digit advances in MOD-Core, measured once the same way as the height constant, and sum them over the label.
  - Round with `Math.round`.
  - Add unit tests that check the exact width for "100", "111" and "888", and the floor of "never narrower than the circle".
  - Add one render or e2e check that compares the result with `measureText(label).width + text` within 1 px.

## Minor

### 2. The font gate can wait forever with no timeout and no feedback
- `src/canvas/fonts.ts:348`: `fonts.ready.then(() => fonts.load(FACE, DIGITS))`.
- The cases that work:
  - **Fonts already loaded:** this resolves on the next microtask.
  - **Load fails:** the gate opens and the canvas draws in the fallback face. The test at `canvas.steps.test.ts:87` covers this.
  - **Canvas mounted before `loadFonts()` runs:** this is handled, because `fonts.load` waits by itself.
- Once open, the gate never closes again, so it cannot leave a tool stuck after it has opened.
- **Failing scenario:** the gate stays closed for as long as the latin woff2 request hangs. This can happen on a stalled first visit or with a stalled service-worker fetch, and a browser can take minutes to time the request out. The UI is usable because of `font-display: swap`, and the user can paste an image. But every press and every Enter is dropped silently. `keys.ts` has already called `preventDefault`, and `placeAtCentre` returns false with no announcement.
- **Fix:** propose a spec change to ADR-0009 §4: a bounded wait (for example `Promise.race` with about 3 s), after which the canvas opens in the fallback face. The export check in F-012 still guards fidelity. If the owner prefers to keep waiting, the canvas should at least show a busy cursor while the gate is closed.

### 3. The real gate wiring in Canvas.tsx has no test
- `tests/unit/canvas.steps.test.ts:71` rebuilds `setup()` with its own `() => gate.ready`. The checks in `Canvas.tsx` (the `!fonts.ready` in the draw setup and in `placeAtCentre`, and `onReady(schedule)`) are only exercised indirectly by the e2e tests, which run after the fonts have settled.
- **Fix:** add a Canvas-level unit test with a stubbed `document.fonts` whose `ready` stays pending. Check that a press and `placeAtCentre()` create nothing, then resolve it and check that both work and a repaint is scheduled.

### 4. Testing AC2 and AC7 at model level only is acceptable for now, but the gap is hidden
- The keys and the panel do not exist yet, so model tests through `remove`, `duplicate` and `History` are the right level today.
- But `spec_lint --coverage` counts `F-006.AC2` and `F-006.AC7` as covered by the unit tests. Nothing makes F-008 add the end-to-end versions.
- **Fix:** add `test.fixme('F-006.AC2 … (wired by F-008)')` and `test.fixme('F-006.AC7 …')` in `tests/e2e/steps.spec.ts`, or add an item in the build plan's F-008 section. F-008 can then turn them on.

### 5. Spec gap: copies of several steps are numbered in drawing order
- `src/document/index.ts:672` loops over `doc.annotations`, so after a reorder, duplicating steps 3 and 1 can give copies 4 (copy of 3) and 5 (copy of 1). RULE-07 does not say which order to use. Creation order (sorting by number) would match how the rule defines numbering.
- **Fix:** propose a one-line clarification to RULE-07 and follow it. If the decision is creation order, sort the copies by `number` before giving them numbers.

### 6. `shapeBox`'s optional `shortSide` is a trap
- `src/core/shapes.ts:232` throws for a step when `shortSide` is left out. Callers such as `render/index.ts:147` and `shapes.ts:445` leave it out, and they are only safe because of the checks in front of them.
- **Fix:** make `shortSide` required. Alternatively, keep steps out of `shapeBox` and have `paintSelection` call `boundsOf`, which already takes `shortSide`.

### 7. `stepName` is written before the feature that uses it
- `src/app/drawing.ts:88` has no caller in `src/`. It belongs to F-013's annotations list.
- **Fix:** either move it to F-013, or keep it and note in the build plan that F-013 must use it instead of writing another.

## Checked and fine
- **Numbering:** `nextStepNumber` gives max + 1. `renumberSteps` sorts by number, breaking ties by index, and returns the same array when nothing changes. Reorder never renumbers, and a test covers this. Undo restores the snapshot (ADR-0008).
- **Delete:** deleting nothing that exists records no step.
- **Size:** on a 1000 × 800 image a size M badge is 64 px across.
- **Contrast pairing:** matches RULE-07, the test checks every pairing reaches 4.5:1, and AC4 is tested end to end.
- **Digits:**
  - They are centred from the font's metrics, not `textBaseline: middle`, as ADR-0009 requires.
  - They are drawn in image pixels with the view transform, so they draw the same at every zoom and in the export (the single `paint()`).
  - An e2e test proves the face is Manrope, not a fallback.
- **Steps and drag layers:** steps skip the drag layers (`dragging` and `onPrepare`).
- **Module boundaries:**
  - MOD-Document imports only MOD-Core.
  - MOD-Render uses only `stepBadge` from Core.
  - MOD-Canvas waits for the fonts and does not request them (MOD-Host loads them at startup). The faces are variable fonts covering weights 200–800, so weight 600 adds no request (NFR-01).
