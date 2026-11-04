// MOD-Render redactions (F-007, ADR-0006) with a recording context: solid redactions as opaque whole-pixel
// boxes, and blur/pixelate as patches composited in ADR-0006's order (replace with the background, draw
// the effect pixels, re-stamp every solid). The pixels are checked end to end in tests/e2e/redact.spec.ts.
// Also the ADR-0022 drag range rule for a dragged solid (MOD-Canvas).
import { describe, expect, it } from 'vitest';
import { dragRange } from '../../src/canvas/drag';
import { DEFAULT_STYLES, type Annotation, type Box, type Style } from '../../src/core';
import { paintAnnotations, PALETTE_HEX, type Scene, type SceneImage } from '../../src/render';

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
const T = { scale: 1, dx: 0, dy: 0 };
const red = (id: string, box: Box, style: Partial<Style> = {}): Annotation => ({
  id,
  kind: 'redaction',
  style: { ...DEFAULT_STYLES.redact, ...style },
  box,
});
const arrow: Annotation = {
  id: 'a',
  kind: 'arrow',
  style: DEFAULT_STYLES.arrow,
  tail: { x: 0, y: 120 },
  head: { x: 400, y: 120 },
};
const scene = (annotations: Annotation[], background: Scene['padding']['background'] = 'transparent'): Scene => ({
  annotations,
  frame: { x: 0, y: 0, width: 1000, height: 800 },
  padding: { size: 'none', background },
});
const bitmap = {} as CanvasImageSource;

describe('MOD-Render redactions', () => {
  it('F-007.AC1 F-007.R2 INV-02 a solid redaction is an opaque box in its colour over every touched pixel', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([red('s', { x: 10.4, y: 20.5, width: 99.2, height: 30 })]), image, T, new Map());
    const fill = calls.indexOf('fillRect(10,20,100,31)');
    expect(fill).toBeGreaterThan(-1);
    expect(calls.slice(0, fill)).toContain(`fillStyle=${PALETTE_HEX.black}`);
    expect(
      calls
        .slice(0, fill)
        .filter((c) => c.startsWith('globalAlpha='))
        .at(-1),
    ).toBe('globalAlpha=1');
  });

  it('F-007.AC9 ADR-0006 a blur replaces its box (hiding the earlier arrow), then draws its patch over O', () => {
    const { ctx, calls } = recorder();
    const blur = red('b', { x: 100, y: 100, width: 200, height: 40 }, { redactionKind: 'blur' });
    const patch = { box: { x: 100, y: 100, width: 200, height: 40 }, bitmap, smooth: true };
    paintAnnotations(ctx, scene([arrow, blur]), image, T, new Map([['b', patch]]));
    const arrowHead = calls.indexOf('fill()'); // the arrow's head, drawn first
    const clear = calls.indexOf('clearRect(100,100,200,40)');
    const draw = calls.indexOf('drawImage(img,0,0,200,40,100,100,200,40)');
    expect(arrowHead).toBeGreaterThan(-1);
    expect(clear).toBeGreaterThan(arrowHead);
    expect(draw).toBeGreaterThan(clear);
    // After the blur is sent behind the arrow, the arrow is drawn over it.
    const after = recorder();
    paintAnnotations(after.ctx, scene([blur, arrow]), image, T, new Map([['b', patch]]));
    expect(after.calls.findIndex((c) => c.startsWith('drawImage('))).toBeLessThan(
      after.calls.findLastIndex((c) => c.startsWith('fill()')),
    );
  });

  it('F-007.AC10 INV-02 RULE-10 every solid is re-stamped over a later blur where they overlap', () => {
    const { ctx, calls } = recorder();
    const solid = red('s', { x: 100, y: 100, width: 100, height: 20 }, { color: 'black' });
    const blur = red('b', { x: 150, y: 90, width: 100, height: 40 }, { redactionKind: 'blur' });
    const patch = { box: { x: 150, y: 90, width: 100, height: 40 }, bitmap };
    paintAnnotations(ctx, scene([solid, blur]), image, T, new Map([['b', patch]]));
    const draw = calls.indexOf('drawImage(img,0,0,100,40,150,90,100,40)');
    const stamp = calls.indexOf('fillRect(150,100,50,20)');
    expect(draw).toBeGreaterThan(-1);
    expect(stamp).toBeGreaterThan(draw);
  });

  it('F-007.AC13 RULE-14 the box is replaced with the background colour, so its padding part is the background', () => {
    const { ctx, calls } = recorder();
    const blur = red('b', { x: -30, y: 10, width: 60, height: 20 }, { redactionKind: 'pixelate' });
    paintAnnotations(ctx, scene([blur], 'white'), image, T, new Map());
    const i = calls.indexOf('fillRect(-30,10,60,20)');
    expect(i).toBeGreaterThan(-1);
    expect(calls.slice(0, i)).toContain(`fillStyle=${PALETTE_HEX.white}`);
    expect(calls).not.toContain('clearRect(-30,10,60,20)');
  });

  it('F-007.R3 an approximation is drawn scaled up from its smaller source; pixelate without smoothing', () => {
    const { ctx, calls } = recorder();
    const pix = red('p', { x: 0, y: 0, width: 64, height: 32 }, { redactionKind: 'pixelate' });
    const approx = {
      box: { x: 0, y: 0, width: 64, height: 32 },
      bitmap,
      smooth: false,
      source: { width: 4, height: 2 },
    };
    paintAnnotations(ctx, scene([pix]), image, T, new Map([['p', approx]]));
    const draw = calls.indexOf('drawImage(img,0,0,4,2,0,0,64,32)');
    expect(draw).toBeGreaterThan(-1);
    expect(
      calls
        .slice(0, draw)
        .filter((c) => c.startsWith('imageSmoothingEnabled='))
        .at(-1),
    ).toBe('imageSmoothingEnabled=false');
  });

  it('ADR-0022 RULE-10 dragging a solid draws every blur or pixelate above it each frame', () => {
    const blur = red('b', { x: 0, y: 0, width: 10, height: 10 }, { redactionKind: 'blur' });
    const solid = red('s', { x: 0, y: 0, width: 10, height: 10 });
    const list = [arrow, solid, arrow, blur, arrow];
    expect(dragRange(list, [1])).toEqual({ lo: 1, hi: 3 });
    expect(dragRange(list, [0])).toEqual({ lo: 0, hi: 0 }); // an arrow: only itself
    expect(dragRange([solid, arrow], [0])).toEqual({ lo: 0, hi: 0 });
  });
});
