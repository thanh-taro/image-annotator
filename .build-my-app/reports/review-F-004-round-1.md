# Review — F-004 Draw strokes and highlights, round 1

Branch `worktree-agent-a512e187f04a0654f` @ 77867f9, against `build/m1` (a6be6c6, which already has the RULE-09 / MOD-Core spec commit).
Checks run: unit tests 244/244, `draw-strokes.spec.ts` 14/14 (Chromium + WebKit), typecheck, lint, spec_lint 0 errors. The worktree was restored after the mutation runs.

**Verdict: changes requested.** One major (NFR-02, shared with F-003). The rest are minor. The rendering, the RULE-09 behaviour and the tests are good.

## What is correct
- **Rendering** (`src/render/index.ts` `drawPath`): a pen is one path of midpoint quadratics with round caps and joins. A highlight is the same path, 3 × wider, with square caps, `beginPath` once, stroked once at `globalAlpha = 0.4`, then the alpha is set back to 1. So it never darkens itself (RULE-09, platform-mapping). A pen dot is a circle whose diameter is the stroke size. A highlight dot is a square as wide as the highlight.
- **One `paint()`:** strokes go through `drawAnnotation` → `paintAnnotations`, which the screen, the drag layers and the export all use. There is no screen-only difference.
- **Shift:** `constrain(…, 'highlight')` gives `{x: to.x, y: from.y}` or the vertical version, from the press point. Shift has no effect on the pen. Pressing or releasing Shift mid-drag updates the preview at once.
- **Samples:** coalesced samples are kept in order, including those before the 4 px threshold. Only exact repeats are dropped (MOD-Core outcome). A view change adds the point now under the pointer.
- **Second finger:** `InputController.down` cancels the tool gesture and pinches instead; a unit test covers it.
- **Bounds:** the hull of the points, grown by half the width (pen) or half the width × √2 (square highlight ends). Hit-testing flattens each quadratic to a 0.01 px chord error.
- **Module boundaries:** MOD-Render imports MOD-Core only. MOD-Canvas holds the transient state. No ADR is violated.
- **Test quality, spot-checked:**
  - I stroked the highlight piece by piece. Unit test AC3 failed, and e2e AC3 failed on both engines.
  - I drew the pen with `lineTo` through the samples. Unit test AC1 failed, and e2e AC1 failed ("no corner at the sample" / "on the rounded turn").
  - The builder's claim holds.
- **320 px fixes:** `grid-template-columns: minmax(0, 1fr)` stops the narrow tool row from widening the page. `[data-disabled]` sets `overflow-x: hidden`, so the empty state has no scroll region without focusable content (axe `scrollable-region-focusable`). Both are sound.

## Findings

### 1. MAJOR — NFR-02: the first drag frame builds the drag layers (22–29 ms Chromium, 63–65 ms WebKit)
`src/canvas/Canvas.tsx:202-216`, `src/canvas/drag.ts:113-126`.
- **Problem:** `DragLayers.paint` builds the lower layer lazily, in the first frame that has a `preview`. That frame comes only after the 4 px threshold, so it is the first frame of the visible stroke.
- **Scenario:** on the reference workload (14.7 MP, 100 annotations), every stroke, shape and highlight drops 1–2 frames on Chromium and about 4 on WebKit at its start.
- **Why this fails NFR-02:** NFR-02 says the canvas "updates every frame at 60 fps while drawing". The measured result fails it, and QA's interaction traces will catch it. The lag also lands exactly where users notice it most: the mark appears late, then jumps to catch up. No samples are lost.
- **Fix (also fixes F-003):** build the layers at pointerdown, before the threshold.
  1. When `DrawTool.down` accepts a gesture, it calls a new `onPrepare` callback.
  2. Canvas schedules a frame that calls a new `DragLayers.prepare(frame)`. It builds only, with the same `Key` (lo = n, hi = n − 1, the current base and scene), and draws nothing new.
  3. The first preview frame then finds the key fresh and only copies the layer and draws the path.
  4. If the gesture ends as a click or is cancelled, `release()` as now.
