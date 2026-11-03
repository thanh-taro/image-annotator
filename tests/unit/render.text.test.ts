// MOD-Render text (F-005.R5, RULE-08, ADR-0009 §1, ADR-0020, NFR-08): each line in the tool's face at
// the text size, at the anchor's line top + the metric baseline, outlined in the contrast pairing with
// lineWidth 2 × max(1, 0.08 × size) and round joins, then filled in the style colour; the same calls
// for the display and the export. Selected text shows its box outline and no handles. Contexts are
// recording fakes; pixels are in tests/e2e/text.spec.ts.
import { describe, expect, it } from 'vitest';
import { baselineOffset, DEFAULT_STYLES, textAt, type Annotation, type Colour } from '../../src/core';
import { measureWith, paint, paintAnnotations, PALETTE_HEX, type Scene, type SceneImage } from '../../src/render';

function recorder() {
  const calls: string[] = [];
  let font = '';
  const target = {
    canvas: { width: 1000, height: 800 },
    // 0.5 em per code point.
    measureText: (s: string) => ({ width: Array.from(s).length * 0.5 * parseFloat(font.split(' ')[1] ?? '0') }),
  };
  const ctx = new Proxy(target, {
    get(t, key: string) {
      if (key in t) return (t as Record<string, unknown>)[key];
      return (...args: unknown[]) =>
        calls.push(`${key}(${args.map((a) => (typeof a === 'number' ? +a.toFixed(2) : String(a))).join(',')})`);
    },
    set(_t, key: string, value) {
      if (key === 'font') font = String(value);
      calls.push(`${key}=${value}`);
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const image = { width: 1000, height: 800 } as SceneImage;
const text = (s: string, color: Colour = 'red', id = 't1'): Annotation =>
  textAt({ x: 100, y: 50 }, id, { ...DEFAULT_STYLES.text, color }, s);
const scene = (annotations: Annotation[]): Scene => ({
  annotations,
  frame: { x: 0, y: 0, width: 1000, height: 800 },
  padding: { size: 'none', background: 'transparent' },
});
const T = { scale: 1, dx: 0, dy: 0 };

describe('MOD-Render text', () => {
  it('F-005.R5 RULE-08 ADR-0009 each line is stroked in the pairing colour, then filled in the style colour', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([text('Wrong total\nis $118')]), image, T, new Map());
    const at = (s: string) => calls.indexOf(s);
    const y = (line: number) => +(50 + line * 40 + baselineOffset(32)).toFixed(2);
    expect(calls).toContain('font=600 32px Manrope');
    expect(calls).toContain('textBaseline=alphabetic');
    expect(calls).toContain('lineJoin=round');
    expect(calls).toContain(`lineWidth=${2 * 0.08 * 32}`);
    expect(calls).toContain(`strokeStyle=${PALETTE_HEX.white}`);
    expect(calls).toContain(`fillStyle=${PALETTE_HEX.red}`);
    const stroke1 = at(`strokeText(Wrong total,100,${y(0)})`);
    const fill1 = at(`fillText(Wrong total,100,${y(0)})`);
    const fill2 = at(`fillText(is $118,100,${y(1)})`);
    expect(stroke1).toBeGreaterThan(-1);
    expect(fill1).toBeGreaterThan(stroke1);
    expect(fill2).toBeGreaterThan(fill1);
  });

  it('F-005.AC6 RULE-08 RULE-07 white text is outlined in black, at least 1 pixel wide even at size S', () => {
    const { ctx, calls } = recorder();
    const small = textAt({ x: 0, y: 0 }, 't', { ...DEFAULT_STYLES.text, color: 'white', strokeSize: 'S' }, 'Hi');
    // On a 100 × 100 image size S is 12 px: max(1, 0.96) = 1 px each side of the glyph edge.
    paintAnnotations(ctx, scene([small]), { width: 100, height: 100 } as SceneImage, T, new Map());
    expect(calls).toContain(`strokeStyle=${PALETTE_HEX.black}`);
    expect(calls).toContain('lineWidth=2');
    expect(calls).toContain(`fillStyle=${PALETTE_HEX.white}`);
  });

  it('NFR-08 the display and the export draw the same text calls (the export at scale 1)', () => {
    const a = recorder();
    const b = recorder();
    paintAnnotations(a.ctx, scene([text('Đường dẫn lỗi')]), image, T, new Map());
    paintAnnotations(b.ctx, scene([text('Đường dẫn lỗi')]), image, { scale: 2, dx: 10, dy: 0 }, new Map());
    const glyphs = (c: string[]) => c.filter((s) => /Text\(/.test(s));
    expect(glyphs(a.calls)).toEqual(glyphs(b.calls));
  });

  it('F-005.R3 F-008.R3 a selected text shows its box outline and no handles', () => {
    const { ctx, calls } = recorder();
    const look = { outline: '#a', halo: '#b', handleFill: '#c', handleBorder: '#d', lineWidth: 2, handleSize: 10 };
    paint(ctx, scene([text('Bug')]), image, T, new Map(), { selection: ['t1'], look });
    expect(calls).toContain('strokeRect(100,50,48,40)');
    expect(calls.filter((c) => c.startsWith('fillRect('))).toEqual([]);
  });

  it('ADR-0020 measureWith measures a line in the given font', () => {
    const { ctx } = recorder();
    expect(measureWith(ctx)('600 32px Manrope', 'abc')).toBe(48);
  });
});
