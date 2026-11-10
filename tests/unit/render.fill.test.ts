// MOD-Render fill colour and text background (F-020, RULE-22, NFR-08): a rectangle's or ellipse's fill in
// its fill colour under the outline in its colour; a text with a background on a
// rounded box (roundRect with the RULE-22 margin and radius) in its text background colour, opaque or at
// 70 %, directly under its letters and without the outline; around the placeholder while an edited text is
// empty (screen only). Contexts are recording fakes; pixels are in tests/e2e/fill-background.spec.ts.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, textAt, type Annotation, type Style } from '../../src/core';
import { paint, paintAnnotations, PALETTE_HEX, type Scene, type SceneImage } from '../../src/render';

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
const scene = (annotations: Annotation[]): Scene => ({
  annotations,
  frame: { x: 0, y: 0, width: 1000, height: 800 },
  padding: { size: 'none', background: 'transparent' },
});
const T = { scale: 1, dx: 0, dy: 0 };
const rect = (style: Partial<Style>): Annotation => ({
  id: 'r1',
  kind: 'rectangle',
  style: { ...DEFAULT_STYLES.rectangle, ...style },
  box: { x: 100, y: 100, width: 200, height: 100 },
});
const text = (style: Partial<Style>, s = 'Bug'): Annotation =>
  textAt({ x: 100, y: 50 }, 't1', { ...DEFAULT_STYLES.text, ...style }, s);
/** The value set last for `key` before the call at `index`. */
const lastSet = (calls: string[], key: string, index: number) =>
  calls
    .slice(0, index)
    .reverse()
    .find((c) => c.startsWith(`${key}=`));

describe('MOD-Render fill colour', () => {
  it('F-020.AC2 F-020.R1 a red rectangle with a solid White fill colour: white fill, then the red outline over it', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([rect({ color: 'red', fill: 'solid', fillColor: 'white' })]), image, T, new Map());
    const fill = calls.indexOf('fill()');
    const stroke = calls.indexOf('stroke()');
    expect(fill).toBeGreaterThan(-1);
    expect(stroke).toBeGreaterThan(fill);
    expect(lastSet(calls, 'fillStyle', fill)).toBe(`fillStyle=${PALETTE_HEX.white}`);
    expect(lastSet(calls, 'globalAlpha', fill)).toBe('globalAlpha=1');
    expect(lastSet(calls, 'strokeStyle', stroke)).toBe(`strokeStyle=${PALETTE_HEX.red}`);
  });

  it('F-020.AC3 F-020.R2 a translucent fill is its fill colour at 30 %, not the outline colour', () => {
    const a = recorder();
    paintAnnotations(
      a.ctx,
      scene([rect({ color: 'blue', fill: 'translucent', fillColor: 'red' })]),
      image,
      T,
      new Map(),
    );
    const fill = a.calls.indexOf('fill()');
    expect(lastSet(a.calls, 'fillStyle', fill)).toBe(`fillStyle=${PALETTE_HEX.red}`);
    expect(lastSet(a.calls, 'globalAlpha', fill)).toBe('globalAlpha=0.3');
    const b = recorder();
    paintAnnotations(
      b.ctx,
      scene([rect({ color: 'green', fill: 'translucent', fillColor: 'yellow' })]),
      image,
      T,
      new Map(),
    );
    expect(lastSet(b.calls, 'fillStyle', b.calls.indexOf('fill()'))).toBe(`fillStyle=${PALETTE_HEX.yellow}`);
    expect(lastSet(b.calls, 'strokeStyle', b.calls.indexOf('stroke()'))).toBe(`strokeStyle=${PALETTE_HEX.green}`);
  });

  it('F-020.AC5 a custom fill colour is drawn as is', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([rect({ fill: 'solid', fillColor: '#1e90ff' })]), image, T, new Map());
    expect(lastSet(calls, 'fillStyle', calls.indexOf('fill()'))).toBe('fillStyle=#1e90ff');
  });
});

