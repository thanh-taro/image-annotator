// MOD-Core fill colour and text background (F-020, RULE-22): the automatic fill colour (the annotation's
// colour) and the automatic text background colour (the RULE-07 contrast pairing of the text's colour);
// the background box (0.25 × the text size beyond the text box on every side, corner radius 0.2 × the
// text size, 70 % when translucent), around the placeholder while an edited text is empty; and the box as
// the text's area for hit-testing, bounds and the selection box (F-020.R5).
import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  contrastPairing,
  DEFAULT_STYLES,
  editorPadding,
  fillColourOf,
  hitTest,
  marqueeHits,
  textAt,
  textBackground,
  textLayout,
  type Style,
  type TextMeasure,
} from '../../src/core';

const SHORT = 800; // a 1000 × 800 image: text size M = max(16, 0.04 × 800) = 32
/** 0.5 em per code point, from the font string's size. */
const measure: TextMeasure = (font, line) => Array.from(line).length * 0.5 * parseFloat(font.split(' ')[1] ?? '0');
const text = (style: Partial<Style> = {}, s = 'Bug') =>
  textAt({ x: 100, y: 50 }, 't1', { ...DEFAULT_STYLES.text, ...style }, s);

describe('MOD-Core fill colour (RULE-22)', () => {
  it('F-020.R2 RULE-22 every tool starts with fill none and an automatic fill colour', () => {
    for (const style of Object.values(DEFAULT_STYLES)) expect(style).toMatchObject({ fillColor: 'automatic' });
    expect(DEFAULT_STYLES.rectangle.fill).toBe('none');
    expect(DEFAULT_STYLES.text.fill).toBe('none');
  });

  it('F-020.AC3 RULE-22 an automatic fill colour is the colour and follows it; a picked one is kept', () => {
    expect(fillColourOf('ellipse', { color: 'blue', fillColor: 'automatic' })).toBe('blue');
    expect(fillColourOf('ellipse', { color: 'green', fillColor: 'yellow' })).toBe('yellow');
    expect(fillColourOf('rectangle', { color: '#1e90ff', fillColor: 'automatic' })).toBe('#1e90ff');
  });

  it('F-020.AC10 RULE-07 RULE-22 an automatic text background colour is the contrast pairing of the text colour', () => {
    expect(fillColourOf('text', { color: 'red', fillColor: 'automatic' })).toBe('white');
    expect(fillColourOf('text', { color: 'blue', fillColor: 'automatic' })).toBe('white');
    expect(fillColourOf('text', { color: 'yellow', fillColor: 'automatic' })).toBe('black');
    expect(fillColourOf('text', { color: 'white', fillColor: 'automatic' })).toBe('black');
    expect(fillColourOf('text', { color: 'red', fillColor: 'yellow' })).toBe('yellow');
  });

  it('RULE-07 the contrast pairing covers the palette and custom colours (black on a tie)', () => {
    expect(['yellow', 'orange', 'green', 'white'].map((c) => contrastPairing(c as Style['color']))).toEqual([
      'black',
      'black',
      'black',
      'black',
    ]);
    expect(['red', 'blue', 'purple', 'black'].map((c) => contrastPairing(c as Style['color']))).toEqual([
      'white',
      'white',
      'white',
      'white',
    ]);
    expect(contrastPairing('#ffe4b5')).toBe('black');
    expect(contrastPairing('#2f4f4f')).toBe('white');
  });
});

describe('MOD-Core text background (RULE-22)', () => {
  it('F-020.AC8 RULE-22 at M (32) the box extends 8 pixels beyond the text box with a 6.4 corner radius, opaque when solid', () => {
    const a = text({ fill: 'solid' });
    const box = textLayout(a, SHORT, measure).box;
    const bg = textBackground(a, SHORT, measure);
    expect(bg).not.toBeNull();
    expect(bg?.box).toEqual({ x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 });
    expect(bg?.radius).toBeCloseTo(6.4, 10);
    expect(bg?.opacity).toBe(1);
  });

  it('F-020.AC9 RULE-22 a translucent background is drawn at 70 % opacity', () => {
    expect(textBackground(text({ fill: 'translucent' }), SHORT, measure)?.opacity).toBe(0.7);
  });

  it('F-020.AC12 RULE-22 a text with background none has no box', () => {
    expect(textBackground(text(), SHORT, measure)).toBeNull();
  });

  it('F-020.AC19 RULE-22 while the edited text is empty the box surrounds the placeholder at the text size', () => {
    const empty = text({ fill: 'solid' }, '');
    const bg = textBackground(empty, SHORT, measure, 'Type here');
    // "Type here" is 9 code points × 16 px = 144 px wide, one 40 px line: 8 px margin around it.
    expect(bg?.box).toEqual({ x: 92, y: 42, width: 160, height: 56 });
    // Not while it holds text: then the box surrounds the text.
    expect(textBackground(text({ fill: 'solid' }, 'B'), SHORT, measure, 'Type here')?.box.width).toBe(16 + 16);
  });

  it('F-020.AC11 RULE-22 a click 4 pixels left of the text box, in the margin, hits the text; 20 pixels out does not', () => {
    const a = text({ fill: 'solid' });
    expect(hitTest(a, { x: 96, y: 70 }, 0, SHORT, measure)).toBe(true);
    expect(hitTest(a, { x: 80, y: 70 }, 0, SHORT, measure)).toBe(false);
    // Without a background the margin is not the text's.
    expect(hitTest(text(), { x: 96, y: 70 }, 0, SHORT, measure)).toBe(false);
  });

  it('F-020.AC18 F-020.R8 the editing field covers the margin: 8 px at 100 %, 16 at 200 %, the extra height and caret room counted in', () => {
    // At M (32): the field is ceil(0.2 × 32 × z) taller than its lines and 2 px wider than its text.
    expect(editorPadding({ fill: 'solid' }, 32, 1, 7, 2)).toEqual({ top: 8, right: 6, bottom: 1, left: 8 });
    expect(editorPadding({ fill: 'translucent' }, 32, 2, 13, 2)).toEqual({ top: 16, right: 14, bottom: 3, left: 16 });
    // Zoomed far out the margin is smaller than the extra height: no negative padding.
    expect(editorPadding({ fill: 'solid' }, 32, 0.1, 1, 2)).toEqual({ top: 0.8, right: 0, bottom: 0, left: 0.8 });
    // Without a background the field keeps its stylesheet padding.
    expect(editorPadding({ fill: 'none' }, 32, 1, 7, 2)).toBeNull();
  });

  it('F-020.AC11 RULE-22 the bounds (the selection outline) and a selection box touching only the margin use the box', () => {
    const a = text({ fill: 'solid' });
    expect(boundsOf(a, SHORT, measure)).toEqual(textBackground(a, SHORT, measure)?.box);
    const marginOnly = { x: 93, y: 60, width: 4, height: 10 };
    expect(marqueeHits([a], marginOnly, SHORT, measure)).toEqual(['t1']);
    expect(marqueeHits([text()], marginOnly, SHORT, measure)).toEqual([]);
  });
});