- **Acceptance:** extend the ADR-0022 unit test so that `builds === 1` after `down`, before any move. Add an e2e or trace check that the first preview frame does not rebuild (expose `builds`, or time it).
- **Rejected alternatives:**
  - Idle-time prebuilding keeps about 41 MB alive whenever a drawing tool is idle. That eats WebKit's NFR-04 headroom (931 MB worst case, ADR-0022).
  - Skipping the split when the stack is small does not help the 100-annotation reference case.
- **Remaining risk:** a flick that crosses 4 px inside the pointerdown frame still pays for the build once. That is acceptable, since nothing was visible yet. QA should note it.

### 2. minor — a Shift highlight that returns to the press point is an invisible zero-length run
`src/core/shapes.ts` `pathFromDrag`.
- **Scenario:** press, drag 20 px, return exactly to the press point with Shift held, release. `constrain` returns the press point, so the result is `points: [p, p]`. That is two points, so `drawPath` strokes a zero-length subpath. The HTML canvas spec prunes zero-length segments, so nothing may be painted on some engines. An invisible annotation is created and selected.
- **Fix:** in `pathFromDrag`, when the constrained end equals `first`, return `[first]`. That is a dot, which is what RULE-09 defines.

### 3. minor — hit-testing ignores the square corners of highlight ends and dots
`src/core/shapes.ts:366-371`.
- **Problem:** `distanceToQuad ≤ tolerance + width/2` gives round ends. The painted ends are square, so the outer corners of each end don't count as hits.
- **Scenario:** an L highlight on a 3024 px short side is 108 px wide. A press near a corner of its end, or of a highlight dot, misses by up to about 22 image px (less the tolerance). F-008 will use this for select and Alt+drag.
- **Fix:** for highlights, also test the two end caps as squares. Each is an oriented square of side `width` centred on the end point and aligned with the end tangent. For a dot, test the axis-aligned square.

### 4. minor — selecting a straight highlight shows a zero-height box with stacked handles (for F-008)
`src/render/index.ts` `paintSelection`, `src/core/shapes.ts` `handlesOf`. See screenshot `1440-*-3-highlight-selected.png`.
- **Problem:** the outline sits on the box of the points. For a Shift or straight highlight that box is a line through the middle of the band, with nw/n/ne on top of sw/s/se.
- **Status:** this matches F-008.R8 and AC15 (points box), so it is not a defect in F-004. F-008 must still decide how to scale H from 0, and which handle a press picks when handles overlap.
- **Fix:** log it as an F-008 open question now. No code change in F-004.

### 5. minor — needless duplication and dead code
- `src/core/shapes.ts:44-45` `markWidth` recomputes `HIGHLIGHT_PER_STROKE * stroke`, which `styleSizes(shortSide, size).highlight` already returns (`src/core/sizes.ts:58`). Use `const s = styleSizes(shortSide, a.style.strokeSize); return a.kind === 'highlight' ? s.highlight : s.stroke;`.
- `shapeKindOf` (`src/canvas/draw.ts`, still exported from `src/canvas/index.ts:17`) is now used only by its own test. Remove it, and move its test to `drawKindOf`.

### 6. minor — `getBoundingClientRect` once per coalesced sample
`src/canvas/Canvas.tsx:272-274`.
- **Problem:** `coalesced.map(local)` calls `getBoundingClientRect()` once per sample. With a 240 Hz pen that is 4 or more layout reads per event.
- **Fix:** read the rect once per event and map all the samples with it.

### 7. minor — no test for the 320 px fix with an image loaded, or for the coalesced wiring
- **320 px:** the overflow fix is covered only by the empty state (`privacy.spec.ts`). Add one e2e at 320 px with an image loaded. It should assert no page horizontal scroll, and that the tool strip scrolls (`scrollWidth > clientWidth`) and reaches the Highlight tool by keyboard.
- **Coalesced events:** `Canvas.tsx`'s `getCoalescedEvents` wiring is not exercised; the unit tests feed `samples` straight in. A small unit test could stub a `PointerEvent` with `getCoalescedEvents`, or an e2e could dispatch a synthetic `pointermove` whose coalesced list has several points.
