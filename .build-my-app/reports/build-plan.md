# Build plan — M-1 (18 features)

Shared modules (MOD-Document, MOD-Canvas, MOD-Render) are touched by almost every drawing feature, so parallel worktrees would collide. Features run **one at a time** except where their modules don't overlap (marked ∥). Each feature runs the full pipeline: context → tests per AC (fail first) → implement → `pnpm check:full` + screenshots vs designs → code review (+ security review where files, clipboard, host or network are touched) → coverage → commit.

Spike code is promoted deliberately into the feature that needs it, in a commit that cites the ADR: engine (ADR-0004/0016/0022) in F-003, blur (ADR-0006/0017) in F-007, PNG strip (ADR-0019) in F-012, text overlay (ADR-0020) in F-005, decode (ADR-0018) in F-001.

| Wave | Features | Why this order |
|---|---|---|
| 1 | **F-001** Load ∥ **F-015** Host + **F-018** Language ∥ **F-016** Privacy | No dependencies; IO vs Host/Copy vs a dialog: separate modules |
| 2 | **F-002** Zoom and pan | The view every drawing tool needs |
| 3 | **F-003** Shapes → **F-004** Strokes and highlights → **F-006** Steps → **F-005** Text | Engine, tool state machine and paint grow one kind at a time |
| 4 | **F-007** Redact | Worker effects; needs the drawn kinds for "covers earlier annotations" |
| 5 | **F-012** Copy and download | Exports everything drawn so far; INV-02/03 tests |
| 6 | **F-008** Select and edit → **F-009** Undo and redo | Depend on all kinds |
| 7 | **F-010** Crop → **F-011** Padding | Frame, then padding around it (D-020) |
| 8 | **F-013** Keyboard ∥ **F-014** Warning ∥ **F-017** Offline | Finish-up; separate modules |

Scale: about 18 builder agents, each followed by 1–2 review agents, so roughly 40–55 agent runs over many sessions. Each feature ends with a commit on a build branch.

Gate (end of M-1): all 18 `shipped`; `pnpm check:full` green; AC coverage 100%, or each gap listed as a manual check (Firefox, Safari Vietnamese typing, paste into apps, GPU Chromium drag fps, iPad limits, real Mod+V paste on WebKit/Safari — e2e dispatches the paste event there).

## Deferred acceptance criteria (each gets its test when the named feature lands)
| AC | Needs |
|---|---|
| F-015.AC6, AC7 | every M-1 feature (end of M-1) |
| F-018.AC7 | every screen state (end of M-1) |

## Manual checks collected so far
- Safari trackpad pinch zoom (F-002.R3; e2e uses synthetic gesture events)
- Real Mod+V paste on WebKit (F-001)
- NFR-04 memory with blur/pixelate at the RULE-02 limit (F-007; measure in QA)
- Screen readers (VoiceOver, NVDA), 400 % reflow, forced colours, notices and touch (a11y F-013)
- Firefox: embedded and standalone offline copies kept apart; real Chrome partitioning (F-017)
- Real Safari: second download of the offline files on a first visit (ADR-0024)
- QA (security review F-017 m3): on a first visit, work pasted before the offline copy is saved; confirm no image data reaches the network and the copy still completes
- WebKit IME and Safari Telex Vietnamese input, real drop of text into the editor (F-005)

## Notes for later features
- QA/design: narrow artboards stop at 390 px; at 320–385 px the swatches take 2 rows of 4, shortcut key cells wrap and the Copy label wraps beside the redaction count (F-018.AC7 fixes). Consider a 320 px artboard.
- F-008: a straight (Shift) highlight has a zero-height bounding box; decide how its selection box and handles show (F-004 review m3).
- Flaky: F-003.AC8 pixel check failed once in F-006's run (passed 16/16 on rerun); watch it.
- F-013: write the step label for steps (F-006 removed the unused `stepName`).
- F-008: wire F-006.AC2/AC7 (fixme placeholders exist).
- F-012: wire the Mod+S `TODO(F-012)` in keys (pending unit test exists).
- Open design difference (F-005): placeholder opacity 0.5 is a raw value (no opacity token) and the artboard's 120 px editor minimum width is not applied; settle in QA or a token change.
- F-008: wire `dragRange` for moving solids (TODO(F-008) in canvas/drag.ts; security review F-007 m5).
- F-012 (security review F-007): export 1:1 on whole pixels, only exact patches (`exactPatches`), fail with an error (F-012.R7) rather than use the preview, single-image PNG.
- D-031: show the Not secure tag in the narrow summary bar for blur/pixelate; implemented in the F-008 fix round.
- F-005.AC7 e2e is slow (~20 s alone, marked test.slow); look at its pixel reads in QA.
- check:full after F-012 merge: preview e2e failed once under load (PhpStorm + VM, load ~45); both e2e steps passed on rerun.
- Deploy (phase 7), portal side (taro-kit 4c4ae94 applied D-006 as its D-070/D-071):
  - Release order: the portal's frame change (F-003 R9 focus on ready, `dialogs` permission) must be live before or together with this tool.
  - Catalog entry `content/tools/image-annotator.yaml` in taro-kit: `openMode: embedded`, `permissions: [downloads, clipboard-write, popups, dialogs, file-pick]` (file-pick is declarative; the portal changelog lists only the first four).
  - Idea after M-1: the portal's new `share` permission (D-072) could offer "Save to Photos" on iPad.
- F-013: keep the selection in view when selecting from the keyboard (RULE-19 last sentence; deferred from F-008 review).
- Flaky watch: F-008.AC1 WebKit pixel check failed once in F-009's run (8/8 on repeat).
- check:full after F-009 merge: preview e2e failed once (load ~12), 400/400 and 57/57 on rerun. Intermittent e2e failures after merges are recurring; QA should hunt the flaky tests.
- Flaky watch: F-007.AC4 WebKit pixelate test failed once in F-010's run (5/5 alone).
- F-011: reuse MOD-Core `availablePaddings` and `stepDownPadding` (built in F-010).
- Fixed: F-007.AC4 flaky under load; its waits now allow 20 s (timing is NFR-02's job), test.slow(). Passed 8/8 at load ~60 and in check:full.
