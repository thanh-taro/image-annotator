# Review F-007 (Redact), round 1

Diff: `build/m1...worktree-agent-ad774efa417fb260e` (467f180). Paths below are relative to the worktree.
Verified: `pnpm check` green (9/9). `tests/e2e/redact.spec.ts` ran 3 times on Chromium and WebKit: 72 passed, 36 fixme skipped. `spec_lint --coverage` lists no F-007 AC.

Sound and matching the ADRs:
- The ADR-0006 definitions are exact. Property tests compare `algorithms.ts` with `reference.ts`.
- Patch compositing follows ADR-0006: the box is replaced by the background, O is drawn source-over, then solids are re-stamped. Where the box lies outside the frame it shows the background.
- Only frame pixels are read in the worker.
- The ADR-0017 idle and no-job-while-moving rule holds, and so does the fresh worker per image (ADR-0022).
- The not-secure tag and note are in place, using COPY IDs and tokens only.
- AC2's panel rules are met, and there are no regressions in older tests.

## Blocker
None.

## Major

**M1. One worker error stops every later exact patch, and `exactPatches` never resolves.**
- Where: `src/effects/worker.ts:19-40` (no try/catch), `src/effects/client.ts:152` (no `error` listener) and `client.ts:327-354` (`failed` notifies nobody).
- Scenario: a job throws in the worker, e.g. a `RangeError` while `Scratch` allocates the window for a near-full-frame blur on a 4096² image under WebKit memory pressure (ADR-0022 notes WebKit has the least headroom). No reply comes back, so `inflight` stays set and `pump()` never sends again. Every blur and pixelate stays approximated for the rest of the session, and `exactPatches` (the F-012 export) waits forever. A `failed` reply has the same effect on waiters, and the next paint asks for the job again, in a loop.
- Fix:
  - Wrap the job in the worker in try/catch and reply `failed`.
  - In the client, listen for `error`/`messageerror` and treat the in-flight job as failed.
  - On `failed`, wake the waiters and make `exactPatches` reject, so F-012.R7 can show COPY-error.export_failed.
  - Don't re-request a failed key until its spec changes.
  - Add a unit test.

**M2. The pixelate preview while dragging does not show p × p blocks aligned to the box (AC4 "16 × 16 … updating while dragging").**
- Where: `src/effects/index.ts:38-49` and `src/render/index.ts:260`.
- Scenario: pixelate M on 1000 × 800 with a box 150 px wide. The small canvas is ceil(150/16) = 10 px, stretched back to 150, so the blocks are 15 px wide. When B starts left of or above the frame, the blocks are aligned to O, not to (x0, y0). The e2e test hides this because its boxes are exact multiples of 16 (160×96, 320×192), aligned at (96, 64).
- Gap (f) rejected: fix the code rather than the spec.
  - Draw the small canvas back at `width·p × height·p` from the B-aligned block origin, clipped to B (the clip already exists).
  - Fill the small canvas fully: first a stretched draw as an underlay, then source O into `(0, 0, O.w/p, O.h/p)` on top. The edge cell stays opaque.
  - Add an e2e case with a box that is not a multiple of 16.

## Minor

**m1. Duplicate jobs and leaked bitmaps between a reply and its bitmap.** `client.ts:331-354`
- `inflight` is cleared and `pump()` runs before `toBitmap` resolves.
- A paint in between (every frame during a drag) finds no exact patch and no matching in-flight job, so it queues the same key again.
- The duplicate's `exact.set` (`:337`) replaces a patch without `close()`. At 4096² a whole-frame patch is 67 MB, held until GC.
- Fix: keep a "converting" set of keys that `request()` treats as in flight, and close any replaced patch.

**m2. Orphan `moving` entries.** `client.ts:243-257`
- The DRAFT_ID entry is never settled after release or Esc. Its timer can fire a job for a cancelled draft, or a duplicate of the new id's job.
- Fix:
  - In `patchesFor`, settle ids that are not in `doc`.
  - Have the timer only mark the entry `fired` and trigger a repaint; the next `patchesFor` then requests the job if the id still exists.

