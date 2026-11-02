// MOD-Core — exact values the specs give for the view, frame, padding, text and history.
// Implements: RULE-05 (thresholds), RULE-08 (text limit), RULE-11 (history depth), RULE-12 (zoom steps),
// RULE-13 (frame minimum), RULE-14 (padding factors); ADR-0008 (500 steps), ADR-0020 (text metrics).
import type { PaddingSize } from './types';

/** RULE-12 zoom steps in percent; the maximum is 800 %. */
export const ZOOM_STEPS = [10, 25, 50, 67, 100, 150, 200, 300, 400, 600, 800] as const;
export const ZOOM_MAX = 800;
/** RULE-12: zooming out stops at 10 % or the fit level, whichever is lower. */
export const ZOOM_MIN_STEP = 10;
/** RULE-12: Fit never goes above 100 %. */
export const FIT_MAX = 100;
/** Architecture assumption A5: on screen, the image is drawn without smoothing from 200 %. */
export const CRISP_ZOOM = 200;

/** RULE-05: a drag shorter than this (screen pixels) is a click. */
export const CLICK_THRESHOLD_PX = 4;
/** RULE-05: a click with a shape or redaction tool places it at 20 % of the shorter side. */
export const DEFAULT_SIZE_FACTOR = 0.2;
/** RULE-19: Mod+D offsets a duplicate this many image pixels right and down. */
export const DUPLICATE_OFFSET = 10;
/** RULE-19: arrow keys move 1 image pixel, 10 with Shift. */
export const NUDGE = 1;
export const NUDGE_SHIFT = 10;

/** RULE-13: the frame is at least 16 pixels in each dimension (or the image's size if smaller). */
export const FRAME_MIN = 16;

/** RULE-14: padding on every side as a fraction of the frame's longer side. */
export const PADDING_FACTOR: Readonly<Record<PaddingSize, number>> = { none: 0, S: 0.03, M: 0.06, L: 0.12 };

/** RULE-08: most code points (of the NFC text, ADR-0020) per text annotation. */
export const TEXT_MAX_CODE_POINTS = 2000;
/** Architecture assumption A4: canvas text weight and line height (× text size). */
export const TEXT_WEIGHT = 600;
export const LINE_HEIGHT = 1.25;
/** ADR-0020: Manrope ascent and descent in em, the same in both engines. */
export const ASCENT_EM = 1.066;
export const DESCENT_EM = 0.3;
/** ADR-0020: the editing field is this many em taller than the lines, so it never scrolls. */
export const EDITOR_EXTRA_EM = 0.2;
/** RULE-08: the text outline is max(1, 0.08 × text size) pixels wide. */
export const TEXT_OUTLINE_FACTOR = 0.08;
export const TEXT_OUTLINE_MIN = 1;

/** ADR-0020: offset of the first baseline from the line top: (lh − 1.366·size) / 2 + 1.066·size. */
export function baselineOffset(textSize: number): number {
  const lh = LINE_HEIGHT * textSize;
  return (lh - (ASCENT_EM + DESCENT_EM) * textSize) / 2 + ASCENT_EM * textSize;
}

/** RULE-11 keeps at least 200 steps; ADR-0008 keeps 500. */
export const HISTORY_MIN_STEPS = 200;
export const HISTORY_STEPS = 500;
