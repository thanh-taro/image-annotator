# Review — F-003 Draw shapes — round 1

Branch `worktree-agent-a8f49106dd784a94c`, commit 78fc451, diff `build/m1...HEAD`.
Checks run: `vitest` 199/199 pass and `tsc --noEmit` is clean. Playwright was not re-run; the e2e findings below come from reading the assertions.
Specs: F-003, RULE-04/05/06/11/19, CMP-Toolbar, CMP-StylePanel, CMP-Canvas, ADR-0004/0008/0016/0022, MOD-Canvas/Render/Document/Core, and the `build/m1` spec commit 1af3bc0 (Esc closes the sheet after cancelling a drag; coarse swatches in 2 rows of 4; Enter is kept from the browser with every tool).

**Verdict: changes requested (0 blockers, 6 major, 5 minor).**

These parts are sound:
- The core geometry: RULE-05 uses a 4 px threshold in CSS px (`<4` counts as a click). The default is 20 % of `s`, centred, and lines point right.
- RULE-06 keeps boxes square with side = the longer side, and snaps lines to 45° steps while keeping the length.
- The arrowhead is 4× long and 3× wide, and the shaft ends at the base.
- RULE-04 sizes are rounded, and the translucent fill is 0.3 under an opaque outline.
- `paint()` is one function. Annotation drawing has no screen-only branch, and the overlays and layer are optional.
- The ADR-0022 lower layer is built once per drag and rebuilt when the image layer changes.
- Creating an annotation is one history step that selects it. Ids are never reused. Module boundaries are respected.
- The Esc chain order matches the updated spec.

## Major

### M1 — Enter with the select (or crop) tool is not kept from the browser (RULE-19)
- **Where:** `src/keys/index.ts:133`. It returns `NONE` (`preventDefault: false`) when `NOT_DRAWING.has(scope.tool)`.
- **Scenario:** the canvas has focus, the select tool is active, and the user presses Enter. The key reaches the browser and the host page. RULE-19 keeps every in-scope key from the browser "even when it has nothing to act on". The builder's proposal to exempt this key was rejected in 1af3bc0.
- **Fix:** return `{ preventDefault: true }` with no action for select and crop. F-005 later adds "edit the selected text". In `tests/unit/keys.tools.test.ts:54`, assert `resolveKey(...)` equals `{ preventDefault: true }` rather than only checking that there is no action.

### M2 — A drag maps the pointer through the view as it was at pointer-down
- **Where:** `src/canvas/Canvas.tsx:141-147`. `const v = view.view` is captured once in the `DrawSetup`, and `toImage: (p) => toImage(v, p)` is stored in the gesture (`draw.ts:87`).
- **Scenario:** the user starts dragging an arrow, then scrolls the wheel (F-002 pan by scroll) or presses Mod+= mid-drag. The same happens when the narrow sheet's inset changes the view. The view moves, and ADR-0022 rebuilds the layers for exactly this case. But the end point is still converted with the old transform, so the preview and the created arrow land away from the cursor. With a pan of 200 px at 100 %, the head is off by 200 image px.
- **Fix:** read the view on every call: `toImage: (p) => { const cur = view.view; return cur ? toImage(cur, p) : p; }`. Keep `from` as already converted at pointer-down. Add a unit test: start at view A, switch the view to B, move, and expect the end point mapped through B.

### M3 — `pointercancel` commits the shape
- **Where:** `src/canvas/Canvas.tsx:300` routes `pointercancel` to `onPointerEnd` → `InputController.up` → `DrawTool.up`. That calls `move()` and `onCreate`. A cancel before the 4 px threshold even places a 160 px default shape.
- **Scenario:** on touch or pen, the OS or browser cancels the pointer (system edge gesture, palm rejection, lost capture). A rectangle or default shape is created at the cancel point and recorded as an undo step, although the user never released the pointer.
- **Fix:** give `InputController` a `cancel(input)` method. For the tool pointer it calls `tool.cancel()` and clears `toolPointer`; otherwise it does what `up` does today for pinch and pan. Wire `pointercancel` to it. Add a unit test: down, move, cancel → nothing created.

### M4 — No test would fail if ellipses were drawn as rectangles (F-003.AC2)
- **Where:** `tests/e2e/draw-shapes.spec.ts:108-122` and `tests/unit/render.paint.test.ts`, which has no ellipse case.
- **Scenario:** the 4 sampled outline points are the box's edge midpoints, which are red for a rectangle too. The centre and (115, 115) lie inside an unfilled rectangle, so they are grey for a rectangle too. Replacing `ctx.ellipse` with `ctx.rect` keeps every test green. `canvas.draw.test.ts` only checks the model kind.
- **Fix:** in e2e, assert a box corner such as (100, 100) or (110, 100) is grey, and a point on the ellipse at 45°, ≈ (441, 271), is red. In the unit test, assert `ellipse(300,150,100,50,0,0,6.28)` is called.

