---
id: ADR-0005
title: Decode, orientation and colour — magic bytes, createImageBitmap, sRGB canvases
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
RULE-01 accepts PNG, JPEG, WebP, GIF (first frame), BMP and AVIF where the browser decodes it, and
refuses everything else with a message. RULE-02 bounds the file (50 MB) and the pixels (16,777,216,
longer side 16,384) and offers a scale-down. RULE-03 applies the recorded orientation and reads no
other metadata. INV-03 requires sRGB pixels at load so the export can drop colour profiles without
changing how colours look. NFR-03 asks for a 1 s open at 14.7 MP; NFR-04 a < 1 GB session. Owner
decision D-024: an image the browser cannot decode (for example a very large one under 50 MB)
shows the existing COPY-error.decode_failed.

## Decision
1. **Order of checks** (F-001.R7): `File.size` > 50,000,000 bytes → COPY-error.file_too_large;
   then the first 64 bytes are read and the format is decided by **magic bytes** only (PNG
   signature, JPEG `FF D8 FF`, `GIF87a`/`GIF89a`, `RIFF`…`WEBP`, `BM`, ISO-BMFF `ftyp` with an
   `avif`/`avis` brand); HEIC/HEIF-only brands, TIFF, PDF, SVG and anything else →
   COPY-error.unsupported_format. MIME type and file extension are ignored. AVIF is accepted only
   if a start-up capability probe (decoding a tiny AVIF embedded in the bundle) succeeded;
   otherwise it counts as unsupported.
2. **Decode** with `createImageBitmap(file, { imageOrientation: 'from-image',
   colorSpaceConversion: 'default', premultiplyAlpha: 'default' })`. A rejection, or a result
   smaller than 1 × 1, → COPY-error.decode_failed (RULE-02, D-024). Width and height are the
   bitmap's, after orientation. GIF yields its first frame.
3. **Scale-down** (RULE-02): if the image is over either limit, the scale is
   `min(√(16,777,216 / (w·h)), 16,384 / max(w, h))`, each side is rounded down (F-001.AC7:
   6000 × 3400 → 5441 × 3083), CMP-ConfirmDialog offers it, and on acceptance
   `createImageBitmap(bitmap, { resizeWidth, resizeHeight, resizeQuality: 'high' })` produces the
   image and the original bitmap is `close()`d (NFR-04). The replace confirmation (RULE-18) comes
   only after these checks pass.
4. **Colour**: every canvas the tool creates uses `colorSpace: 'srgb'`, and `getImageData` asks for
   `'srgb'`, so tagged wide-gamut sources are converted to sRGB when drawn. "The image's pixels"
   (ENT-Image, INV-01, INV-03) are what an sRGB canvas holds after drawing the bitmap.
5. **Pixels for the effects**: after load, in idle time, the RGBA pixels are read once and
   **transferred** (not copied) to the effects worker (ADR-0006). The main thread keeps only the
   `ImageBitmap`; replacing the image closes it and tells the worker to drop its buffer.

**Pending condition — confirmed by spike SP-decode**: EXIF orientations 1–8 upright with swapped
dimensions; Display-P3 and Adobe RGB JPEG/PNG look the same on screen and in the export; GIF first
frame; AVIF where supported; HEIC refused; 14.7 MP decode ≤ 600 ms. If `imageOrientation` or
colour conversion misbehaves on an engine, a new ADR adopts the `<img>` + `decode()` fallback with
`img-src blob:` in the CSP (ADR-0010).

## Alternatives considered
- **`<img>` + `decode()`** — mature orientation and colour management, but needs `img-src blob:`
  and an object URL per load. Recorded fallback.
- **`ImageDecoder` (WebCodecs)** — not exposed in WebKit; rejected.
- **Our own metadata parser for orientation** — RULE-03 needs only orientation, which the platform
  applies; parsing metadata ourselves adds risk for nothing.

## Consequences
- No metadata parser and no decoder dependency; behaviour follows the engines' decoders, so tests
  use fixtures per format and orientation.
- The sRGB conversion happens once at load; display, effects and export all see the same pixels.
- An image larger than an engine can decode shows COPY-error.decode_failed (D-024), with no new
  message.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
