// MOD-Core size tables and constants (RULE-04, RULE-10, RULE-12, RULE-14; ADR-0020).
import { describe, expect, it } from 'vitest';
import { baselineOffset, PADDING_FACTOR, styleSizes, ZOOM_STEPS } from '../../src/core';

describe('MOD-Core sizes', () => {
  it('RULE-04 stroke and text sizes use their minimums on small images', () => {
    expect(styleSizes(100, 'S')).toMatchObject({ stroke: 2, text: 12, stepDiameter: 24, highlight: 6 });
    expect(styleSizes(100, 'M')).toMatchObject({ stroke: 3, text: 16, stepDiameter: 32, highlight: 9 });
    expect(styleSizes(100, 'L')).toMatchObject({ stroke: 6, text: 24, stepDiameter: 48, highlight: 18 });
  });

  it('RULE-04 sizes scale with the shorter side and round to whole pixels', () => {
    // s = 1800: S stroke 0.003·1800 = 5.4 → 5; M text 0.04·1800 = 72; L stroke 0.012·1800 = 21.6 → 22.
    expect(styleSizes(1800, 'S').stroke).toBe(5);
    expect(styleSizes(1800, 'M').text).toBe(72);
    expect(styleSizes(1800, 'L').stroke).toBe(22);
    expect(styleSizes(1800, 'L').highlight).toBe(66);
  });

  it('RULE-10 blur radius and pixelate block share one table', () => {
    expect(styleSizes(100, 'S')).toMatchObject({ blurRadius: 6, pixelateBlock: 6 });
    expect(styleSizes(1800, 'M')).toMatchObject({ blurRadius: 36, pixelateBlock: 36 });
    expect(styleSizes(1800, 'L')).toMatchObject({ blurRadius: 72, pixelateBlock: 72 });
  });

  it('RULE-12 zoom steps run from 10 % to 800 %', () => {
    expect(ZOOM_STEPS).toEqual([10, 25, 50, 67, 100, 150, 200, 300, 400, 600, 800]);
  });

  it('RULE-14 padding is 0, 3, 6 or 12 % of the frame’s longer side', () => {
    expect(PADDING_FACTOR).toEqual({ none: 0, S: 0.03, M: 0.06, L: 0.12 });
  });

  it('ADR-0020 baseline offset is (1.25·size − 1.366·size) / 2 + 1.066·size', () => {
    expect(baselineOffset(16)).toBeCloseTo((20 - 21.856) / 2 + 17.056, 10);
    expect(baselineOffset(100)).toBeCloseTo(100.8, 10);
  });
});
