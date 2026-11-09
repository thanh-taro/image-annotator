# QA phase 5: flows and visual regression

Branch build/m1, 2026-11-09. Local only. No app code changed.

## Flows
FLOW-01 and FLOW-02 had no end-to-end test. Added `tests/e2e/flows/flow-01.spec.ts` and `flow-02.spec.ts` (titles start with the FLOW ID; each step cites its F-/R- IDs). Each run on Chromium and WebKit, repeated 3 times: 12/12 pass (about 3 s each). Both decode the exported PNG in Node (clipboard PNG for FLOW-01: 800x500, black solid redaction; download for FLOW-02: 224x144, white padding, named `fmt-annotated.png`). FLOW-02's "delete and re-add, numbers stay consecutive" exit is covered by F-006 tests, not repeated here.

## Full suite (`pnpm check:full`)
All gates before e2e pass (unit+property 678/678). The preview e2e failed 23 tests, all `ENOENT` in `test-results/.playwright-artifacts-*`: a concurrent QA agent shares this checkout's output directory (load average ~240). Rerun with `--output` elsewhere: 46/46 pass. Host harness: 81 pass, 5 failed under load ~140 (F-018.AC1, F-018.R7, F-018.AC10, F-018.R2, F-001.AC16), 10/10 on rerun. Classified as flakes. Recommendation: pass `--output` per agent when QA agents run in parallel.

## Visual regression
Method: the artboards need the Claude Design runtime, which is not in `design/canvas/project`. `tests/visual/render-artboards.mjs` expands the one template construct (`sc-for` over the two themes) and renders each `.app` panel with Playwright Chromium (Manrope embedded, no network). `tests/visual/capture-app.mjs` drives the production build into each state, 1200x760 and 390x760, `?theme=dark|light`, with the artboards' own checkout sample as the image. `tests/visual/pair.py` makes design | app | diff sheets. 17 artboards x 2 themes = 34 pairs in `.build-my-app/reports/screens/qa/pair_<state>_<viewport>_<theme>.png`. All states captured, including loading and exporting (slowed decode/encode) and error (clipboard refused). Pixel diff share ranges 1 to 7 percent for embedded states and 10 to 44 percent for narrow ones, which is dominated by the sample image sitting a few pixels differently.

Result: layout, spacing, colour tokens and copy match the artboards in every captured state. No blockers, no majors.

| # | Class | Difference | Where |
|---|---|---|---|
| 1 | minor | Toolbar icons are Lucide glyphs; the artboards use simplified sketch icons (Step is a list icon, not a circled 1; source link has a code icon, not the GitHub mark). | all |
| 2 | minor | Status bar hides the canvas size ("1,756 x 1,098 px") until a crop or padding exists (D-017, CMP-StatusBar); the default artboard always shows it. Spec wins; update the artboard. | default, selecting, error, exporting |
| 3 | minor | Multi-selection: the artboard shows "2 annotations selected" (COPY-a11y.selected_count) as a heading atop the wide style panel; the app shows none (panel starts at Color). Not required by CMP-StylePanel; confirm or add. | selecting_embedded |
| 4 | minor | Redaction count pill shows text only; the artboard has a bar icon. Already accepted in `adapters/design.md`. | all with image |
| 5 | minor | Crop size chip: border and font differ slightly from the artboard's flat mono chip. | cropping |
| 6 | minor | Narrow empty state shows the "Press Ctrl+V ... drop an image file here" hint; the artboard shows the click-to-paste variant. Depends on whether the tool is focused; state difference, not a defect. | empty_narrow |
| 7 | minor | Image sits 1 to 2 px lower than in the artboard. Anti-aliasing level. | embedded |

Capture limits (not defects): my script focuses the canvas, so a focus ring surrounds the work area; the crop frame is the whole image rather than the artboard's 1707x683 frame; in narrow canvas-settings my script did not open the sheet, so it shows "Padding None" (the embedded variant with Medium/White matches). The artboards were not re-run for dark vs light colour token values beyond the visual match; the tokens are generated from tokens.json and validated elsewhere.

## Traceability
`.build-my-app/reports/traceability.md`: 176 acceptance criteria, all with tests (`spec_lint --coverage tests`: 0 without a test), NFR methods listed for the audits, manual checks listed unsigned.

## Files
Tests: `tests/e2e/flows/`, `tests/visual/`. Reports: this file, `traceability.md`, `screens/qa/`.
