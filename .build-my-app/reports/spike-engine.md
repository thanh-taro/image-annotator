# Spike SP-engine — own Canvas 2D engine (ADR-0004, D-022)

**Question:** can our own Canvas 2D renderer handle hit-testing, move, resize, handles and snapshot undo for the core kinds within budget, with one `paint()` for screen and export?
**Hypothesis:** yes, in ≤ 25 KB gzip of our own code, with repaint well under a frame.
**Success measures:**
- rectangle, ellipse, arrow and freehand stroke: draw, select (analytic hit-test with screen-px tolerance), move, resize by handles, undo/redo via immutable snapshots (ADR-0008);
- 100 annotations over a 14.7 MP image (5120×2880): full repaint ≤ 8 ms/frame on Chromium and WebKit (Playwright, headless), measured;
- hit tolerance correct at 10 % and 800 % zoom (unit tests);
- display paint and 1:1 export paint come from the same function; export of a small doc matches the 100 % view within 1 px (NFR-08);
- engine code ≤ 25 KB gzip (measured with a Vite build).
**Fail →** Konva (DEP-26) via a superseding ADR.
**Time box:** about 2 hours of agent work.
**Not built:** UI shell, toolbar, text, steps, redactions, a11y, styling, real app structure.

## Outcome (2026-11-02)
**Adapt.** The own engine is confirmed: 4.98 KB gzip, every interaction check passes, and export equals the screen. Required change: a cached display image layer (ADR-0016). Zoom and pan need only 100 ms feedback (NFR-02), so their 15–18 ms frames on GPU-less Chromium are within the spec. Code: branch `worktree-agent-ada7499133edfd784` (commit 4357092), `spikes/engine/`, with evidence in `spikes/engine/evidence/`.
