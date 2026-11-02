// MOD-Core property tests with fast-check (ADR-0012): RULE-02 scale-down for any oversized image.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkLimits, MAX_PIXELS, MAX_SIDE, scaleDownSize } from '../../src/core';

const side = fc.integer({ min: 1, max: 200_000 });

describe('MOD-Core scale-down (property)', () => {
  it('RULE-02 any scaled-down size is within both limits, never larger, and keeps the aspect ratio', () => {
    fc.assert(
      fc.property(side, side, (w, h) => {
        const s = scaleDownSize(w, h);
        expect(checkLimits(s.width, s.height).ok).toBe(true);
        expect(s.width * s.height).toBeLessThanOrEqual(MAX_PIXELS);
        expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(MAX_SIDE);
        expect(s.width).toBeLessThanOrEqual(w);
        expect(s.height).toBeLessThanOrEqual(h);
        // Rounding each side down moves the ratio by less than one pixel on the shorter side.
        if (s.width > 1 && s.height > 1) {
          expect(Math.abs(s.width * h - s.height * w)).toBeLessThan(Math.max(w, h));
        }
      }),
      { numRuns: 2000 },
    );
  });

  it('RULE-02 sizes already within the limits are unchanged', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4096 }), fc.integer({ min: 1, max: 4096 }), (w, h) => {
        expect(scaleDownSize(w, h)).toEqual({ width: w, height: h });
      }),
    );
  });
});
