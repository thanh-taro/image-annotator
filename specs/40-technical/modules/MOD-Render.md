---
id: MOD-Render
title: Render — one paint function for the screen and the export
status: draft
depends_on: [MOD-Core]
---

## Responsibility
Draws the scene from the document onto any Canvas 2D context (ADR-0004). Order: the background
over the canvas; the image **clipped to the frame** (image pixels outside the frame never show,
RULE-14, D-020); annotations in painter's order — rectangles and ellipses (outline, solid or 30 %
fill over the shape's box, in the fill colour from M-1c, RULE-22, then the outline over it), lines and arrows (head 4 × / 3 × the stroke size), pen strokes as midpoint quadratics,
highlights as one path at 40 % opacity with no self-darkening (RULE-09), text with its outline (from M-1c, or on its rounded background box without the outline, RULE-22)
(RULE-08, ADR-0009), step badges and pills with contrast pairing (RULE-07), solid redactions as
integer boxes with no antialiasing (INV-02), and blur/pixelate as the patches MOD-Effects
supplies (ADR-0006); finally everything **clipped to the canvas**. In the crop view (F-010.R2,
RULE-12) it draws the whole image without padding, annotations everywhere, and dims the area
outside the frame. Optional overlays (selection outlines and handles, the crop frame and handles,
the checkerboard behind transparent areas) are screen-only. It reads no language, theme or view
state other than the transform it is given (INV-05).

## Not responsible for
- Computing blur or pixelate pixels (MOD-Effects) or deciding what is selected (MOD-Canvas).
- Owning canvases, scheduling frames or encoding (MOD-Canvas, MOD-IO).

## Public surface
- `paint(ctx, doc, image, transform, patches, overlays?, layer?)` — the single entry point; `layer` is the display-only image layer (ADR-0016), never passed by the export. `doc` is typed as `Scene`, a read-only view type in MOD-Core that MOD-Document's document satisfies, so MOD-Render imports only MOD-Core.
- `paintBase(ctx, doc, image, transform, view)` — scene steps 1–2 plus the screen-only surround, checkerboard and canvas outline (style.md work area), for the display layer (ADR-0016).
- `colourValue(colour)` (a palette name's token value, or a custom hex as is, RULE-21) compiled from the tokens (ADR-0013); the RULE-07 contrast pairing comes from MOD-Core `contrastPairing`.

## Implements
F-003.R1/R2/R3, F-004.R1/R2, F-005.R2/R5, F-006.R3/R4, F-007.R2/R5, F-010.R2, F-011.R2/R3,
F-012.R3, F-018.R5; INV-02, INV-05; RULE-07, RULE-08, RULE-09, RULE-14, RULE-15; NFR-08. Decided by
ADR-0004, ADR-0009, ADR-0016, ADR-0020, ADR-0022.

SP-engine outcome (ADR-0016): exposes `paintBase` for the display layer; `paint` accepts the optional layer. The export never uses it. SP-large-image (ADR-0022): `paint` can also draw a subset of annotations (below or above the dragged ones) for the split drag layers.
