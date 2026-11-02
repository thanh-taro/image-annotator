---
id: ADR-0007
title: Export — canvas at 1:1, platform PNG encoder with a chunk whitelist, clipboard and download
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
RULE-15: the export is a PNG with one pixel per image pixel covering exactly the canvas (the frame
plus its padding, RULE-14, D-020); image pixels only inside the frame; annotations cut at the canvas
edge. INV-02: exactly one flattened picture, no extra frames, layers, thumbnails or data blocks.
INV-03: no source metadata, sRGB colours. F-018.AC5: byte-identical in every language. NFR-03:
≤ 1.5 s at 14.7 MP. F-012.R1/R5: copy as a PNG, and offer download when the clipboard refuses.
A probe showed Chromium's encoder emits `IHDR, IDAT, IEND`, but **WebKit adds `sRGB` and a 68-byte
`eXIf` chunk** from both `toBlob` and `convertToBlob`, which breaks INV-02/INV-03 as written.

## Decision
1. **Render**: MOD-IO creates an export canvas of the canvas size (`colorSpace: 'srgb'`) and calls
   the same `paint()` as the screen (ADR-0004) with an identity scale and the origin at the
   canvas's top-left (frame.x − padding, frame.y − padding). It first **awaits every exact
   effects patch** (ADR-0006) and asserts the fonts are loaded (`document.fonts.check`, ADR-0009).
   No view, theme or language input reaches `paint()` (INV-05).
2. **Encode**: `canvas.toBlob(cb, 'image/png')`.
3. **Chunk whitelist**: a pure function (MOD-Core) walks the PNG and keeps only `IHDR`, `PLTE`,
   `tRNS`, `IDAT` and `IEND`, copying each kept chunk whole (length, type, data, CRC unchanged) and
   dropping everything else (`sRGB`, `gAMA`, `cHRM`, `iCCP`, `eXIf`, text chunks, `tIME`, `pHYs`,
   animation chunks). It **fails closed**: a bad signature, `IHDR` not first, `IEND` not last, a
   length past the end, or `IHDR` dimensions that differ from the canvas → COPY-error.export_failed
   (F-012.R7). Dropping `sRGB` is safe because the pixels are already sRGB and an untagged PNG
   means sRGB.
4. **Copy**: inside the same click or keydown task, call
   `navigator.clipboard.write([new ClipboardItem({ 'image/png': exportPromise })])` with a
   *promised* blob (WebKit requires the item to be created synchronously in the gesture). Mod+C is
   handled on `keydown` (preventDefault) when no text is selected on the page, not on the `copy`
   event (`DataTransfer` cannot carry a PNG). A missing `ClipboardItem` or a rejection
   (`NotAllowedError`) shows COPY-error.clipboard with the download action (F-012.R5).
5. **Download**: an `<a download>` with an object URL, revoked after use; the file name per
   RULE-15 comes from MOD-Core (local time for pasted images).
6. **Success** (RULE-15): copy = the clipboard promise resolved; download = the click handed to the
   browser. Only then does MOD-Document record the export (RULE-18) and MOD-App show the result
   with the redaction count (RULE-20). Any failure leaves the session unchanged and unexported.

**Pending condition — confirmed by spikes SP-png-export and SP-host**: the chunk list is
`IHDR, IDAT, IEND` on Chromium, WebKit and (manually) Firefox; 14.7 MP export ≤ 1.5 s and 5.2 MP
≤ 0.5 s; the stripped PNG pastes into common chat, code-hosting and document apps; the promised
`ClipboardItem` works in a WebKit frame with `clipboard-write`. If the platform encoder fails
these, a new ADR adopts our own encoder (`getImageData` + PNG filters + `CompressionStream
('deflate')`), or fflate (DEP-27).

## Alternatives considered
- **Our own PNG encoder** — zero dependencies and fully deterministic, but slower and more code.
  Recorded fallback.
- **fflate / UPNG.js** (MIT, +8–15 KB) — unnecessary while the platform encoder plus the whitelist
  passes.
- **`copy` event with `DataTransfer`** — cannot carry PNG data.

## Consequences
- INV-02/INV-03 hold on WebKit despite its extra chunks, and keep holding if an engine adds chunks
  later; an e2e test asserts the chunk list on both automated engines.
- The export is deterministic for a given engine and document (F-018.AC5).
- The export canvas is at most the RULE-02 limit (≈ 67 MB of pixels), inside NFR-04.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
