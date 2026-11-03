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
const view = { checkerA: '#fff', checkerB: '#eee', checkerSize: 8 };

describe('MOD-Render paintBase', () => {
  it('F-001.R6 draws the whole image at the given transform, clipped to the frame, smoothed', () => {
    const { ctx, calls } = recorder();
    paintBase(ctx, scene('transparent'), image, { scale: 0.5, dx: 100, dy: 75 });
    expect(calls).toContain('setTransform(0.5,0,0,0.5,100,75)');
    expect(calls).toContain('rect(0,0,400,300)');
    expect(calls.indexOf('clip()')).toBeLessThan(calls.indexOf('drawImage(img,0,0)'));
    expect(calls).toContain('imageSmoothingQuality=high');
    expect(calls).not.toContain('fillRect(0,0,400,300)');
  });

  it('RULE-14 a palette background fills the canvas before the image', () => {
    const { ctx, calls } = recorder();
    paintBase(ctx, scene('blue'), image, { scale: 1, dx: 0, dy: 0 });
    expect(calls).toContain(`fillStyle=${PALETTE_HEX.blue}`);
    expect(calls.indexOf('fillRect(0,0,400,300)')).toBeLessThan(calls.indexOf('drawImage(img,0,0)'));
  });

  it('F-001 edge case: a checkerboard is painted under the canvas on screen only', () => {
    const withView = recorder();
    paintBase(withView.ctx, scene('transparent'), image, { scale: 1, dx: 10, dy: 20 }, view);
    expect(withView.calls).toContain('fillRect(10,20,400,300)');
    expect(withView.calls.indexOf('fillStyle=#eee')).toBeLessThan(withView.calls.indexOf('drawImage(img,0,0)'));
    const withoutView = recorder();
    paintBase(withoutView.ctx, scene('transparent'), image, { scale: 1, dx: 10, dy: 20 });
    expect(withoutView.calls.some((c) => c.startsWith('fillStyle=#'))).toBe(false);
  });
});
