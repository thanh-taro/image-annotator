# Spike SP-decode — orientation, colour and formats (ADR-0005)

**Question:** does `createImageBitmap(file, {imageOrientation:'from-image'})` on sRGB canvases handle EXIF orientations, wide-gamut sources and the supported formats on every engine, fast enough?
**Hypothesis:** yes on Chromium and WebKit; the `<img>` + `img-src blob:` fallback is not needed.
**Success measures:**
- 8 EXIF orientation JPEG fixtures (1–8) come out upright with swapped dimensions for 5–8 (RULE-03);
- Display P3 and AdobeRGB JPEG and PNG fixtures look the same as a reference sRGB conversion (mean ΔE small, report the numbers) on screen and in a re-read export;
- GIF gives its first frame; WebP decodes; AVIF decodes where the engine supports it; HEIC is refused with the decode error path; a renamed non-image is refused by the magic-byte check;
- 16-bit PNG decodes;
- 14.7 MP decode ≤ 600 ms on Chromium and WebKit;
- the decoded pixels carry no metadata into the export (decoder output only).
Generate fixtures locally (ImageMagick/exiftool or a script) and record how; check specs/40-technical/dependencies.md before adding any tool to the repo.
**Fail →** `<img>` + `decode()` with `img-src blob:` via a superseding ADR.
**Time box:** about 1.5 hours of agent work.
**Not built:** UI, app structure.

## Outcome (2026-11-02)
**Adopt** (ADR-0018). Every measure passes on Chromium and WebKit; 14.7 MP decode ≤ 108 ms. WebKit decodes HEIC, so the magic-byte check must stay. WebKit's PNG export adds sRGB and eXIf chunks, so the ADR-0007 whitelist is required. Code: branch `worktree-agent-a8a2876940bdda62a` (71c1f90), `spikes/decode/`.