### M5 — No test checks "centre of the view" (F-003.AC8)
- **Where:** `tests/e2e/draw-shapes.spec.ts:205-226`. Nothing tests `ViewController.centreImage` either.
- **Scenario:** the image fills the view exactly, so the view centre equals the image centre (500, 400). A bug that placed at the image centre, or ignored the bottom inset, would pass.
- **Fix:** pan first, for example with Arrow keys (−40 px) or a zoom to 200 % and a pan. Then press Enter and assert the arrow's centre pixel sits at the view's centre. Add a unit test for `centreImage()` with a bottom inset (D-019).

### M6 — The tool group exposes toggle buttons, not a single choice (CMP-Toolbar "Accessibility", NFR-06)
- **Where:** `src/app/Toolbar.tsx:100-120` (`aria-pressed` on each tool).
- **Scenario:** a screen reader announces "Rectangle (R), toggle button, pressed". Activating the pressed tool does not unpress it, and nothing conveys that exactly one tool is on. The spec asks for a single-choice group. Every later tool inherits this pattern.
- **Fix:** wrap the strip in `role="radiogroup"` and give each tool `role="radio"` with `aria-checked`. Keep the roving tabindex and arrow keys; arrows may also check the tool, per the APG radio pattern. The radiogroup needs a name, but COPY has none for the tool group, so propose a spec addition, e.g. `COPY-a11y.tools` "Tools", or reference the toolbar's own label via `aria-labelledby`. Update the e2e test to select by role `radio` and assert `aria-checked`, and update the `[aria-pressed="true"]` scroll query and the forced-colours CSS (`drawing.css:361`).

## Minor

### m1 — Pressing or releasing Shift mid-drag does nothing until the pointer moves (RULE-06 "while Shift is held")
- **Where:** `src/canvas/draw.ts:94-101`. The constraint is read only from pointer events.
- **Scenario:** the user drags an ellipse, holds still, and presses Shift. The preview stays an ellipse. If the user then releases the pointer without moving, `up` uses `input.shift` and a circle appears, which the preview never showed.
- **Fix:** keep the last pointer point in the gesture. Add `DrawTool.setShift(held)`, which re-runs the preview, and call it from the canvas keydown/keyup for Shift.

### m2 — The Esc order "cancel the drag before closing the sheet" is untested
- **Where:** `tests/unit/app.drawing.test.ts:139-153`.
- **Scenario:** this is the order resolved in 1af3bc0. With no canvas mounted, `cancelDrag()` always returns false, so swapping the two branches of `escape()` passes every test.
- **Fix:** stub `canvasCommands.cancelDrag` to return true once. Assert that the first Esc leaves `sheetOpen` true and the second closes it. The e2e Esc-during-drag test could also open the narrow sheet first.

### m3 — The compact toolbar variant is not built
- **Where:** `src/app/Toolbar.tsx:157`.
- **Scenario:** at 800–999 px, CMP-Toolbar "compact" shows COPY-action.open as an icon named by its label. The code switches to the icon only in narrow. Now that the tool group shares the row, compact is the first width where this matters.
- **Fix:** `<OpenButton icon={layout.value !== 'wide'} />`, plus a screenshot at about 900 px.

### m4 — Hit-testing, `moved`, `resized` and `hitHandle` ship before F-008
- **Where:** `src/core/shapes.ts:165-340`. Only `handlesOf` and `shapeBox` are used today.
- **Scenario:** about 150 lines of untriggered code and tests are tied to signatures F-008 has not designed. The `hitTest(a, p, tol, shortSide)` signature already differs from MOD-Core's public surface `hitTest(annotation, point, tolerance)`.
- **Fix:** either move them in with F-008, or keep them and amend the MOD-Core public surface to the `shortSide` signatures (also `boundsOf`, `defaultAnnotationAt`). Do not leave the spec and code out of step.

### m5 — No test checks that the drag frame and the settled frame paint the same pixels
- **Where:** `src/canvas/Canvas.tsx:175-196` takes the drag path, `paintAnnotations` over the cached lower layer. The settled frame uses `paint` with the layer.
- **Scenario:** ADR-0022 requires the drag frame to match. A future change to `paint` alone, such as a per-annotation patch lookup in F-007, would make shapes jump on release.
- **Fix:** add a unit test that records a drag frame with the preview equal to the final annotation and a settled `paint` frame with no selection, then compares the annotation draw calls.

