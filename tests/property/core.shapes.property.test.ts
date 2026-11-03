// MOD-Core shape invariants (F-003): RULE-06 constraints and RULE-05 default placement, for any drag.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { constrain, defaultAnnotationAt, DEFAULT_STYLES, shapeBox } from '../../src/core';

const coord = fc.double({ min: -5000, max: 5000, noNaN: true });
const point = fc.record({ x: coord, y: coord });

describe('MOD-Core shape properties', () => {
  it('RULE-06 a constrained box is square with side = the longer side of the drag', () => {
    fc.assert(
      fc.property(point, point, (from, to) => {
        const end = constrain(from, to, 'rectangle');
        const side = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
        expect(Math.abs(end.x - from.x)).toBeCloseTo(side, 6);
        expect(Math.abs(end.y - from.y)).toBeCloseTo(side, 6);
      }),
    );
  });

  it('RULE-06 a constrained line keeps its length and lies on a 45° step', () => {
    fc.assert(
      fc.property(point, point, (from, to) => {
        const end = constrain(from, to, 'arrow');
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        expect(Math.hypot(end.x - from.x, end.y - from.y)).toBeCloseTo(length, 6);
        if (length > 1e-6) {
          const steps = Math.atan2(end.y - from.y, end.x - from.x) / (Math.PI / 4);
          expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-9);
        }
      }),
    );
  });

  it('RULE-05 a default shape is centred on the click and 20 % of the shorter side', () => {
    fc.assert(
      fc.property(point, fc.integer({ min: 1, max: 16384 }), (p, s) => {
        const a = defaultAnnotationAt(p, 'ellipse', s, 'e', DEFAULT_STYLES.ellipse);
        const b = shapeBox(a);
        expect(b.width).toBe(Math.round(0.2 * s));
        expect(b.x + b.width / 2).toBeCloseTo(p.x, 6);
        expect(b.y + b.height / 2).toBeCloseTo(p.y, 6);
      }),
    );
  });
});
