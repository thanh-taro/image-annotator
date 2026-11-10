// MOD-Core text geometry and input rules (F-005, RULE-08, ADR-0009, ADR-0020): the layout of a text
// annotation (anchor top-left, lines only at typed new lines, lines × line height tall), its hit box
// and caret mapping, the composed-form (NFC) insertion back to the last starter and the 2,000
// code-point limit. Widths come from a measuring function; here a fake one (0.5 em per code point).
import { describe, expect, it } from 'vitest';
import {
  baselineOffset,
  boundsOf,
  caretIndexAt,
  DEFAULT_STYLES,
  handlesOf,
  hitTest,
  isBlankText,
  moved,
  textAt,
  textInsertion,
  textLayout,
  textOutlineWidth,
  toNFC,
  TEXT_MAX_CODE_POINTS,
  type TextAnnotation,
  type TextMeasure,
} from '../../src/core';

/** 0.5 em per code point, at the font's pixel size (`600 <size>px Manrope`). */
const fake: TextMeasure = (font, s) => Array.from(s).length * 0.5 * parseFloat(font.split(' ')[1] ?? '0');
const text = (s: string, x = 100, y = 50): TextAnnotation => textAt({ x, y }, 't1', DEFAULT_STYLES.text, s);
// On a 1000 × 800 image, size M text is max(16, 0.04 · 800) = 32 px; the line height 40 px.
const SHORT = 800;

describe('MOD-Core text layout', () => {
  it('F-005.AC1 RULE-08 the anchor is the top-left corner of the text box, in the tool face at the style size', () => {
    const L = textLayout(text('Wrong total'), SHORT, fake);
    expect(L.size).toBe(32);
    expect(L.font).toBe('600 32px Manrope');
    expect(L.box).toEqual({ x: 100, y: 50, width: 11 * 16, height: 40 });
  });

  it('F-005.AC2 RULE-08 lines break only at typed new lines; the box is lines × line height and the widest line', () => {
    const L = textLayout(text('Wrong total\nis $118'), SHORT, fake);
    expect(L.lines).toEqual(['Wrong total', 'is $118']);
    expect(L.box.height).toBe(80);
    expect(L.box.width).toBe(11 * 16);
    expect(textLayout(text('a\n\nb'), SHORT, fake).lines).toEqual(['a', '', 'b']);
  });

  it('ADR-0020 the first baseline is (lh − 1.366·size) / 2 + 1.066·size below the line top', () => {
    const L = textLayout(text('x'), SHORT, fake);
    expect(L.baseline).toBeCloseTo(baselineOffset(32), 9);
    expect(L.baseline).toBeCloseTo((40 - 1.366 * 32) / 2 + 1.066 * 32, 9);
  });

  it('RULE-04 text sizes S, M and L follow the image’s shorter side', () => {
    const at = (strokeSize: 'S' | 'M' | 'L', s: number) =>
      textLayout(textAt({ x: 0, y: 0 }, 't', { ...DEFAULT_STYLES.text, strokeSize }, 'x'), s, fake).size;
    expect([at('S', 100), at('M', 100), at('L', 100)]).toEqual([12, 16, 24]);
    expect([at('S', 2000), at('M', 2000), at('L', 2000)]).toEqual([50, 80, 120]);
  });

  it('RULE-08 the outline is max(1, 0.08 × text size) pixels wide', () => {
    expect(textOutlineWidth(12)).toBe(1);
    expect(textOutlineWidth(32)).toBeCloseTo(2.56, 9);
  });

  it('RULE-08 text that is empty or only whitespace counts as blank', () => {
    expect(isBlankText('')).toBe(true);
    expect(isBlankText(' \n\t ')).toBe(true);
    expect(isBlankText(' a ')).toBe(false);
  });

  it('F-008.R3 RULE-08 text has no handles; it moves by its anchor; it is hit anywhere on its box', () => {
    const a = text('Bug');
    expect(handlesOf(a, 800)).toEqual([]);
    expect(moved(a, 10, 10)).toMatchObject({ anchor: { x: 110, y: 60 }, text: 'Bug' });
    expect(boundsOf(a, SHORT, fake)).toEqual({ x: 100, y: 50, width: 48, height: 40 });
    expect(hitTest(a, { x: 120, y: 70 }, 0, SHORT, fake)).toBe(true);
    expect(hitTest(a, { x: 150, y: 92 }, 3, SHORT, fake)).toBe(true);
    expect(hitTest(a, { x: 160, y: 70 }, 3, SHORT, fake)).toBe(false);
  });

  it('F-005.AC5 the caret goes to the character boundary nearest the click, on the clicked line', () => {
    const a = text('abcd\nef');
    // 16 px per character at size M; line 2 starts at index 5.
    expect(caretIndexAt(a, { x: 100 + 33, y: 60 }, SHORT, fake)).toBe(2);
    expect(caretIndexAt(a, { x: 100 + 7, y: 60 }, SHORT, fake)).toBe(0);
    expect(caretIndexAt(a, { x: 100 + 200, y: 60 }, SHORT, fake)).toBe(4);
    expect(caretIndexAt(a, { x: 100 + 17, y: 50 + 45 }, SHORT, fake)).toBe(6);
    expect(caretIndexAt(a, { x: 100, y: 500 }, SHORT, fake)).toBe(5);
    // Never between a letter and its accent mark.
    expect(caretIndexAt(text('êx'), { x: 100 + 16, y: 60 }, SHORT, fake)).not.toBe(1);
  });
});