## Extensibility (no change needed now)
The `ToolInput` interface, the annotation union, `TOOL_KIND`/`DEFAULT_STYLES` for all nine tools, `restyle` and the `middle` scene of `DragFrame` will take pen, highlight, text, step and redaction without reworking the model. Two seams need care in F-004 and F-008:
1. `InputController` takes one `tool` (`DrawTool`). Add a small router that picks the `ToolInput` by the active tool instead of adding branches to `DrawTool`.
2. `Canvas.paint` hard-codes `lo = n, hi = n − 1` for a preview. Move and resize need the controller to report `lo`, `hi` and the middle annotations, so expose them from the active `ToolInput` rather than checking `draw.preview`.

---

# Round 2

The fix is commit 66adac4, rebased onto `build/m1`, which includes 8f48ff8 (radio semantics, COPY-a11y.tool_group).
Checks run: `vitest` 206/206 pass, and Playwright `draw-shapes.spec.ts` passes 42/42 on Chromium and WebKit.
I also ran a throwaway probe unit test, since deleted, on touch `pointercancel`. It fails; see N1.

**Verdict: changes requested (1 new major). M1–M6 and m1–m5 are fixed.**

## Round 1 findings
| ID | Status | Notes |
|---|---|---|
| M1 | Fixed | Enter with select or crop returns `KEEP`; the unit test asserts `{ preventDefault: true }`. |
| M2 | Fixed | `toImage` reads `view.view` on every call. `DrawTool.viewChanged()` is called from the view callback, re-maps the last pointer point and keeps `from`. Covered by a unit test and an e2e test (wheel mid-drag at 200 %). |
| M3 | Fixed for mouse and pen | `pointercancel` → `InputController.cancel` → `tool.cancel()` + `tool.up()`, so nothing is created, before or after the threshold. Touch is broken: see N1. |
| M4 | Fixed | The render test asserts the `ellipse(...)` call and no `rect`. The e2e test samples corner-adjacent points as grey and the 45° point (441, 129) as red. Both would fail for a rectangle. |
| M5 | Fixed | The e2e test zooms to 200 % and pans before pressing Enter, then checks the arrow at the view centre and nothing at the image centre. A unit test covers `centreImage()` with a pan and a bottom inset. |
| M6 | Fixed | `role="radiogroup"` is named COPY-a11y.tool_group, and the tools are `role="radio"` with `aria-checked`, a roving tabindex and arrow keys that check. Home and End also check. On narrow widths, Enter or Space on the checked tool still toggles the sheet (D-019). CSS selectors are updated, and axe is clean in both themes. |
| m1 | Fixed | `setShift` is driven by window keydown and keyup; it runs only during a gesture and ignores repeats. |
| m2 | Fixed | A unit test checks that the first Esc only cancels the drag and the next one closes the sheet. |
| m3 | Fixed | Open shows as an icon in compact; screenshots at 900 px were added. |
| m4 | Settled in the spec | MOD-Core now lists `shortSide` and from/to (uncommitted in the main checkout; commit it with this merge). |
| m5 | Fixed | A unit test checks that the drag frame and the settled frame make the same draw calls for the shape. |

## New

### N1 (major) — A touch `pointercancel` during a drawing leaves a ghost touch, so later one-finger drags pinch instead of drawing
- **Where:** `src/canvas/input.ts:134-141`. `cancel()` returns early for the tool pointer and never runs `this.touches.delete(input.id)`. For a touch, `down()` added the pointer to `touches` before handing it to the tool.
- **Scenario:** on a touch device, the user starts drawing with one finger, and the OS cancels the pointer (edge swipe, palm rejection). The id stays in `touches`. The next finger makes `touches.size === 2`, so it starts a pinch with the stale point: the view zooms or pans and nothing is drawn. Every later one-finger drag does the same, because the ghost is never removed, until the page reloads. Probe: touch down, move, cancel, then a second touch down, move, up → 0 annotations created (expected 1).
- **Fix:** in `cancel()`, remove the touch first: `if (this.touches.delete(input.id)) this.view.endPinch();`, then cancel the tool gesture. Alternatively, cancel the tool and then fall through to `up()`'s touch and pan bookkeeping without calling `tool.up`. Add the probe as a unit test with `type: 'touch'`; the current pointercancel test only uses `pen`.
