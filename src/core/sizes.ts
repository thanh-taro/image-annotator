// MOD-Core — the RULE-04 and RULE-10 size tables, relative to the image's shorter side `s`.
// Implements: RULE-04 (stroke, text, step badge, highlight sizes), RULE-10 (blur radius, pixelate block),
// RULE-21 (a custom size in pixels, F-019).
// Sizes are rounded to the nearest whole pixel (rules.md preamble).
import type { Size, StyleSize } from './types';

/** `max(min, factor · s)` per size, as written in the rules. */
interface Scale {
  readonly min: number;
  readonly factor: number;
}
type Table = Readonly<Record<Size, Scale>>;

/** RULE-04 stroke sizes: S = max(2, 0.003·s), M = max(3, 0.006·s), L = max(6, 0.012·s). */
export const STROKE: Table = {
  S: { min: 2, factor: 0.003 },
  M: { min: 3, factor: 0.006 },
  L: { min: 6, factor: 0.012 },
};
/** RULE-04 text sizes: S = max(12, 0.025·s), M = max(16, 0.04·s), L = max(24, 0.06·s). */
export const TEXT: Table = {
  S: { min: 12, factor: 0.025 },
  M: { min: 16, factor: 0.04 },
  L: { min: 24, factor: 0.06 },
};
/** RULE-10 blur radius and pixelate block: max(6, 0.01·s) / max(10, 0.02·s) / max(16, 0.04·s). */
export const REDACTION: Table = {
  S: { min: 6, factor: 0.01 },
  M: { min: 10, factor: 0.02 },
  L: { min: 16, factor: 0.04 },
};
/** RULE-04: a step badge's diameter is 2 × the text size; a highlight is 3 × the stroke size. */
export const STEP_DIAMETER_PER_TEXT = 2;
export const HIGHLIGHT_PER_STROKE = 3;
/** RULE-04: translucent fill opacity; RULE-09: highlight opacity. */
export const TRANSLUCENT_FILL_OPACITY = 0.3;
export const HIGHLIGHT_OPACITY = 0.4;

const scaled = ({ min, factor }: Scale, s: number) => Math.round(Math.max(min, factor * s));

export interface StyleSizes {
  readonly stroke: number;
  readonly text: number;
  readonly stepDiameter: number;
  readonly highlight: number;
  readonly blurRadius: number;
  readonly pixelateBlock: number;
}

/** Every size in pixels for one S/M/L choice on an image whose shorter side is `shortSide`. */
export function styleSizes(shortSide: number, size: Size): StyleSizes {
  const stroke = scaled(STROKE[size], shortSide);
  const text = scaled(TEXT[size], shortSide);
  const redaction = scaled(REDACTION[size], shortSide);
  return {
    stroke,
    text,
    stepDiameter: STEP_DIAMETER_PER_TEXT * text,
    highlight: HIGHLIGHT_PER_STROKE * stroke,
    blurRadius: redaction,
    pixelateBlock: redaction,
  };
}

/**
 * RULE-04 / RULE-21: the stroke size in pixels — a custom size is the stroke itself, kept in pixels
 * whatever the image (F-019).
 */
export const strokeSizeOf = (shortSide: number, size: StyleSize): number =>
  typeof size === 'number' ? size : styleSizes(shortSide, size).stroke;

/** RULE-04 / RULE-21: the text size in pixels of text and steps — a custom size is the text size itself. */
export const textSizeOf = (shortSide: number, size: StyleSize): number =>
  typeof size === 'number' ? size : styleSizes(shortSide, size).text;

/** RULE-04 / RULE-21: a highlight's width in pixels — 3 × its preset's stroke size, or a custom width. */
export const highlightWidthOf = (shortSide: number, size: StyleSize): number =>
  typeof size === 'number' ? size : styleSizes(shortSide, size).highlight;
