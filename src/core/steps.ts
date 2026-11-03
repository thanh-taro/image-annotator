// MOD-Core — step numbering and badge geometry (F-006). Pure; coordinates are image pixels.
// Implements: F-006.R1/R2/R4/R5, RULE-04 (badge diameter = 2 × the text size), RULE-07 (numbers 1…n in
// creation order, renumbering after a delete, the pill from three digits, plain digits).
// Creation order is the order of the numbers themselves: numbers are always 1…n in creation order, so
// sorting the steps by number recovers it after any delete or reorder, with no extra field.
// Digit metrics are Manrope's at weight 600 (ADR-0009), measured once in Chromium and WebKit (both
// give the same values): the digits are 0.72 em tall and at most 0.642 em wide.
import { TEXT_WEIGHT } from './constants';
import { styleSizes } from './sizes';
import type { Annotation, Box, Point, Style } from './types';

export type StepAnnotation = Extract<Annotation, { readonly kind: 'step' }>;
export const isStepAnnotation = (a: Annotation): a is StepAnnotation => a.kind === 'step';

/** Manrope 600: the height of the digits (they sit on the baseline) and the widest digit's advance, in em. */
export const STEP_DIGIT_HEIGHT_EM = 0.72;
export const STEP_DIGIT_ADVANCE_EM = 0.642;
/** RULE-07: from this many digits the badge is a pill instead of a circle. */
export const STEP_PILL_DIGITS = 3;

/** RULE-07: the number a new (or duplicated) step gets: one more than the highest, so 1 for the first. */
export function nextStepNumber(annotations: readonly Annotation[]): number {
  let max = 0;
  for (const a of annotations) if (a.kind === 'step' && a.number > max) max = a.number;
  return max + 1;
}

/**
 * RULE-07: the steps renumbered 1…n in creation order (the order of their current numbers), so the
 * numbers stay consecutive after a delete. Drawing order is never changed and never matters. Returns
 * the same array when nothing changes; unchanged annotations are shared.
 */
export function renumberSteps(annotations: readonly Annotation[]): readonly Annotation[] {
  const order = annotations
    .map((a, i) => ({ a, i }))
    .filter((e): e is { a: StepAnnotation; i: number } => e.a.kind === 'step')
    .sort((p, q) => p.a.number - q.a.number || p.i - q.i);
  const wanted = new Map(order.map((e, k) => [e.i, k + 1]));
  if (order.every((e, k) => e.a.number === k + 1)) return annotations;
  return annotations.map((a, i) => {
    const n = wanted.get(i);
    return n === undefined || (a.kind === 'step' && a.number === n) ? a : ({ ...a, number: n } as Annotation);
  });
}

/** F-006.R1/R4: a step centred on `point`; its number is given when it is added (MOD-Document `add`). */
export const stepAt = (point: Point, id: string, style: Style, number = 0): Annotation => ({
  id,
  kind: 'step',
  style,
  centre: { x: point.x, y: point.y },
  number,
});

/** How a step badge is drawn (MOD-Render) and hit (here): all in image pixels. */
export interface StepBadge {
  readonly centre: Point;
  /** The circle's diameter, or the pill's width from three digits. */
  readonly width: number;
  readonly height: number;
  /** RULE-04: the text size of the step's size; the badge is twice as tall. */
  readonly textSize: number;
  /** The number as plain digits in every language (RULE-07). */
  readonly label: string;
  /** The alphabetic baseline that centres the digits vertically on the badge. */
  readonly baseline: number;
  /** The canvas font (ADR-0009: the tool's face, weight 600, at the text size). */
  readonly font: string;
}

/**
 * RULE-04 / RULE-07: a filled circle of 2 × the text size, or from three digits a pill of the same
 * height whose width is the digits' width plus one text size, never narrower than the circle.
 */
export function stepBadge(a: StepAnnotation, shortSide: number): StepBadge {
  const { text, stepDiameter } = styleSizes(shortSide, a.style.strokeSize);
  const label = String(Math.trunc(a.number));
  const width =
    label.length >= STEP_PILL_DIGITS
      ? Math.max(stepDiameter, Math.ceil(label.length * STEP_DIGIT_ADVANCE_EM * text + text))
      : stepDiameter;
  return {
    centre: a.centre,
    width,
    height: stepDiameter,
    textSize: text,
    label,
    baseline: a.centre.y + (STEP_DIGIT_HEIGHT_EM * text) / 2,
    font: `${TEXT_WEIGHT} ${text}px Manrope`,
  };
}

/** The box of a step's badge (its visible mark; the selection outline sits on it). */
export function stepBox(a: StepAnnotation, shortSide: number): Box {
  const b = stepBadge(a, shortSide);
  return { x: b.centre.x - b.width / 2, y: b.centre.y - b.height / 2, width: b.width, height: b.height };
}

/** Distance from `p` to the filled badge (0 inside): a circle, or a pill (a segment widened by the radius). */
export function distanceToStep(a: StepAnnotation, p: Point, shortSide: number): number {
  const b = stepBadge(a, shortSide);
  const r = b.height / 2;
  const half = Math.max(0, b.width / 2 - r);
  const dx = Math.max(0, Math.abs(p.x - b.centre.x) - half);
  const dy = p.y - b.centre.y;
  return Math.max(0, Math.hypot(dx, dy) - r);
}
