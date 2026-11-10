---
id: MOD-Core
title: Core — domain types, limits, geometry, frame/padding/canvas maths, pure helpers
status: draft
depends_on: []
---

## Responsibility
All domain knowledge of the tool as pure, synchronous, dependency-free TypeScript usable on the
main thread and in the effects worker. It owns the domain types as plain data (ENT-Session parts,
ENT-Image metadata, ENT-Annotation, ENT-Style, ENT-Frame, ENT-Padding); the RULE-02 limits and the
scale-down size; the RULE-04 and RULE-10 size tables relative to the image's shorter side; the
RULE-05 click/default-size and RULE-06 constraint maths; RULE-07 numbering; the RULE-12 zoom steps
and fit level (the content is the canvas, or the whole image while cropping); **the frame, padding
and canvas maths after D-020** (RULE-13 frame bounds and minimum 16 px; canvas = frame + padding
sized from the frame's longer side; which padding sizes keep the canvas within RULE-02; the
padding step-down a frame change causes, F-011.R6); geometry and analytic hit-testing (segments,
ellipses, polylines, quadratic strokes, boxes, text boxes, arrowheads per F-003.R2) with a
screen-pixel tolerance; the outward-rounded redaction box (INV-02); the RULE-20 count (redactions
whose box overlaps the canvas); RULE-15 download names; the magic-byte format sniff (ADR-0005);
the PNG chunk whitelist (ADR-0007); and the text metrics constants (ADR-0009).

## Not responsible for
- State, history or edit operations (MOD-Document).
- Any DOM, canvas, worker, clipboard, file or network API; it never reads the clock or the
  language itself (callers pass the local time for RULE-15).
- User-facing wording: results carry codes and numbers; text comes from MOD-Copy.

## Public surface
- Domain types and palette/size enums; `styleSizes(shortSide)` → stroke, text, badge, highlight,
  blur radius and pixelate block in pixels (RULE-04, RULE-10).
- Fill colour and text background (RULE-22, F-020): `contrastPairing(colour)` (RULE-07, palette or custom), `fillColourOf(kind, style)` (the fill or text background colour as drawn, automatic resolved), `textBackground(annotation, shortSide, measure)` (the rounded box, margin and radius), `textArea` (the text's area: the background box when it has one), `editorPadding(style, size, zoom, extra, caretRoom)` (CMP-TextEditor padding covering the box, F-020.R8).
- Custom styles (RULE-21, F-019): `isHexColour`, `pickedColour(value, palette)` (palette match ignoring case), `hexLabel`, `contrastRatio`, `customContrast(hex)` (RULE-07 pairing, black on a tie), `sizeClassOf(kind)`, `CUSTOM_SIZE_RANGE`, `customSize`, `parseCustomSize`, `sizePixels(class, size, shortSide)`.
- `checkLimits(w, h)` / `scaleDownSize(w, h)` (RULE-02); `sniffFormat(bytes)` (RULE-01).
- `canvasRect(frame, padding)`, `paddingPixels(frame, size)`, `availablePaddings(frame)`,
  `clampFrame(frame, image)`, `stepDownPadding(frame, padding)` (RULE-13, RULE-14).
- `zoomIn/zoomOut/fitZoom(content, viewport)` (RULE-12).
- `hitTest(annotation, point, tolerance, shortSide, measure)`, `boundsOf(annotation, shortSide, measure)` (a text with a background: its background box, RULE-22) (stroke
  widths depend on the image's shorter side, RULE-04; `measure` is a required `TextMeasure` that sizes text from the font metrics, ADR-0020), `marqueeHits(annotations, box, shortSide, measure)` (an annotation is touched when its drawn shape, not only its bounds, meets the box; a text with a background by its background box, RULE-22), `constrain(from, to, kind)`,
  `defaultAnnotationAt(point, kind, shortSide, …)`, `redactionBox(box)`.
- `renumberSteps(annotations)` (RULE-07); `redactionCount(annotations, canvas)` (RULE-20).
- `downloadName(sourceName, localTime)` (RULE-15); `stripPngChunks(bytes)` (ADR-0007); `toNFC(before, inserted)` (RULE-08, ADR-0020); `readImageHeader(bytes)` (RULE-02, ADR-0023).

## Implements
F-002.R1/R2, F-003.R2/R4/R5, F-004.R3/R4, F-006.R2/R5, F-007.R1, F-010.R1, F-011.R1/R5/R6,
F-012.R2/R3; INV-02, INV-03, INV-05; RULE-01, RULE-02, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08,
RULE-10 (sizes), RULE-12, RULE-13, RULE-14, RULE-15, RULE-20; NFR-08. Decided by ADR-0004,
ADR-0005, ADR-0007, ADR-0019, ADR-0020, ADR-0022, ADR-0023.

SP-png-export outcome (ADR-0019): `stripPngChunks` also fails closed on unknown critical chunks, non-consecutive IDAT, CRC mismatches and bytes after IEND.

SP-text outcome (ADR-0020): text metrics constants are ascent 1.066 em and descent 0.300 em; `toNFC` for inserted text.

F-004 outcome: pen and highlight paths store the sampled pointer points as given (coalesced where the browser provides them), dropping only exact repeats; no smoothing or simplification.
