// MOD-Core — text annotations (F-005): layout, box, hit-testing, caret mapping, and the input rules
// (composed form and the 2,000 code-point limit). Promoted from the SP-text spike (ADR-0009, ADR-0020)
// and adapted to the domain types. Pure: line widths come from a `TextMeasure` the caller passes
// (MOD-Render and MOD-Canvas measure with a Canvas 2D context in the tool's face), since MOD-Core has
// no DOM. Coordinates are image pixels.
// Implements: F-005.R1 (anchor = top-left), F-005.R2 (lines, limit, composed form), F-005.R4 (caret
// where clicked), RULE-04 (text sizes), RULE-08, ADR-0009 §1/§3, ADR-0020 (NFC back to the last
// starter, metrics, text box = lines × line height).
import {
  baselineOffset,
  LINE_HEIGHT,
  TEXT_MAX_CODE_POINTS,
  TEXT_OUTLINE_FACTOR,
  TEXT_OUTLINE_MIN,
  TEXT_WEIGHT,
} from './constants';
import { styleSizes } from './sizes';
import type { Annotation, Box, Point, Style } from './types';

export type TextAnnotation = Extract<Annotation, { readonly kind: 'text' }>;
export const isTextAnnotation = (a: Annotation): a is TextAnnotation => a.kind === 'text';

/** The advance width of `line` drawn in `font` (a CSS font string), in that font's pixels. */
export type TextMeasure = (font: string, line: string) => number;

/** ADR-0009 §1: the canvas font of a text size (the tool's face, weight 600). */
export const textFont = (size: number): string => `${TEXT_WEIGHT} ${size}px Manrope`;

/** F-005.R1: a text annotation whose top-left corner is `anchor`. */
export const textAt = (anchor: Point, id: string, style: Style, text = ''): TextAnnotation => ({
  id,
  kind: 'text',
  style,
  anchor: { x: anchor.x, y: anchor.y },
  text,
});

/** RULE-08: lines break only where the user typed a new line. */
export const textLines = (text: string): readonly string[] => text.split('\n');

/** RULE-08: the outline is max(1, 0.08 × text size) pixels wide. */
export const textOutlineWidth = (size: number): number => Math.max(TEXT_OUTLINE_MIN, TEXT_OUTLINE_FACTOR * size);

/** RULE-08: text whose content is empty or only whitespace when editing ends is removed. */
export const isBlankText = (text: string): boolean => text.trim() === '';

/** The size-dependent part of a text's layout (no measuring needed). */
export interface TextMetrics {
  /** RULE-04 text size in pixels. */
  readonly size: number;
  readonly font: string;
  /** Assumption A4: 1.25 × the size. */
  readonly lineHeight: number;
  /** ADR-0020: the first line's alphabetic baseline, below the anchor. */
  readonly baseline: number;
}

export function textMetrics(style: Style, shortSide: number): TextMetrics {
  const size = styleSizes(shortSide, style.strokeSize).text;
  return { size, font: textFont(size), lineHeight: LINE_HEIGHT * size, baseline: baselineOffset(size) };
}

export interface TextLayout extends TextMetrics {
  readonly lines: readonly string[];
  readonly widths: readonly number[];
  /**
   * ADR-0020: the box for hit-testing, selection and handles — as wide as the longest line and lines ×
   * line height tall, with its top-left corner at the anchor; glyph overflow above and below is not in it.
   */
  readonly box: Box;
}

export function textLayout(
  a: Pick<TextAnnotation, 'anchor' | 'text' | 'style'>,
  shortSide: number,
  measure: TextMeasure,
): TextLayout {
  const m = textMetrics(a.style, shortSide);
  const lines = textLines(a.text);
  const widths = lines.map((line) => (line ? measure(m.font, line) : 0));
  const box = { x: a.anchor.x, y: a.anchor.y, width: Math.max(0, ...widths), height: lines.length * m.lineHeight };
  return { ...m, lines, widths, box };
}

