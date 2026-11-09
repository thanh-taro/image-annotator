# Review — F-011 Add padding and background, round 1

Diff: `build/m1...worktree-agent-a0fd444e89135d336` (c767487). Paths below are relative to the worktree.
Verdict: **no blockers, no majors.** You can merge once the spec wording below (m2, m1) is settled.

## What I checked and found correct
- **Padding sizes:** `core/canvas.ts:7` uses `Math.round(factor × longer side)`. I brute-forced S/M/L for every side from 1 to 16384: half-up everywhere, with no float error.
- **Unavailable sizes:** `availablePaddings` drives both the panel (`drawing.ts:329`, `StylePanel.tsx` CanvasSettings) and `document/index.ts` `setPadding`, so an unavailable size is a no-op with no step. COPY-canvas.padding_unavailable is shown and is the group's accessible description (tested in AC6, with axe).
- **Step-down:** `setFrame` → `stepDownPadding` happens in one op, so it is one undo step. It reuses the core helpers. Tested at unit and e2e level (AC7).
- **Background:** `render/index.ts` paintScene fills the whole canvas and then clips the image to the frame, so the background shows under transparent pixels and no outside pixels reach the padding. The RULE-10 patch is replaced by the background. Crop view: `cropView` sets padding to none and keeps the background. The crop cache is keyed on image and background.
- **`paintBase` rebuild:** `canvas/layer.ts:35` compares `doc.padding` by identity, and both ops always freeze a new padding object.
- **Status bar and summary:** `shownCanvasSize` shows the size once there is a crop or padding (D-017). `canvas_summary` uses the same size.
- **Undo steps:** one step per change. A same-value change or an unavailable size adds no step (unit tests).
- **COPY, tokens, tests:** COPY and tokens only; no new strings or values. Every AC has a test (spec_lint coverage is clean). The F-007.AC13 padding half is real and checks white padding plus the reference blur inside the frame. No sleeps: only rAF and `expect` polling.
- **Screen state `canvas-settings`:** it is **not invented**. It has been in `specs/30-experience/screens/SCR-Annotator.md` since commit 2e2bc1c (Phase 0-1): "Select tool active, nothing selected". There are approved artboards for it: `SCR-Annotator_canvas-settings_embedded/narrow.dc.html`. The builder edited no specs (`git diff -- specs` is empty).
  - The old behaviour (`default` after load, with the select tool) was the gap: `default` is defined as "drawing tool active".
  - The changes in `load.spec.ts:66` and `privacy.spec.ts:214` are therefore corrections. The other `'default'` expectations still hold: `text.spec.ts:331` and `:637` use the text tool, and `privacy.spec.ts:221` and `:237` use the rectangle tool.
  - Nothing in `src/` reads `data-state`.

## Blocker
None.

## Major
None.

## Minor
- **m1 — No colour chip for the background in the narrow summary** (`src/app/drawing.ts:330`; the chip is drawn at `StylePanel.tsx:529`).
  - The narrow artboard's caption says "transparent background, **so** no colour dot". That implies a palette background shows the dot. CMP-StylePanel "narrow" says "the current colour (when the subject has one)", which is ambiguous for the canvas.
  - Failing scenario: on a 390 px viewport, choose background White. The bar reads "Canvas · Padding None" with no chip, which contradicts the artboard's reasoning.
  - Fix: either set `color: d.padding.background` when it isn't `transparent`, or amend the spec: "the canvas variant shows no colour". This needs an orchestrator or owner decision, plus a test either way.
- **m2 — The 2-rows-of-5 layout is not in the spec** (`src/app/styles/padding.css:47-61`).
  - CMP-StylePanel Accessibility only covers "the 8 swatches out in 2 rows of 4" on a coarse pointer (`CMP-StylePanel.md:42`).
  - The CSS itself is sound: 9 × 44 px doesn't fit the 358 px sheet or the 240 px docked panel, while 5 × 44 does. The `:has()` selector out-ranks the 4-column rule.
  - Fix: add to the spec: "The canvas background's 9 choices (COPY-canvas.transparent and the palette) are laid out in 2 rows of 5 on a coarse pointer and in the narrow sheet." Also add a screenshot or bounding-box check: none of the tests asserts the two rows.
- **m3 — Layout chosen by counting choices** (`src/app/StylePanel.tsx:96`).
  - `values.length === 4` picks the 4-column layout. Any future 4-option `Choice` silently gets that layout.
  - Fix: add an explicit `columns` prop, or a class passed from `CanvasSettings`.
- **m4 — Missing tests for two RULE-14 paths.**
  1. No test that a padding or background change rebuilds the cached screen layer (`canvas/layer.ts:35`). The e2e tests check only the export.
  2. No test that a palette background shows under transparent pixels **inside** the frame (R2, "Padding none with a coloured background" edge case).
  - The code is right, so this is a guard against regressions. Fix: a unit test on `ImageLayer` (`rebuilds` goes up after `setPadding` and `setBackground`), and a `render.base` or export test with a half-transparent image under a white background.
- **m5 — Stale comment** (`src/app/Shell.tsx:167`). It says "once a crop exists"; it should be "once a crop or padding exists" (D-017). Trivial.
