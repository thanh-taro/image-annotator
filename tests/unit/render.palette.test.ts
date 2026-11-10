// MOD-Render palette constants generated from tokens.json (RULE-04, RULE-07, ADR-0013).
import { describe, expect, it } from 'vitest';
import { PALETTE_NAMES } from '../../src/core';
import { contrastPair, PALETTE, colourValue } from '../../src/render';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('MOD-Render palette', () => {
  it('RULE-04 the generated palette has the eight colours in order', () => {
    expect(PALETTE).toEqual(PALETTE_NAMES);
  });

  it('RULE-07 every contrast pairing is at least 4.5:1 with the palette values', () => {
    for (const name of PALETTE) {
      expect(ratio(colourValue(name), colourValue(contrastPair(name)))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('RULE-07 black pairs with yellow, orange, green and white; white with the rest', () => {
    expect(PALETTE.filter((c) => contrastPair(c) === 'black')).toEqual(['orange', 'yellow', 'green', 'white']);
  });
});
