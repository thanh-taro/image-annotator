---
id: ADR-0006
title: Reference blur and pixelate — exact integer algorithms, computed in a worker
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
F-007.AC7 requires each exported pixel of a blur redaction to equal "the reference blur defined in
the architecture" within ±1 per channel, on every engine (NFR-08). RULE-10 sets the radius and
block sizes, says blur and pixelate sample only image pixels **inside the frame**, with every solid
redaction applied, never other annotations, and show the background where their box lies outside
the frame (D-020, F-007.AC13). Solids always win (INV-02, F-007.AC10); an earlier arrow does not
appear inside a later blur (F-007.AC9). The blur must update live while dragging (F-007.R3,
NFR-02). `ctx.filter` is absent in WebKit, and engines' Gaussian approximations differ by more than
±1, so the platform cannot be the reference. Owner decision D-023: own exact algorithm.

## Decision
**Definitions.** All coordinates are image pixels; the frame F is integral (RULE-13).
- **Box** B = the redaction's box extended outward to whole pixels:
  `x0 = floor(x)`, `y0 = floor(y)`, `x1 = ceil(x + width)`, `y1 = ceil(y + height)` (INV-02).
- **Output area** O = B ∩ F. Image pixels outside F are never read or shown (RULE-10).
- **Source** S = the image's 8-bit RGBA as held by an sRGB canvas (ADR-0005), restricted to F,
  with **every** solid redaction's covered pixels set to its colour at α 255. No other annotation
  contributes.
- **Premultiply** (per pixel, per colour channel c, alpha a): `p = floor((c·a + 127) / 255)`;
  alpha is kept as `a`. **Unpremultiply** at the end: if `a = 0` the pixel is (0, 0, 0, 0), else
  `c = min(255, floor((p·255 + floor(a/2)) / a))`. Opaque pixels are unchanged by both steps.

**Blur** with radius r (RULE-10, whole pixels): `b = floor((r + 1) / 2)` (r/2 rounded half up),
width `w = 2b + 1`. On premultiplied RGBA of S over the whole of F, apply **three rounds of a
horizontal pass followed by a vertical pass** (H, V, H, V, H, V). Each pass computes, per channel,
`out[i] = floor((Σ_{k=-b..b} in[clamp(i + k)] + b) / w)`, where `clamp` replicates the nearest
pixel inside F (edges are clamped to the **frame**, not the image). Every pass rounds to an 8-bit
integer before the next. The result restricted to O, unpremultiplied, is the blur. Implementations
may compute only a window of O expanded by 3b per side, clamped to F; this is exact because each
axis is read at most 3b pixels away. Variance is 3·(w² − 1)/12 = b(b + 1), so σ ≈ r/2.

**Pixelate** with block size p (RULE-10): blocks are p × p, aligned to (x0, y0). For each block,
the pixels counted are block ∩ O (so partial blocks at the right/bottom edges, and at the frame's
edges, average only their own pixels). Each channel of premultiplied S is averaged with
`floor((Σ + floor(n/2)) / n)` over those n pixels, then unpremultiplied; every pixel of block ∩ O
gets that value.

**Patch and composite.** For each blur/pixelate redaction the result is a **patch** covering
B ∩ canvas, drawn in painter's order like any annotation:
1. the patch region is **replaced** (not blended) by the background (RULE-14: transparent or the
   palette colour), hiding earlier annotations there (F-007.AC9) and giving the background in the
   padding part (F-007.AC13);
2. the effect pixels of O are drawn over that background (source-over, so transparent image pixels
   show the background, as elsewhere inside the frame);
3. every solid redaction's covered pixels inside the patch region are **re-stamped** in its colour
   at α 255, so a solid always shows whatever the order (F-007.AC10, INV-02).
Later annotations draw over the patch as usual.

**Computation.** The effects worker (MOD-Effects) holds the image pixels (ADR-0005) and computes
exact patches; every job carries an id, the latest job per redaction wins, and results are cached
on (B, kind, strength in pixels, the solids that touch the read window, F). While a redaction or
a solid it depends on is being dragged, the screen shows an **instant approximation** (draw the
region scaled down by about b and back up with smoothing; for pixelate, down by p with smoothing
off); the exact patch replaces it within a few frames and always on release. **Export waits for
every exact patch** (ADR-0007).

**Testing.** A slow, independent reference implementation of the definitions above lives in the
tests and is compared to the optimised worker code with fast-check: equal exactly for opaque
pixels; translucent pixels compared in premultiplied form. The ±1 allowance in F-007.AC7 covers the
premultiply round trip in the engine's own canvas storage.

**Pending condition — confirmed by spike SP-blur**: 12–16 px text unreadable at strength S on a
2880 × 1800 screenshot; optimised worker blur ≤ 40 ms per megapixel; 10 blur redactions plus
dragging a 2000 × 1200 box hold 60 fps with the approximation, exact patch ≤ 250 ms after release;
the fast-check comparison passes. If SP-blur fails on speed, a new ADR adopts a WebGL
implementation of the same definition; if S does not obscure text, the fix is a spec change to
RULE-10's sizes, not to this algorithm.

## Alternatives considered
- **`ctx.filter: blur()`** — fast, but absent in WebKit and not reproducible across engines.
- **WebGL shader** — deterministic enough, but a second rendering stack; kept as the escape hatch.
- **A true Gaussian kernel** — slower (O(r) per pixel) and no more useful for hiding text; three
  box passes approximate it in O(1) per pixel.

## Consequences
- F-007.AC7, AC9, AC10 and AC13 are testable to the pixel on every engine.
- We own the performance; the worker, cache and approximation exist only for speed.
- Nothing outside the frame can leak into a blur or pixelate patch, and nothing a solid hides can.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
