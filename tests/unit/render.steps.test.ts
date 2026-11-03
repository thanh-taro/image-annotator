// MOD-Render step badges (F-006, RULE-07, ADR-0009, NFR-08): a filled circle (or pill) in its colour
// with its number in the contrast pairing, in the tool's face at the step's text size; the same calls
// for the display and the export. Contexts are recording fakes; pixels are in tests/e2e/steps.spec.ts.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, PALETTE_NAMES, type Annotation, type Colour } from '../../src/core';
import { contrastPair, paint, paintAnnotations, PALETTE_HEX, type Scene, type SceneImage } from '../../src/render';

function recorder() {
  const calls: string[] = [];
  const ctx = new Proxy(
    { canvas: { width: 1000, height: 800 } },
    {
      get(target, key: string) {
        if (key in target) return (target as Record<string, unknown>)[key];
        return (...args: unknown[]) =>
          calls.push(
            `${key}(${args.map((a) => (typeof a === 'object' ? 'img' : typeof a === 'number' ? +a.toFixed(2) : a)).join(',')})`,
          );
      },
      set(_t, key: string, value) {
        calls.push(`${key}=${value}`);
        return true;
      },
    },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const image = { width: 1000, height: 800 } as SceneImage;
const step = (color: Colour = 'red', number = 1, x = 500, y = 400): Annotation => ({
  id: `s${number}`,
  kind: 'step',
  style: { ...DEFAULT_STYLES.step, color },
  centre: { x, y },
  number,
});
const scene = (annotations: Annotation[]): Scene => ({
  annotations,
  frame: { x: 0, y: 0, width: 1000, height: 800 },
  padding: { size: 'none', background: 'transparent' },
});
const T = { scale: 1, dx: 0, dy: 0 };

/** WCAG 2 relative luminance and contrast ratio of two sRGB hex colours. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c = 0) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('MOD-Render step badges', () => {
  it('F-006.R1 RULE-07 a step is a filled circle in its colour with its number centred in the tool face', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([step('red', 3)]), image, T, new Map());
    expect(calls).toContain('arc(500,400,32,0,6.28)');
    expect(calls).toContain(`fillStyle=${PALETTE_HEX.red}`);
    expect(calls).toContain('font=600 32px Manrope');
    expect(calls).toContain('textAlign=center');
    expect(calls).toContain('textBaseline=alphabetic');
    expect(calls).toContain('fillText(3,500,411.52)');
    // The number is drawn after (over) the badge.
    expect(calls.lastIndexOf(`fillStyle=${PALETTE_HEX.white}`)).toBeGreaterThan(
      calls.indexOf('arc(500,400,32,0,6.28)'),
    );
  });

  it('F-006.AC4 F-006.R3 a yellow step’s number is black, a red one’s white, orange and green black', () => {
    const numberColour = (color: Colour) => {
      const { ctx, calls } = recorder();
      paintAnnotations(ctx, scene([step(color)]), image, T, new Map());
      const text = calls.findIndex((c) => c.startsWith('fillText('));
      return calls.slice(0, text).findLast((c) => c.startsWith('fillStyle='));
    };
    expect(numberColour('yellow')).toBe(`fillStyle=${PALETTE_HEX.black}`);
    expect(numberColour('red')).toBe(`fillStyle=${PALETTE_HEX.white}`);
    expect(numberColour('orange')).toBe(`fillStyle=${PALETTE_HEX.black}`);
    expect(numberColour('green')).toBe(`fillStyle=${PALETTE_HEX.black}`);
  });

  it('RULE-07 every contrast pairing has a contrast ratio of at least 4.5:1 with the palette values', () => {
    for (const c of PALETTE_NAMES) {
      expect(contrast(PALETTE_HEX[c], PALETTE_HEX[contrastPair(c)]), c).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('RULE-07 F-006 edge case a number of three digits sits on a pill of the same height', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([step('blue', 100)]), image, T, new Map());
    expect(calls.some((c) => c.startsWith('roundRect('))).toBe(true);
    const args =
      calls
        .find((c) => c.startsWith('roundRect('))
        ?.slice(10, -1)
        .split(',')
        .map(Number) ?? [];
    const [, y, w, h, r] = args;
    expect(h).toBe(64);
    expect(y).toBe(368);
    expect(r).toBe(32);
    expect(w).toBeGreaterThan(64);
    expect(calls).toContain('fillText(100,500,411.52)');
  });

  it('NFR-08 ADR-0004 the display (any zoom) and the export draw the same number with the same font', () => {
    const glyphs = (scale: number) => {
      const { ctx, calls } = recorder();
      paint(ctx, scene([step('red', 7)]), image, { scale, dx: 3, dy: 5 }, new Map());
      return calls.filter((c) => c.startsWith('font=') || c.startsWith('fillText(') || c.startsWith('arc('));
    };
    // Sizes are in image pixels; only the transform differs (setTransform), so the glyph is the same.
    expect(glyphs(2)).toEqual(glyphs(1));
    expect(glyphs(0.25)).toEqual(glyphs(1));
  });

  it('F-008.R3 CMP-Canvas "selected" a selected step shows the outline of its badge and no handles', () => {
    const { ctx, calls } = recorder();
    const look = {
      outline: '#a47bff',
      halo: '#0b0812',
      handleFill: '#ffffff',
      handleBorder: '#6837e0',
      lineWidth: 2,
      handleSize: 10,
    };
    paint(ctx, scene([step('red', 1)]), image, T, new Map(), { selection: ['s1'], look });
    expect(calls).toContain('strokeRect(468,368,64,64)');
    expect(calls).not.toContain('fillStyle=#6837e0');
  });
});