describe('MOD-Core composed input (RULE-08, ADR-0020)', () => {
  const DUONG_NFD = 'Đường';

  it('F-005.AC15 pasted decomposed "Đường" is kept composed, as 5 characters', () => {
    const r = textInsertion('', 0, 0, DUONG_NFD);
    expect(r.text).toBe('Đường');
    expect(Array.from(r.text)).toHaveLength(5);
    expect(r.text).toBe(r.text.normalize('NFC'));
  });

  it('ADR-0020 an accent typed after an existing letter composes with it (back to the last starter)', () => {
    expect(toNFC('Tie', '̂')).toEqual({ replaceFrom: 2, text: 'ê' });
    expect(toNFC('Tiê', '́')).toEqual({ replaceFrom: 2, text: 'ế' });
    expect(toNFC('ab', 'c')).toEqual({ replaceFrom: 2, text: 'c' });
    expect(toNFC('', 'ê')).toEqual({ replaceFrom: 0, text: 'ê' });
    // A mark that composes with nothing stays as typed.
    expect(toNFC('x', '́')).toEqual({ replaceFrom: 1, text: '́' });
  });

  it('F-005.AC8 RULE-08 the 2,001st typed character is not accepted', () => {
    const full = 'a'.repeat(TEXT_MAX_CODE_POINTS);
    expect(textInsertion(full, 2000, 2000, 'b')).toEqual({ from: 2000, to: 2000, text: '' });
    // Typing over a selection replaces it, so it fits.
    expect(textInsertion(full, 0, 1, 'b')).toEqual({ from: 0, to: 1, text: 'b' });
  });

  it('F-005.AC8 RULE-08 a paste of 3,000 characters into an empty text keeps the first 2,000', () => {
    const r = textInsertion('', 0, 0, 'x'.repeat(3000));
    expect(Array.from(r.text)).toHaveLength(2000);
  });

  it('F-005.AC15 with 1,999 characters, a pasted e + U+0302 + U+0301 is kept as "ế", making 2,000', () => {
    const before = 'a'.repeat(1999);
    const r = textInsertion(before, 1999, 1999, 'ế');
    expect(r).toEqual({ from: 1999, to: 1999, text: 'ế' });
    expect(Array.from(before + r.text)).toHaveLength(2000);
  });

  it('RULE-08 the limit counts code points of the composed text, so astral letters count once', () => {
    const r = textInsertion('a'.repeat(1998), 1998, 1998, '😀😀😀');
    expect(r.text).toBe('😀😀');
  });

  it('RULE-08 an accent at the limit still composes with the letter before the caret', () => {
    const before = 'a'.repeat(1999) + 'e';
    expect(textInsertion(before, 2000, 2000, '̂')).toEqual({ from: 1999, to: 2000, text: 'ê' });
  });
});