/** CMP-Canvas: a click hits a text anywhere on its box (within `tolerance` image pixels). */
export function hitsText(
  a: TextAnnotation,
  p: Point,
  tolerance: number,
  shortSide: number,
  measure: TextMeasure,
): boolean {
  const { box: b } = textLayout(a, shortSide, measure);
  return (
    p.x >= b.x - tolerance &&
    p.x <= b.x + b.width + tolerance &&
    p.y >= b.y - tolerance &&
    p.y <= b.y + b.height + tolerance
  );
}

const MARK = /\p{M}/u;

/**
 * F-005.AC5: the caret index (UTF-16, for the text field) nearest to image point `p`: the clicked line
 * (clamped to the first and last), then the character boundary whose x is closest. A boundary between a
 * letter and its accent mark is never chosen.
 */
export function caretIndexAt(a: TextAnnotation, p: Point, shortSide: number, measure: TextMeasure): number {
  const m = textMetrics(a.style, shortSide);
  const lines = textLines(a.text);
  const row = Math.min(lines.length - 1, Math.max(0, Math.floor((p.y - a.anchor.y) / m.lineHeight)));
  let start = 0;
  for (let i = 0; i < row; i++) start += (lines[i] ?? '').length + 1;
  const line = lines[row] ?? '';
  const x = p.x - a.anchor.x;
  let best = 0;
  let bestDistance = Math.abs(x);
  let i = 0;
  for (const ch of line) {
    i += ch.length;
    const next = line.slice(i);
    if (next && MARK.test(String.fromCodePoint(next.codePointAt(0) ?? 0))) continue;
    const d = Math.abs(x - measure(m.font, line.slice(0, i)));
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  }
  return start + best;
}

/** The UTF-16 index of the code point boundary before `i` in `s`. */
function previousBoundary(s: string, i: number): number {
  const low = s.charCodeAt(i - 1);
  const high = s.charCodeAt(i - 2);
  return low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff ? i - 2 : i - 1;
}

/**
 * ADR-0020 / RULE-08: the inserted text in composed form (NFC) together with the preceding characters
 * back to the last starter — the nearest boundary before which nothing combines with what follows —
 * so an accent typed after an existing letter composes with it. `before` is the text before the caret
 * (already composed); the result replaces `before.slice(replaceFrom)` plus the insertion.
 */
export function toNFC(before: string, inserted: string): { replaceFrom: number; text: string } {
  const whole = (before + inserted).normalize('NFC');
  for (let j = before.length; j > 0; j = previousBoundary(before, j)) {
    const tail = (before.slice(j) + inserted).normalize('NFC');
    if (before.slice(0, j) + tail === whole) return { replaceFrom: j, text: tail };
  }
  return { replaceFrom: 0, text: whole };
}

const codePoints = (s: string): number => {
  let n = 0;
  for (const _ of s) n++;
  return n;
};

/** The first `n` code points of `s`. */
function firstCodePoints(s: string, n: number): string {
  let out = '';
  let k = 0;
  for (const ch of s) {
    if (k++ >= n) break;
    out += ch;
  }
  return out;
}

/**
 * RULE-08 / ADR-0009 §3 / ADR-0020: what an insertion into a text field holding `value`, with the
 * selection `start`–`end` (UTF-16), becomes: `value.slice(from, to)` is replaced with `text`. The text
 * is composed (NFC) back to the last starter and cut so the whole stays within `max` code points of the
 * composed text; a typed character beyond the limit is not accepted (`text` holds only what was already
 * there). When the result equals the plain insertion, `from === start` and `text` is the insertion.
 */
export function textInsertion(
  value: string,
  start: number,
  end: number,
  inserted: string,
  max = TEXT_MAX_CODE_POINTS,
): { from: number; to: number; text: string } {
  const before = value.slice(0, start);
  const { replaceFrom, text } = toNFC(before, inserted);
  const kept = codePoints(value.slice(0, replaceFrom)) + codePoints(value.slice(end));
  const room = Math.max(0, max - kept);
  const existing = before.slice(replaceFrom);
  let fitted = codePoints(text) <= room ? text : firstCodePoints(text, room);
  // Never cut into the characters that were already there (only re-composed): then nothing is inserted.
  if (codePoints(fitted) < codePoints(existing)) fitted = existing;
  if (fitted === existing) return { from: start, to: end, text: '' };
  return { from: replaceFrom, to: end, text: fitted };
}
