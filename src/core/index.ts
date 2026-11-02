// MOD-Core — domain types, limits, geometry, frame/padding/canvas maths, pure helpers
// (specs/40-technical/modules/MOD-Core.md). Pure, synchronous, dependency-free: usable on the main
// thread and in the effects worker; no DOM, clock or language. Results carry codes and numbers.
// Phase 3.3 scaffold: types, the exact constants and size tables are real; the rest throws until
// its feature is built (phase 4).
import type { Annotation, Box, Frame, ImageInfo, Padding, PaddingSize, Point, SourceType } from './types';

export * from './types';
export * from './limits';
export * from './sizes';
export * from './constants';

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Core ${name}`);
};

/** RULE-01 format sniff from the first bytes (ADR-0005); null when not a supported format. */
export function sniffFormat(_bytes: Uint8Array): SourceType | null {
  return notImplemented('sniffFormat');
}

/** RULE-14: the canvas rectangle (frame plus padding), in image pixels. */
export function canvasRect(_frame: Frame, _padding: PaddingSize): Box {
  return notImplemented('canvasRect');
}

/** RULE-14: padding in pixels on each side for a frame and a padding size. */
export function paddingPixels(_frame: Frame, _size: PaddingSize): number {
  return notImplemented('paddingPixels');
}

/** RULE-14: the padding sizes that keep the canvas within RULE-02. */
export function availablePaddings(_frame: Frame): readonly PaddingSize[] {
  return notImplemented('availablePaddings');
}

/** RULE-13: a frame clamped inside the image, at least 16 px per side (or the image's size). */
export function clampFrame(_frame: Frame, _image: Pick<ImageInfo, 'width' | 'height'>): Frame {
  return notImplemented('clampFrame');
}

/** F-011.R6: the largest padding size that still fits after a frame change. */
export function stepDownPadding(_frame: Frame, _padding: Padding): Padding {
  return notImplemented('stepDownPadding');
}

/** RULE-12 zoom levels (percent). */
export function zoomIn(_zoom: number): number {
  return notImplemented('zoomIn');
}
export function zoomOut(_zoom: number, _fit: number): number {
  return notImplemented('zoomOut');
}
export function fitZoom(_content: Box, _viewport: { width: number; height: number }): number {
  return notImplemented('fitZoom');
}

/** F-003.R2: analytic hit-test with a tolerance in image pixels. */
export function hitTest(_annotation: Annotation, _point: Point, _tolerance: number): boolean {
  return notImplemented('hitTest');
}
export function boundsOf(_annotation: Annotation): Box {
  return notImplemented('boundsOf');
}
export function marqueeHits(_annotations: readonly Annotation[], _box: Box): readonly string[] {
  return notImplemented('marqueeHits');
}

/** RULE-06 constraint of a drag (Shift held). */
export function constrain(_from: Point, _to: Point, _kind: Annotation['kind']): Point {
  return notImplemented('constrain');
}

/** RULE-05 default annotation for a click. */
export function defaultAnnotationAt(_point: Point, _kind: Annotation['kind'], _shortSide: number): Annotation {
  return notImplemented('defaultAnnotationAt');
}

/** INV-02: the redaction box extended outward to whole pixels. */
export function redactionBox(_box: Box): Box {
  return notImplemented('redactionBox');
}

/** RULE-07: steps renumbered 1…n in creation order. */
export function renumberSteps(_annotations: readonly Annotation[]): readonly Annotation[] {
  return notImplemented('renumberSteps');
}

/** RULE-20: redactions whose box overlaps the canvas. */
export function redactionCount(_annotations: readonly Annotation[], _canvas: Box): number {
  return notImplemented('redactionCount');
}

/** RULE-15 download name; the caller passes the local time (MOD-Core never reads the clock). */
export function downloadName(_sourceName: string | null, _localTime: Date): string {
  return notImplemented('downloadName');
}

/** ADR-0007 / ADR-0019 PNG chunk whitelist, failing closed. */
export function stripPngChunks(_bytes: Uint8Array): Uint8Array {
  return notImplemented('stripPngChunks');
}

/** RULE-08 / ADR-0020: NFC of the inserted text together with the preceding characters back to the last starter. */
export function toNFC(_before: string, _inserted: string): { replaceFrom: number; text: string } {
  return notImplemented('toNFC');
}
