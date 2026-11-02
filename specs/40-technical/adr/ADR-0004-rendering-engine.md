---
id: ADR-0004
title: Rendering engine — own Canvas 2D scene renderer, one paint for screen and export
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
The tool draws nine annotation kinds over an image of up to 16,777,216 pixels (RULE-02), must
repaint every frame at 60 fps while drawing, moving or resizing on the 14.7 MP reference image with
100 annotations (NFR-02), and must export a PNG that matches the on-screen view at 100 % within
1 image pixel (2 for text) (NFR-08). Solid redactions must cover every pixel their box touches with
hard edges (INV-02), and blur/pixelate must match a reference effect we define (ADR-0006), which no
library filter does. The document is our own immutable model (ADR-0008); a third-party scene graph
would duplicate it. Every annotation must be reachable from the keyboard and announced (NFR-06,
CMP-Canvas). Owner decision D-022: own Canvas 2D engine, with Konva as the fallback gated by
SP-engine.

## Decision
1. **One renderer, two targets.** MOD-Render exposes a pure-ish
   `paint(ctx, doc, transform, patches, overlays?)` that draws the scene from the document alone.
   The display canvas (MOD-Canvas, viewport-sized × device pixel ratio, capped at 2) and the export
   canvas (MOD-IO, canvas-sized at 1:1, ADR-0007) call the same function; only the transform and
   the overlays (selection handles, crop dim, checkerboard) differ. Fidelity holds by construction.
2. **Scene order** (D-020, RULE-14, RULE-15): fill the background over the canvas (frame + padding)
   → draw the image **clipped to the frame** → draw annotations in painter's order, blur/pixelate
   redactions as precomputed patches (ADR-0006) → clip everything to the canvas. While the crop
   tool is active (F-010.R2, RULE-12) the display instead shows the whole image, no padding, the
   annotations everywhere, and a dim outside the frame.
3. **Geometry and hit-testing are analytic** and live in MOD-Core: distance to segment, ellipse
   outline/area, polyline, quadratic Bézier strokes, boxes and text boxes, with a tolerance in
   screen pixels converted to image pixels by the zoom (grows when zoomed out, CMP-Canvas).
4. **Primitives**: shapes with arrowheads per F-003.R2; pen strokes as midpoint quadratic curves;
   a highlight as one path stroked once at α 0.4 so it never darkens itself (RULE-09); solid
   redactions as integer rectangles from the outward-rounded box with no antialiasing (INV-02);
   step badges and text per ADR-0009. Image smoothing is off at zoom ≥ 200 % on screen only
   (assumption A5 in `architecture.md`, INV-05).
5. **Threads**: display and export render on the main thread (lowest input latency, fonts
   certain); only the pixel effects run in a worker (ADR-0006). Transient drag state is a plain
   mutable controller in MOD-Canvas that schedules `requestAnimationFrame` repaints directly.

**Pending condition — confirmed by spike SP-engine** (`architecture.md`): rectangle, ellipse,
arrow and stroke draw/select/move/resize/undo; 100 annotations on 14.7 MP repaint in ≤ 8 ms per
frame on Chromium and WebKit; hit tolerance works at 10 % and 800 %; own engine ≤ 25 KB gzip. If
SP-engine fails, a new ADR supersedes this one and adopts Konva (DEP-26).

## Alternatives considered
- **Konva** (MIT, ~50 KB) — colour-key hit canvases and a node tree that duplicates our state; its
  blur filter does not match the reference. Recorded fallback.
- **Fabric.js** (MIT, ~90 KB) — twice the bundle; its own text editing conflicts with RULE-19 and
  the accessibility model.
- **SVG overlay + canvas export** — needs two renderers that can drift, or SVG rasterising that
  cannot use page fonts without inlining them; SVG blur differs from the reference.

## Consequences
- ~15–25 KB of our own rendering code to write and test; no third-party object model.
- Display and export cannot drift; NFR-08 is tested by comparing the two paths.
- Undo, accessibility (annotations as a list, CMP-Canvas) and position fields (D-008) work on the
  one document without syncing a second scene.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