**m3. The screen approximation reads pixels under solids and just outside O.** `src/effects/index.ts:49-52`
- The downscale with smoothing averages the image under a solid before the fractional `fillRect` stamps the solid. Edge cells keep part of the hidden pixels, and the smoothed upscale spreads them about b px outside the solid.
- The source-rect filter may also read past O, i.e. outside the frame (HTML spec allows it).
- This is screen-only, but RULE-10's "never sample pixels under a solid" is not limited to the export.
- Fix: stamp the solids in small-canvas coordinates rounded outward (floor/ceil) plus one cell, and inset the source rect by half a pixel. Or record the exception in a new ADR.

**m4. NFR-02 waste during drags.** `Canvas.tsx:377-391`, `drag.ts` `stale`
- Every exact patch bumps `version`, which rebuilds both cached drag layers. That includes the dragged shape's own idle patch, which is drawn in the middle pass anyway, so each pause costs a full lower-layer repaint (about 20 ms at 16384 × 1024).
- `patchesFor` also builds a new approximation canvas every frame for each effect whose window touches a solid being drawn, although those effects sit in the cached lower layer and are never drawn.
- Fix: bump the layer key only for patches of annotations outside the drawn range, and compute patches only for the range drawn this frame.

**m5. `dragRange` is not wired.** `src/canvas/drag.ts:182`
- It is used only by a unit test.
- Today a drawn solid is always on top, so nothing is wrong yet. F-008 (move and resize) must call it at `prepare()`/pointerdown.
- Fix: record this in the F-008 brief.

**m6. Test quality.**
- AC4 takes 8–17 s on both engines because each poll returns 245 k numbers (measured ≈ 470 ms per 320×192 read).
- I instrumented it: the first read after the drag was already uniform on Chromium. So the 15 s timeout covers the test's own read cost, not app latency. That is acceptable but not needed: compute the uniformity in `page.evaluate` (return a boolean) and keep the default timeout.
- AC4 cannot tell the approximation from the exact patch: the pointer stays still for more than 100 ms during the reads, so the exact job runs. It also checks only that blocks are uniform, not that they differ or equal `referencePixelate`.
- Sleeps:
  - `redact.spec.ts:220` (`waitForTimeout(150)`) asserts nothing about the idle job.
  - `:290` (`waitForTimeout(300)`) passes even if the exact patch never arrives. Poll until the blur equals `referenceBlur` with the solid applied, then assert the solid.
- No unit test covers the release transition (moving → still gives exactly one job) or a failed or errored job (M1).
- The fixme placeholders (AC3, AC7, AC9, AC10, AC11, AC13) are honest and named; AC11 and AC13 also have unit coverage.

**m7. `src/effects/reference.ts` is not fenced (gap d).**
- It is not bundled today, but nothing stops app code importing it.
- Fix: add an ESLint `no-restricted-imports` rule for `src/**` (except tests), then accept the wording.

**m8. NFR-04 headroom.** `client.ts:86`
- `CACHE_IMAGE_AREAS = 2` allows 134 MB of patch bitmaps at 4096². The worker's `Scratch` also keeps its peak window (about 2 × 67 MB) until the next image.
- Together that is against ADR-0022's WebKit worst case of about 931 MB, and it was never measured.
- Fix: lower it to 1 area, or add it to the QA memory run.

## Builder spec gaps
- (a) Accept. MOD-Effects public surface: `setImage(pixels, width, height, source, palette)` (source = the drawable image for the approximation, palette = RULE-04 hex), and `patchesFor(doc, moving?)` (ids being drawn, moved or resized; ADR-0017).
- (b) Accept. "Redaction: the detail is COPY-style.size_s/m/l of its strength for blur and pixelate; solid has no detail." This keeps the kind, and with it the not-secure label, out of the bar.
- (c) Accept. "…the current solid colour (the redaction tool's current colour, RULE-04)."
- (d) Accept once m7 is done. "The reference lives in `src/effects/reference.ts`; only tests import it (lint-enforced)."
- (e) Accept. This matches the F-001 transparent-PNG edge case. Add to CMP-Canvas: "Where a blur or pixelate patch shows a transparent background, the checkerboard shows on screen; the export is transparent."
- (f) Reject. Fix the code (M2).
