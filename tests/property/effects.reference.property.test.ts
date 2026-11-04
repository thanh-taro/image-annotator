// MOD-Effects: the optimised blur and pixelate equal the slow, independent reference exactly
// (ADR-0006 "Testing", ADR-0017), promoted from spike SP-blur's property suite. Also: nothing outside
// the frame and nothing under a solid is ever sampled (RULE-10, INV-02, F-007.AC13 at the effect level).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/core';
import { blur, pixelate, Scratch, type Pixels, type Solid } from '../../src/effects/algorithms';
import { referenceBlur, referencePixelate } from '../../src/effects/reference';

const RUNS = 300;

function makeImg(w: number, h: number, translucent: boolean, seed: number): Pixels {
  let s = seed >>> 0 || 1;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) >>> 24;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rnd();
    data[i + 1] = rnd();
    data[i + 2] = rnd();
    const a = rnd();
    data[i + 3] = translucent ? (a < 40 ? 0 : a > 200 ? 255 : a) : 255;
  }
  return { data, width: w, height: h };
}

const byte = () => fc.integer({ min: 0, max: 255 });
function rectArb(w: number, h: number): fc.Arbitrary<Box> {
  // Fractional, and may extend outside the image (boxes can lie in the padding).
  const frac = fc.double({ min: 0, max: 0.999, noNaN: true });
  return fc.record({
    x: fc.tuple(fc.integer({ min: -6, max: w }), frac).map(([i, f]) => i + f),
    y: fc.tuple(fc.integer({ min: -6, max: h }), frac).map(([i, f]) => i + f),
    width: fc.tuple(fc.integer({ min: 0, max: w + 6 }), frac).map(([i, f]) => i + f + 0.001),
    height: fc.tuple(fc.integer({ min: 0, max: h + 6 }), frac).map(([i, f]) => i + f + 0.001),
  });
}

const scenario = fc
  .record({
    w: fc.integer({ min: 1, max: 56 }),
    h: fc.integer({ min: 1, max: 56 }),
    translucent: fc.boolean(),
    seed: fc.integer(),
  })
  .chain(({ w, h, translucent, seed }) =>
    fc.record({
      img: fc.constant(null).map(() => makeImg(w, h, translucent, seed)),
      frame: fc
        .tuple(fc.nat({ max: Math.min(8, w - 1) }), fc.nat({ max: Math.min(8, h - 1) }))
        .chain(([fx, fy]) =>
          fc.tuple(
            fc.constant(fx),
            fc.constant(fy),
            fc.nat({ max: w - fx - 1 }).map((d) => w - d),
            fc.nat({ max: h - fy - 1 }).map((d) => h - d),
          ),
        )
        .map(([x0, y0, x1, y1]): Box => ({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 })),
      box: rectArb(w, h),
      size: fc.integer({ min: 1, max: 20 }),
      solids: fc.array(
        fc.record({ box: rectArb(w, h), rgb: fc.tuple(byte(), byte(), byte()) }) as fc.Arbitrary<Solid>,
        {
          maxLength: 3,
        },
      ),
    }),
  );

describe('MOD-Effects optimised == reference (ADR-0006, ADR-0017)', () => {
  it('ADR-0006 F-007.AC7 blur equals the slow reference exactly (opaque and translucent, with solids)', () => {
    const scratch = new Scratch(); // reused between jobs, as in the worker (ADR-0017)
    fc.assert(
      fc.property(scenario, ({ img, frame, box, size, solids }) => {
        expect(blur(img, frame, box, size, solids, scratch)).toEqual(referenceBlur(img, frame, box, size, solids));
      }),
      { numRuns: RUNS },
    );
  });

  it('RULE-10 ADR-0006 pixelate equals the slow reference exactly', () => {
    fc.assert(
      fc.property(scenario, ({ img, frame, box, size, solids }) => {
        expect(pixelate(img, frame, box, size, solids)).toEqual(referencePixelate(img, frame, box, size, solids));
      }),
      { numRuns: RUNS },
    );
  });

  it('RULE-10 F-007.AC13 nothing outside the frame is sampled, and the output stays inside it', () => {
    fc.assert(
      fc.property(scenario, fc.integer(), ({ img, frame, box, size, solids }, seed) => {
        const other = makeImg(img.width, img.height, true, seed);
        for (let y = frame.y; y < frame.y + frame.height; y++)
          for (let x = frame.x; x < frame.x + frame.width; x++)
            for (let c = 0; c < 4; c++)
              other.data[(y * img.width + x) * 4 + c] = img.data[(y * img.width + x) * 4 + c]!;
        expect(blur(other, frame, box, size, solids)).toEqual(blur(img, frame, box, size, solids));
        expect(pixelate(other, frame, box, size, solids)).toEqual(pixelate(img, frame, box, size, solids));
        const p = blur(img, frame, box, size, solids);
        if (p) {
          expect(p.x).toBeGreaterThanOrEqual(frame.x);
          expect(p.y).toBeGreaterThanOrEqual(frame.y);
          expect(p.x + p.width).toBeLessThanOrEqual(frame.x + frame.width);
          expect(p.y + p.height).toBeLessThanOrEqual(frame.y + frame.height);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('INV-02 RULE-10 what a solid hides never reaches a blur or pixelate', () => {
    fc.assert(
      fc.property(scenario, fc.integer(), ({ img, frame, box, size, solids }, seed) => {
        const other = makeImg(img.width, img.height, true, seed);
        const under = (x: number, y: number) =>
          solids.some(
            (s) =>
              x >= Math.floor(s.box.x) &&
              x < Math.ceil(s.box.x + s.box.width) &&
              y >= Math.floor(s.box.y) &&
              y < Math.ceil(s.box.y + s.box.height),
          );
        for (let y = 0; y < img.height; y++)
          for (let x = 0; x < img.width; x++)
            if (!under(x, y))
              for (let c = 0; c < 4; c++)
                other.data[(y * img.width + x) * 4 + c] = img.data[(y * img.width + x) * 4 + c]!;
        expect(blur(other, frame, box, size, solids)).toEqual(blur(img, frame, box, size, solids));
        expect(pixelate(other, frame, box, size, solids)).toEqual(pixelate(img, frame, box, size, solids));
      }),
      { numRuns: RUNS },
    );
  });

  it('ADR-0017 the packed lanes do not overflow at the largest packed reach, and the fallback is exact above it', () => {
    const img = { data: new Uint8ClampedArray(40 * 30 * 4).fill(255), width: 40, height: 30 };
    const F = { x: 0, y: 0, width: 40, height: 30 };
    const box = { x: 2, y: 3, width: 30, height: 20 };
    for (const r of [255, 256, 300]) expect(blur(img, F, box, r, [])).toEqual(referenceBlur(img, F, box, r, []));
  });

  it('ADR-0006 windowing is exact on a large frame (big radius, box deep inside)', () => {
    const img = makeImg(220, 160, false, 7);
    const F = { x: 3, y: 5, width: 214, height: 153 };
    for (const r of [6, 10, 16, 18, 36]) {
      const box = { x: 70.3, y: 60.7, width: 40.2, height: 25.9 };
      expect(blur(img, F, box, r, [])).toEqual(referenceBlur(img, F, box, r, []));
    }
  });
});
