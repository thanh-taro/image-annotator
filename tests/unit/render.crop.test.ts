// MOD-Render and the frame (F-010): the export clips image pixels to the frame and annotations to the
// canvas (RULE-15); the crop view shows the whole image with no padding, annotations everywhere on it,
// and the frame overlay dims the outside (CMP-Canvas "cropping"). The context is a recording fake;
// pixels are checked in tests/e2e/crop.spec.ts.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, type Annotation } from '../../src/core';
import { cropView, paint, paintBase, paintOverlays, type OverlayLook, type Scene } from '../../src/render';

function recorder(width = 800, height = 600) {
  const calls: string[] = [];
  const ctx = new Proxy(
    { canvas: { width, height } },
    {
      get(target, key: string) {
        if (key in target) return (target as Record<string, unknown>)[key];
        if (key === 'measureText') return () => ({ width: 10 });
        return (...args: unknown[]) =>
          calls.push(`${key}(${args.map((a) => (typeof a === 'object' ? 'img' : a)).join(',')})`);
      },
      set(_t, key: string, value) {
        calls.push(`${key}=${value}`);
        return true;
      },
    },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const arrow: Annotation = {
  id: 'a',
  kind: 'arrow',
  style: DEFAULT_STYLES.arrow,
  tail: { x: 50, y: 50 },
  head: { x: 300, y: 50 },
};
const image = { width: 400, height: 300 } as unknown as ImageBitmap;
const cropped: Scene = {
  annotations: [arrow],
  frame: { x: 100, y: 20, width: 200, height: 100 },
  padding: { size: 'none', background: 'transparent' },
};
const look: OverlayLook = {
  outline: '#a47bff',
  halo: '#0b0812',
  handleFill: '#fff',
  handleBorder: '#6837e0',
  lineWidth: 2,
  handleSize: 10,
  cropDim: '#07050ba6',
};
const view = {
  surround: '#ddd',
  checkerA: '#fff',
  checkerB: '#eee',
  checkerSize: 8,
  outline: { colour: '#999', width: 1 },
};

describe('MOD-Render frame', () => {
  it('F-010.AC2 RULE-15 the export draws only the frame’s image pixels', () => {
    const { ctx, calls } = recorder(200, 100);
    paint(ctx, cropped, image, { scale: 1, dx: -100, dy: -20 }, new Map(), undefined, undefined, true);
    const clip = calls.indexOf('rect(100,20,200,100)');
    expect(clip).toBeGreaterThan(-1);
    expect(calls.indexOf('clip()', clip)).toBeLessThan(calls.indexOf('drawImage(img,100,20,200,100,100,20,200,100)'));
    // Only frame pixels are read (the visible part of the frame).
    expect(calls.some((c) => c.startsWith('drawImage(img,0,'))).toBe(false);
  });

  it('F-010.AC3 RULE-15 an arrow partly outside the frame is cut at the canvas edge in the export', () => {
    const { ctx, calls } = recorder(200, 100);
    paint(ctx, cropped, image, { scale: 1, dx: -100, dy: -20 }, new Map());
    // The annotation pass clips to the canvas (frame + no padding), then draws the whole arrow.
    const pass = calls.lastIndexOf('rect(100,20,200,100)');
    expect(calls.indexOf('clip()', pass)).toBeGreaterThan(pass);
    expect(calls.slice(pass)).toContain('moveTo(50,50)');
  });

  it('F-010.R2 RULE-12 the crop view is the whole image with no padding, background kept', () => {
    const padded: Scene = { ...cropped, padding: { size: 'L', background: 'blue' } };
    expect(cropView(padded, image)).toEqual({
      annotations: padded.annotations,
      frame: { x: 0, y: 0, width: 400, height: 300 },
      padding: { size: 'none', background: 'blue' },
    });
    // ADR-0016: the image layer of the crop view draws the whole image, not clipped to the frame.
    const { ctx, calls } = recorder();
    paintBase(ctx, cropView(padded, image), image, { scale: 1, dx: 0, dy: 0 }, view);
    expect(calls).toContain('rect(0,0,400,300)');
    expect(calls).not.toContain('rect(100,20,200,100)');
    expect(calls).toContain('drawImage(img,0,0,400,300,0,0,400,300)');
  });

  it('CMP-Canvas cropping: annotations are drawn over the whole image, not clipped to the frame', () => {
    const { ctx, calls } = recorder();
    paint(ctx, cropView(cropped, image), image, { scale: 1, dx: 0, dy: 0 }, new Map(), { look, crop: cropped.frame });
    expect(calls).not.toContain('rect(100,20,200,100)');
    expect(calls).toContain('moveTo(50,50)');
  });

  it('F-010.AC1 F-010.R2 the image outside the frame is dimmed, with the frame outline and eight handles on top', () => {
    const { ctx, calls } = recorder();
    paintOverlays(ctx, cropView(cropped, image), image, { scale: 2, dx: 10, dy: 0 }, { look, crop: cropped.frame });
    expect(calls).toContain(`fillStyle=${look.cropDim}`);
    // Image on screen: 10…810 × 0…600; frame: 210…610 × 40…240.
    expect(calls).toContain('fillRect(10,0,800,40)'); // above
    expect(calls).toContain('fillRect(10,240,800,360)'); // below
    expect(calls).toContain('fillRect(10,40,200,200)'); // left
    expect(calls).toContain('fillRect(610,40,200,200)'); // right
    expect(calls).toContain('strokeRect(210,40,400,200)');
    expect(calls.filter((c) => c === `fillStyle=${look.handleBorder}`)).toHaveLength(8);
    expect(calls).toContain('fillRect(205,35,10,10)'); // the top-left handle, centred on the corner
  });

  it('INV-05 without the crop overlay nothing is dimmed', () => {
    const { ctx, calls } = recorder();
    paintOverlays(ctx, cropped, image, { scale: 1, dx: 0, dy: 0 }, { look });
    expect(calls).not.toContain(`fillStyle=${look.cropDim}`);
  });
});