describe('MOD-Render text background', () => {
  it('F-020.AC8 RULE-22 a red text at M with a solid background: an opaque white rounded box 8 px around its box, radius 6.4, no outline', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([text({ color: 'red', fill: 'solid' })]), image, T, new Map());
    // "Bug" = 3 × 16 = 48 px wide, one 40 px line, anchored at (100, 50).
    const box = calls.indexOf('roundRect(92,42,64,56,6.4)');
    expect(box).toBeGreaterThan(-1);
    const fill = calls.indexOf('fill()', box);
    expect(lastSet(calls, 'fillStyle', fill)).toBe(`fillStyle=${PALETTE_HEX.white}`);
    expect(lastSet(calls, 'globalAlpha', fill)).toBe('globalAlpha=1');
    const letters = calls.findIndex((c) => c.startsWith('fillText(Bug,'));
    expect(letters).toBeGreaterThan(fill);
    expect(lastSet(calls, 'fillStyle', letters)).toBe(`fillStyle=${PALETTE_HEX.red}`);
    expect(calls.some((c) => c.startsWith('strokeText('))).toBe(false);
  });

  it('F-020.AC9 RULE-22 a translucent Black background is black at 70 %', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(
      ctx,
      scene([text({ color: 'white', fill: 'translucent', fillColor: 'black' })]),
      image,
      T,
      new Map(),
    );
    const fill = calls.indexOf('fill()');
    expect(lastSet(calls, 'fillStyle', fill)).toBe(`fillStyle=${PALETTE_HEX.black}`);
    expect(lastSet(calls, 'globalAlpha', fill)).toBe('globalAlpha=0.7');
  });

  it('F-020.AC10 RULE-22 an automatic background is the pairing of the text colour: blue → white, yellow → black', () => {
    for (const [color, box] of [
      ['blue', 'white'],
      ['yellow', 'black'],
    ] as const) {
      const { ctx, calls } = recorder();
      paintAnnotations(ctx, scene([text({ color, fill: 'solid' })]), image, T, new Map());
      expect(lastSet(calls, 'fillStyle', calls.indexOf('fill()'))).toBe(`fillStyle=${PALETTE_HEX[box]}`);
    }
  });

  it('F-020.AC12 RULE-08 with background none the text has its outline and no box', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([text({ fill: 'none', fillColor: 'yellow' })]), image, T, new Map());
    expect(calls.some((c) => c.startsWith('roundRect('))).toBe(false);
    expect(calls.some((c) => c.startsWith('strokeText(Bug,'))).toBe(true);
  });

  it('F-020.AC11 F-020.R5 the selection outline of a text with a background surrounds the box', () => {
    const { ctx, calls } = recorder();
    const look = {
      outline: '#0af',
      halo: '#fff',
      handleFill: '#fff',
      handleBorder: '#0af',
      lineWidth: 2,
      handleSize: 8,
    };
    paint(
      ctx,
      scene([text({ fill: 'solid' })]),
      image,
      T,
      new Map(),
      { selection: ['t1'], look },
      {} as CanvasImageSource,
    );
    expect(calls).toContain('strokeRect(92,42,64,56)');
  });

  it('F-020.AC19 F-020.R8 an empty text being edited: the box surrounds the placeholder (screen only)', () => {
    const shown = recorder();
    paint(
      shown.ctx,
      scene([text({ fill: 'solid' }, '')]),
      image,
      T,
      new Map(),
      { placeholder: { id: 't1', text: 'Type here' } },
      {} as CanvasImageSource,
    );
    // 9 × 16 = 144 px wide: 8 px margin around it.
    expect(shown.calls).toContain('roundRect(92,42,160,56,6.4)');
    // Without the placeholder (the export), an empty text's box is only its margin.
    const exported = recorder();
    paintAnnotations(exported.ctx, scene([text({ fill: 'solid' }, '')]), image, T, new Map());
    expect(exported.calls).toContain('roundRect(92,42,16,56,6.4)');
  });
});
