---
id: ADR-0016
title: Display image layer — outcome of spike SP-engine (amends ADR-0004)
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
ADR-0004 chose our own Canvas 2D engine, pending spike SP-engine. The spike (branch
`worktree-agent-ada7499133edfd784`, report `.build-my-app/reports/spike-engine.md`) confirmed the
engine. It found that drawing the scaled 14.7 MP image costs about 11 ms per frame on GPU-less
Chromium, while drawing the 100 annotations costs about 0.5 ms.

## Decision
- ADR-0004 stands. SP-engine passed with one adaptation.
- MOD-Canvas keeps a device-sized **image layer** for the current view, drawn by MOD-Render
  `paintBase`. It holds exactly ADR-0004 scene steps 1–2: the background over the canvas, then the
  image clipped to the frame (in the crop view, the whole image with no clip). Under them sit the
  screen-only surround and the checkerboard behind transparent pixels.
- `paint` (signature in MOD-Render) copies the layer and skips those steps, then draws the
  annotations.
- The layer is rebuilt whenever its inputs change: zoom, pan, viewport size, device pixel ratio,
  theme, image, frame, padding or background, and crop view on or off.
- The export never uses the layer. It paints 1:1 from the image, so NFR-08 is unaffected.
- Zoom and pan frames redraw the layer. NFR-02 needs only visible feedback within 100 ms for that
  input, not 60 fps. Measured: about 15–18 ms on software Chromium and 4–14 ms with a GPU.

## Evidence (SP-engine)
| Measure | Target | Result |
|---|---|---|
| Draw, select, move, resize and undo/redo for rectangle, ellipse, arrow and stroke | works | passes on Chromium, Chromium with GPU and WebKit; 17/17 unit tests |
| Hit tolerance at 10 % and 800 % | correct | passes (5 px selects, 8 px misses) |
| Drag repaint, 100 annotations on 5120 × 2880 | p95 ≤ 8 ms | software Chromium 2.0–5.8 ms; GPU Chromium and WebKit about 5–8 ms on an idle machine (noisy when loaded; re-measured in QA) |
| One paint for display and export | NFR-08 | export equals the 100 % dpr-1 view, max pixel difference 0, on all three browsers |
| Engine size | ≤ 25 KB gzip | 4.98 KB gzip |

## Alternatives
- Konva (DEP-26): not needed. Its scaled image draw costs the same, and our annotation drawing is
  already about 0.5 ms.
- Partial reuse of the layer while panning: not needed for NFR-02; a later optimisation if wanted.

## Consequences
- The layer is one more device-sized canvas, about 20 MB at 2880 × 1800 × 4 bytes, so it counts
  towards NFR-04.
- At dpr 2 on WebKit, the layer and a direct draw differ slightly in smoothing. This affects the
  screen only.
- Pointer thresholds follow RULE-05 (adopted from the spike controller).
- Confirmed against NFR-04, and extended with split drag layers, by SP-large-image (ADR-0022).
- QA re-measures GPU timings on an idle machine, and measures fills, which the spike benchmark missed.
