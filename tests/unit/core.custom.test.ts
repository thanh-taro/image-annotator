// MOD-Core custom styles (F-019, RULE-21): custom colours as hex values, matched to the palette ignoring
// case; the RULE-07 contrast pairing of a custom colour; custom sizes in pixels with RULE-21's ranges, and
// how text, steps, strokes and highlights take them (RULE-04, RULE-08).
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  customContrast,
  CUSTOM_SIZE_RANGE,
  DEFAULT_STYLES,
  hexLabel,
  markWidth,
  pairingFor,
  parseCustomSize,
  pickedColour,
  sizeClassOf,
  sizePixels,
  stepBadge,
  strokePixels,
  textMetrics,
  textOutlineWidth,
  type Annotation,
  type Colour,
} from '../../src/core';

const PALETTE: Readonly<Record<Colour, string>> = {
  red: '#D62828',
  orange: '#F28C28',
  yellow: '#FFD60A',
  green: '#2DB84D',
  blue: '#0B63E5',
  purple: '#8E44EC',
  black: '#000000',
  white: '#FFFFFF',
};
const SHORT = 800; // a 1000 × 800 image

describe('MOD-Core custom colours (RULE-21)', () => {
  it('F-019.AC3 RULE-21 a picked value equal to a palette colour, ignoring case, is that palette colour', () => {
    expect(pickedColour('#d62828', PALETTE)).toBe('red');
    expect(pickedColour('#FFFFFF', PALETTE)).toBe('white');
    expect(pickedColour('#1E90FF', PALETTE)).toBe('#1e90ff');
    expect(pickedColour('#1e90ff', PALETTE)).toBe('#1e90ff');
    expect(pickedColour('red', PALETTE)).toBeNull();
    expect(pickedColour('#12345', PALETTE)).toBeNull();
  });

  it('F-019.AC13 COPY-style.color_custom_value shows the hex in uppercase', () => {
    expect(hexLabel('#1e90ff')).toBe('#1E90FF');
  });

  it('F-019.AC2 RULE-07 a custom colour pairs with black or white by contrast ratio: black on #ffe4b5, white on #2f4f4f', () => {
    expect(customContrast('#ffe4b5')).toBe('black');
    expect(customContrast('#2f4f4f')).toBe('white');
    expect(customContrast('#1e90ff')).toBe('black');
    expect(customContrast('#000001')).toBe('white');
  });

  it('RULE-07 a tie in contrast ratio pairs with black; contrast ratios follow WCAG', () => {
    expect(pairingFor(4.58, 4.58)).toBe('black');
    expect(pairingFor(4.5, 4.6)).toBe('white');
    expect(pairingFor(4.6, 4.5)).toBe('black');
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 6);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 6);
  });
});

describe('MOD-Core custom sizes (RULE-21)', () => {
  it('RULE-21 sizing classes and their ranges: stroke 1–100, highlight 1–300, text 6–400', () => {
    expect(sizeClassOf('rectangle')).toBe('stroke');
    expect(sizeClassOf('ellipse')).toBe('stroke');
    expect(sizeClassOf('line')).toBe('stroke');
    expect(sizeClassOf('arrow')).toBe('stroke');
    expect(sizeClassOf('stroke')).toBe('stroke');
    expect(sizeClassOf('highlight')).toBe('highlight');
    expect(sizeClassOf('text')).toBe('text');
    expect(sizeClassOf('step')).toBe('text');
    expect(sizeClassOf('redaction')).toBeNull();
    expect(CUSTOM_SIZE_RANGE).toEqual({
      stroke: { min: 1, max: 100 },
      highlight: { min: 1, max: 300 },
      text: { min: 6, max: 400 },
    });
  });

  it('F-019.AC8 F-019.R5 0, -3, 7.5, 5000 and "abc" become 1, 1, 8, 100, or nothing (the shown value stays)', () => {
    expect(parseCustomSize('stroke', '0')).toBe(1);
    expect(parseCustomSize('stroke', '-3')).toBe(1);
    expect(parseCustomSize('stroke', '7.5')).toBe(8);
    expect(parseCustomSize('stroke', '5000')).toBe(100);
    expect(parseCustomSize('stroke', 'abc')).toBeNull();
    expect(parseCustomSize('stroke', '')).toBeNull();
    expect(parseCustomSize('stroke', '  ')).toBeNull();
    expect(parseCustomSize('text', '2')).toBe(6);
    expect(parseCustomSize('highlight', '301')).toBe(300);
    expect(parseCustomSize('stroke', '6.49')).toBe(6);
  });

  it('F-019.AC4 F-019.AC6 RULE-21 the field shows a preset’s width for the image: M stroke 5, L highlight 30', () => {
    expect(sizePixels('stroke', 'M', SHORT)).toBe(5);
    expect(sizePixels('stroke', 'L', SHORT)).toBe(10);
    expect(sizePixels('highlight', 'L', SHORT)).toBe(30);
    expect(sizePixels('text', 'M', SHORT)).toBe(32);
    expect(sizePixels('stroke', 7, SHORT)).toBe(7);
  });

  it('RULE-21 with no image a preset has no width in pixels; a custom size still has', () => {
    expect(sizePixels('stroke', 'M', null)).toBeNull();
    expect(sizePixels('stroke', 7, null)).toBe(7);
  });

  it('F-019.AC5 RULE-08 a custom text size 64 is 64 px high with an outline of max(1, 0.08 × 64) = 5.12', () => {
    const m = textMetrics({ ...DEFAULT_STYLES.text, strokeSize: 64 }, SHORT);
    expect(m.size).toBe(64);
    expect(m.font).toContain('64px');
    expect(textOutlineWidth(m.size)).toBeCloseTo(5.12, 10);
  });

  it('F-019.AC5 RULE-07 RULE-21 a step at a custom 64 is a badge 128 pixels across', () => {
    const step: Extract<Annotation, { kind: 'step' }> = {
      id: 's',
      kind: 'step',
      style: { ...DEFAULT_STYLES.step, strokeSize: 64 },
      centre: { x: 100, y: 100 },
      number: 1,
    };
    const b = stepBadge(step, SHORT);
    expect(b.width).toBe(128);
    expect(b.height).toBe(128);
    expect(b.textSize).toBe(64);
  });

  it('F-019.AC4 F-019.AC6 RULE-21 a custom size is the stroke width, or a highlight’s whole width', () => {
    expect(strokePixels({ ...DEFAULT_STYLES.rectangle, strokeSize: 7 }, SHORT)).toBe(7);
    const highlight: Annotation = {
      id: 'h',
      kind: 'highlight',
      style: { ...DEFAULT_STYLES.highlight, strokeSize: 40 },
      points: [{ x: 0, y: 0 }],
    };
    expect(markWidth(highlight, SHORT)).toBe(40);
    const pen: Annotation = { ...highlight, kind: 'stroke', style: { ...DEFAULT_STYLES.pen, strokeSize: 7 } };
    expect(markWidth(pen, SHORT)).toBe(7);
    // A preset is unchanged: M on a 1000 × 800 image is 5, a highlight at L is 3 × 10.
    expect(markWidth({ ...highlight, style: DEFAULT_STYLES.highlight }, SHORT)).toBe(30);
  });

  it('F-019.AC11 RULE-21 a custom size is kept in pixels whatever the image', () => {
    const style = { ...DEFAULT_STYLES.rectangle, strokeSize: 7 };
    expect(strokePixels(style, 100)).toBe(7);
    expect(strokePixels(style, 4000)).toBe(7);
  });
});
