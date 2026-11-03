---
id: ADR-0023
title: Read image dimensions from the header before decoding (amends ADR-0005)
status: accepted
date: 2026-11-03
supersedes: []
---

## Context
ADR-0005 decodes the whole file with `createImageBitmap` and only then checks RULE-02's limits. A
small file with huge dimensions (a few MB of PNG or JPEG that declares, say, 30000 × 30000) is
then fully decoded before the tool can offer the scale-down. That can exhaust memory and crash the
tab, losing the user's unexported work. Found in the F-001 code review (round 1, M4).

## Decision
1. After the magic-byte check, MOD-IO reads the **declared dimensions from the header**:
   PNG `IHDR`; JPEG `SOFn` (with the EXIF orientation tag, so orientations 5–8 swap them); GIF
   logical screen; WebP `VP8 `/`VP8L`/`VP8X`; BMP DIB header; AVIF `ispe` (with `irot`). The parser
   is a pure function in MOD-Core, reading at most the first 256 KB.
2. If the declared size is over a RULE-02 limit, the scale-down question (CMP-ConfirmDialog) comes
   **before** any decode. On acceptance, the file is decoded once at the target size with
   `createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth, resizeHeight,
   resizeQuality: 'high' })`. On refusal, nothing is decoded.
3. Within the limits, decoding proceeds as in ADR-0005. If the bitmap's real size differs from the
   header's (a lying header), the bitmap's size wins: it is re-checked against RULE-02, and if it
   is over, the bitmap is closed and the scale-down question is asked as above.
4. If the header can't be parsed, the tool falls back to ADR-0005's decode-then-check.

## Alternatives
- Decode first and check after (ADR-0005 as written): simple, but a crafted or very large file
  can crash the tab.
- Refuse any image over the limits: contradicts RULE-02, which offers the scale-down.

## Consequences
- MOD-Core gains `readImageHeader(bytes)` with unit tests per format, including truncated and
  lying headers. MOD-IO's load order becomes size → magic bytes → header → (scale-down question)
  → decode → replace confirmation.
- The browser may still use memory proportional to the source while decoding with resize. That
  is engine-dependent, but there is only one decode and no full-size bitmap is kept.
