// MOD-App — the frame commands of F-010: a finished crop drag from MOD-Canvas, the arrow keys with the crop
// tool, the position and size fields (MOD-App `setFields` for the frame) and COPY-action.crop_reset (MOD-App
// `resetFrame`). Each frame change is one undo step (RULE-11) through MOD-Document `setFrame`, which steps
// the padding down in the same step when the canvas would exceed RULE-02 (F-011.R6); values are kept within
// RULE-13 by MOD-Core. When a change ends, the frame's size is announced once (CMP-Canvas "Accessibility").
// Repeated arrow-key moves or resizes of the frame with nothing in between coalesce, as RULE-11 does for a
// selection's nudges (reported as a spec gap with F-010).
// Implements: F-010.R1/R3/R5/R6, RULE-11, RULE-13, RULE-19 (arrows with the crop tool), CMP-Canvas
// "Accessibility" (COPY-crop.size announced once), CMP-StylePanel "crop".
import { t } from '../copy';
import {
  canvasRect,
  clampFrame,
  isWholeFrame,
  movedFrame,
  resizedFrame,
  wholeFrame,
  withFrameField,
  type Frame,
  type FrameField,
} from '../core';
import { setFrame } from '../document';
import { announcePolite, commit, doc, loaded, selection } from './state';

/** COPY-crop.size for a frame. */
export const cropSizeText = (frame: Frame): string => t('crop.size', { width: frame.width, height: frame.height });

/** Sets the frame (within RULE-13) as one step, announcing its size; the same frame is no step. */
function apply(next: Frame, coalesceKey?: string): void {
  const l = loaded.value;
  const d = doc.value;
  if (!l || !d) return;
  const frame = clampFrame(next, l.image.info);
  const before = l.session.epoch;
  commit(l.session.history.apply(setFrame(frame), selection.value, coalesceKey));
  if (l.session.epoch !== before) announcePolite(cropSizeText(frame));
}

/** F-010.R1: a finished crop drag from MOD-Canvas (one step). */
export function commitFrame(frame: Frame): void {
  apply(frame);
}

/** F-010.R6 / RULE-19: arrow keys with the crop tool move the frame by (dx, dy) image pixels. */
export function moveFrame(dx: number, dy: number): void {
  const l = loaded.value;
  const d = doc.value;
  if (l && d) apply(movedFrame(d.frame, dx, dy, l.image.info), 'frame-move');
}

/** F-010.R6 / RULE-19: Alt+arrows with the crop tool resize the frame by its right or bottom edge. */
export function resizeFrame(dx: number, dy: number): void {
  const l = loaded.value;
  const d = doc.value;
  if (l && d) apply(resizedFrame(d.frame, dx, dy, l.image.info), 'frame-resize');
}

/** F-010.R6 / D-008: one of the frame's position and size fields set to `value` whole image pixels (one step). */
export function setFrameField(field: FrameField, value: number): void {
  const l = loaded.value;
  const d = doc.value;
  if (l && d && Number.isFinite(value)) apply(withFrameField(d.frame, field, value, l.image.info));
}

/** F-010.R3 COPY-action.crop_reset (MOD-App `resetFrame`): the frame covers the whole image again (one step). */
export function resetFrame(): void {
  const l = loaded.value;
  if (l) apply(wholeFrame(l.image.info));
}

/**
 * CMP-StatusBar / D-017: the canvas size (the export size, RULE-15) once a crop or padding exists; null
 * while the canvas is the whole image.
 */
export function shownCanvasSize(): { readonly width: number; readonly height: number } | null {
  const l = loaded.value;
  const d = doc.value;
  if (!l || !d) return null;
  if (isWholeFrame(d.frame, l.image.info) && d.padding.size === 'none') return null;
  const c = canvasRect(d.frame, d.padding.size);
  return { width: c.width, height: c.height };
}
