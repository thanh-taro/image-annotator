---
id: MOD-IO
title: IO — paste, drop and open; decode; export to clipboard and file; leave-page warning
status: draft
depends_on: [MOD-Core, MOD-Render, MOD-Effects]
---

## Responsibility
Getting images in and results out, on the device only (PRN-01). In: a document `paste` listener
that reads only `clipboardData.files` / file items with an `image/*` type (HTML and links are never
parsed or fetched, F-001.AC15); drop handlers (overlay only when files are dragged, folders and
extra files ignored with COPY-load.first_only); the file picker (Mod+O and the open action); then
the checks and decode of ADR-0005 in F-001.R7's order (size, magic bytes, decode, limits and
scale-down offer), returning a decoded image or a refusal code without touching the current
session. It records the source name only for picked or dropped files (RULE-15). After load it
reads the pixels once for MOD-Effects. Out: the export pipeline of ADR-0007 (await exact patches
and fonts → export canvas at 1:1 over the canvas → `toBlob` → chunk whitelist → `ClipboardItem`
with a promised blob in the gesture, or `<a download>` with a revoked object URL), reporting
success or failure codes. It owns the `beforeunload` handler that asks to leave while the session
is unexported (F-014.R1).

## Not responsible for
- Confirm dialogs, notices and their wording (MOD-App, MOD-Copy).
- Deciding what is exported (MOD-Render paints it; MOD-Document records the export).
- Host messaging (MOD-Host); any network request (there is none, INV-04).

## Public surface
- `onImageInput(handler)` for paste/drop/pick; `openPicker()`.
- `decodeInput(file) → { ok, image } | { refused: code, scaleDownOffer? }`; `scaleDown(image)`.
- `copyResult(doc)`, `downloadResult(doc, localTime)` → success or `clipboard` / `export_failed`.
- `setLeaveWarning(enabled)`.

## Implements
F-001.R1/R2/R3/R4/R5/R6/R7, F-012.R1/R2/R3/R5/R6/R7, F-014.R1/R2, F-017.R1; INV-02, INV-03,
INV-04; RULE-01, RULE-02, RULE-03, RULE-15; NFR-01, NFR-03, NFR-04. Decided by ADR-0005, ADR-0007, ADR-0018, ADR-0019, ADR-0021, ADR-0022, ADR-0023.

SP-large-image outcome (ADR-0022): after encoding, the export canvas is freed (width and height set to 0) whether the export succeeded or failed. RULE-02 is enforced here and in MOD-Core, never left to the browser.

F-001 review outcome (ADR-0023): load order is size → magic bytes → header dimensions → scale-down question → one decode → replace confirmation.
