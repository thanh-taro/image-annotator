// MOD-Render paintBase (ADR-0016): steps 1–2 of the scene over the screen-only checkerboard. The
// context is a recording fake; pixels are checked in tests/e2e/load.spec.ts.
import { describe, expect, it } from 'vitest';
import { paintBase, PALETTE_HEX, type Scene } from '../../src/render';

function recorder() {
  const calls: string[] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(
    { canvas: { width: 800, height: 600 } },
    {
      get(target, key: string) {
        if (key in target) return (target as Record<string, unknown>)[key];
        return (...args: unknown[]) =>
          calls.push(`${key}(${args.map((a) => (typeof a === 'object' ? 'img' : a)).join(',')})`);
      },
      set(_t, key: string, value) {
        state[key] = value;
        calls.push(`${key}=${value}`);
        return true;
      },
    },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const scene = (background: Scene['padding']['background']): Scene => ({
  annotations: [],
  frame: { x: 0, y: 0, width: 400, height: 300 },
  padding: { size: 'none', background },
});
const image = {} as CanvasImageSource;
const view = {
  surround: '#ddd',
  checkerA: '#fff',
  checkerB: '#eee',
  checkerSize: 8,
  outline: { colour: '#999', width: 1 },
};

describe('MOD-Render paintBase', () => {
  it('F-001.R6 draws the whole image at the given transform, clipped to the frame, smoothed', () => {
    const { ctx, calls } = recorder();
    paintBase(ctx, scene('transparent'), image, { scale: 0.5, dx: 100, dy: 75 }, view);
    expect(calls).toContain('setTransform(0.5,0,0,0.5,100,75)');
    expect(calls).toContain('rect(0,0,400,300)');
    expect(calls.indexOf('clip()')).toBeLessThan(calls.indexOf('drawImage(img,0,0,400,300,0,0,400,300)'));
    expect(calls).toContain('imageSmoothingQuality=high');
    expect(calls).not.toContain('fillRect(0,0,400,300)');
  });

  it('RULE-14 a palette background fills the canvas before the image', () => {
    const { ctx, calls } = recorder();
    paintBase(ctx, scene('blue'), image, { scale: 1, dx: 0, dy: 0 }, view);
    expect(calls).toContain(`fillStyle=${PALETTE_HEX.blue}`);
    expect(calls.indexOf('fillRect(0,0,400,300)')).toBeLessThan(
      calls.indexOf('drawImage(img,0,0,400,300,0,0,400,300)'),
    );
  });

  it('F-001 edge case: the surround, outline and checkerboard are painted before the scene', () => {
    const { ctx, calls } = recorder();
    paintBase(ctx, scene('transparent'), image, { scale: 1, dx: 10, dy: 20 }, view);
    expect(calls.slice(0, 6)).toEqual([
      'save()',
      'setTransform(1,0,0,1,0,0)',
      'fillStyle=#ddd',
      'fillRect(0,0,800,600)',
      'fillStyle=#999',
      'fillRect(9,19,402,302)',
    ]);
    expect(calls).toContain('fillRect(10,20,400,300)');
    expect(calls.indexOf('fillStyle=#eee')).toBeLessThan(calls.indexOf('drawImage(img,0,0,400,300,0,0,400,300)'));
  });

  it('F-002 crisp pixels when zoomed (architecture A5): the screen layer turns smoothing off on request', () => {
    const smooth = recorder();
    paintBase(smooth.ctx, scene('transparent'), image, { scale: 1, dx: 0, dy: 0 }, view);
    expect(smooth.calls).toContain('imageSmoothingEnabled=true');
    const crisp = recorder();
    paintBase(crisp.ctx, scene('transparent'), image, { scale: 2, dx: 0, dy: 0 }, { ...view, crisp: true });
    expect(crisp.calls).toContain('imageSmoothingEnabled=false');
  });

  it('F-002 zoomed in, only the image pixels and checker squares on screen are drawn (NFR-02)', () => {
    const { ctx, calls } = recorder(); // an 800 × 600 context
    // 800 %, image pixel (100, 50) at the context origin: on screen are pixels 100…200 × 50…125.
    paintBase(ctx, scene('transparent'), image, { scale: 8, dx: -800, dy: -400 }, view);
    expect(calls).toContain('drawImage(img,99,49,102,77,99,49,102,77)');
    const squares = calls.filter((c) => c.startsWith('rect(') && c !== 'rect(0,0,400,300)');
    expect(squares.length).toBe(((800 / 8) * (600 / 8)) / 2); // half the visible squares, not the whole canvas
    expect(calls).toContain('fillRect(0,0,800,600)');
  });
});
