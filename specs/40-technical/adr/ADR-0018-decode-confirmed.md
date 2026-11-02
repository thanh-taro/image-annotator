---
id: ADR-0018
title: Decode confirmed — outcome of spike SP-decode (confirms ADR-0005)
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
ADR-0005 chose a magic-byte check, `createImageBitmap` with `imageOrientation: 'from-image'` and
sRGB canvases, pending spike SP-decode (branch `worktree-agent-a8a2876940bdda62a`, commit 71c1f90,
report `.build-my-app/reports/spike-decode.md`).

## Decision
ADR-0005 stands as written; the `<img>` fallback and `img-src blob:` are not needed. Two points
become explicit requirements:
- The magic-byte check is the only thing that refuses HEIC on WebKit, because WebKit can decode it.
  It stays mandatory, and its tests run on WebKit (RULE-01).
- WebKit's PNG encoder adds `sRGB` and a 68-byte `eXIf` chunk, so ADR-0007's chunk whitelist is
  required for the metadata-free export (INV-03).

## Evidence (headless Chromium 156 and WebKit 27.2, Apple silicon)
| Measure | Target | Result |
|---|---|---|
| EXIF orientations 1–8 | upright, 5–8 swapped | met; ΔE00 vs reference 0 on Chromium, max 0.46 on WebKit |
| Display P3 and Adobe RGB (JPEG and PNG) | match a reference sRGB conversion | mean ΔE00 ≤ 0.10, max ≤ 1.53, on screen and in the re-read export |
| 16-bit PNG | decodes | met; wide-gamut max ΔE00 2.76 on WebKit |
| GIF first frame, WebP, BMP | decode | exact |
| AVIF | where supported | both engines decode it; Chromium differs at about 0.3 % of hard-edge pixels (its smoothing of lossy colour detail) |
| HEIC and renamed non-images | refused | refused by the magic-byte check on both engines |
| Broken PNG body | error path | rejected (COPY-error.decode_failed path) |
| 14.7 MP decode | ≤ 600 ms | JPEG 39 / 65 ms, PNG 27 / 91 ms (Chromium / WebKit); with drawing and reading pixels ≤ 108 ms |
| Source metadata in the export | none | none (EXIF, PNG comment and ICC profile absent) |

## Consequences
- The e2e tests reuse the spike's fixture script. The fixtures embed Apple's ColorSync profiles; if
  they move into the repo's tests, register them in dependencies.md first.
- When the test setup goes in, pin Playwright to the DEP-16 version. The spike used 1.64.1, newer
  than DEP-16's ~1.63.
