---
id: MOD-Effects
title: Effects — reference blur and pixelate in a worker, patch cache, live approximation
status: draft
depends_on: [MOD-Core]
---

## Responsibility
Produces the blur and pixelate patches exactly as ADR-0006 defines them. A module worker holds the
image's sRGB RGBA pixels (transferred once after load, dropped when the image is replaced) and
computes, per job, the patch for one redaction: box rounded outward, output = box ∩ frame, source =
frame pixels with every solid redaction applied, three H/V box-pass rounds or block means with the
specified rounding, edges clamped to the frame. A main-thread client sends jobs with ids (latest
wins), caches finished patches as `ImageBitmap`s keyed on (box, kind, strength, solids touching
the window, frame), bounds the cache, and offers an instant GPU approximation for a redaction (or
a solid it depends on) that is being dragged. It exposes a promise that resolves when every exact
patch for a document is ready, which the export awaits.

## Not responsible for
- Drawing patches into the scene or the background/solid compositing order (MOD-Render does it
  per ADR-0006).
- Decoding the image (MOD-IO) or any DOM in the worker; the worker imports MOD-Core only.

## Public surface
- Client: `setImage(pixels, width, height, source, palette)` (the source draws the live approximation; the palette resolves solid colours), `clearImage()`, `patchesFor(doc, moving?)` (exact or
  approximate per redaction; `moving` lists redactions being dragged, which get no exact job, ADR-0017), `exactPatches(doc, signal?): Promise<{ patches, release() }>` (rejects when a job fails, the image is cleared or replaced, or `signal` aborts, so the export can report it, F-012.R7; the patches it collects are held, never evicted or closed by the bounded cache, until `release()` after painting).
- Worker protocol (typed, versioned): `image`, `job { id, box, kind, size, frame, solids }`,
  `drop`; replies `patch { id, pixels }`, `failed { id }`.
- A slow reference implementation exported for tests only.

## Implements
F-007.R3/R5; INV-02; RULE-10; NFR-02, NFR-08. Decided by ADR-0006, ADR-0017, ADR-0022.

SP-blur outcome (ADR-0017): the main-thread client sends no job for a redaction while it, or a solid it depends on, is being dragged; it queues one job on release or after 100 ms without movement (latest wins). The worker uses the packed (SWAR) blur for b ≤ 128, the plain integer blur above that, and reuses its window buffers. SP-large-image (ADR-0022): the client terminates the worker and starts a fresh one whenever the image is replaced or cleared.
