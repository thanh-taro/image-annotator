// MOD-Core — redaction geometry: the outward-rounded box (INV-02), the RULE-10 effect size, the solids
// an effect depends on, and the RULE-20 count. Pure; coordinates are image pixels.
// Implements: INV-02 (a redaction covers every pixel its box touches), RULE-10 (sizes; blur and pixelate
// read only frame pixels with every solid applied), RULE-20 (the redaction count), ADR-0006 (B, O, window).
import { styleSizes } from './sizes';
import type { Annotation, Box, Style } from './types';

/** A redaction annotation (ENT-Annotation kind `redaction`). */
export type RedactionAnnotation = Extract<Annotation, { readonly box: Box }> & { readonly kind: 'redaction' };

export const isRedaction = (a: Annotation): a is RedactionAnnotation => a.kind === 'redaction';
/** RULE-10 solid: fully opaque, hard edges, in its palette colour. */
export const isSolidRedaction = (a: Annotation): a is RedactionAnnotation =>
  a.kind === 'redaction' && a.style.redactionKind === 'solid';
/** RULE-10 blur and pixelate: computed from frame pixels (ADR-0006), labelled not secure. */
export const isEffectRedaction = (a: Annotation): a is RedactionAnnotation =>
  a.kind === 'redaction' && a.style.redactionKind !== 'solid';

/** INV-02 / ADR-0006 B: the box extended outward to whole pixels (x0 = ⌊x⌋, x1 = ⌈x + width⌉). */
export function redactionBox(box: Box): Box {
  const x0 = Math.floor(Math.min(box.x, box.x + box.width));
  const y0 = Math.floor(Math.min(box.y, box.y + box.height));
  const x1 = Math.ceil(Math.max(box.x, box.x + box.width));
  const y1 = Math.ceil(Math.max(box.y, box.y + box.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The overlap of two boxes, or null when they share no area. */
export function intersectBoxes(a: Box, b: Box): Box | null {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** RULE-10: the blur radius or pixelate block of a redaction's strength, in pixels. */
export function effectSize(style: Style, shortSide: number): number {
  const sizes = styleSizes(shortSide, style.strength);
  return style.redactionKind === 'pixelate' ? sizes.pixelateBlock : sizes.blurRadius;
}

/** ADR-0006: a blur pass reaches b = ⌊(r + 1) / 2⌋ pixels; three rounds reach 3b. */
export const blurReach = (radius: number): number => Math.floor((radius + 1) / 2);

/**
 * ADR-0006 output area O = B ∩ F and the window of frame pixels the effect reads: O ± 3b (blur) or O
 * itself (pixelate), clamped to the frame. Null when the box lies wholly outside the frame.
 */
export function effectArea(
  box: Box,
  kind: 'blur' | 'pixelate',
  size: number,
  frame: Box,
): { readonly output: Box; readonly window: Box } | null {
  const output = intersectBoxes(redactionBox(box), frame);
  if (!output) return null;
  if (kind === 'pixelate') return { output, window: output };
  const r = 3 * blurReach(size);
  const grown = { x: output.x - r, y: output.y - r, width: output.width + 2 * r, height: output.height + 2 * r };
  return { output, window: intersectBoxes(grown, frame) ?? output };
}

/** RULE-10 / INV-02: the solid redactions whose pixels lie in `window` (an effect reads them as their colour). */
export function solidsTouching(annotations: readonly Annotation[], window: Box): RedactionAnnotation[] {
  return annotations.filter(
    (a): a is RedactionAnnotation => isSolidRedaction(a) && intersectBoxes(redactionBox(a.box), window) !== null,
  );
}

/** RULE-20: the number of redactions (any kind) whose box overlaps the canvas (what is exported, RULE-15). */
export function redactionCount(annotations: readonly Annotation[], canvas: Box): number {
  return annotations.filter((a) => isRedaction(a) && intersectBoxes(redactionBox(a.box), canvas) !== null).length;
}
