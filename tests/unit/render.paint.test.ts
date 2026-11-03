// MOD-Render paint (F-003, ADR-0004, ADR-0016, ADR-0022): shapes in painter's order clipped to the
// canvas, fills, arrowheads, the selection overlay, and the split drag layers built once per drag.
// Contexts are recording fakes; pixels are checked end to end in tests/e2e/draw-shapes.spec.ts.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, type Annotation } from '../../src/core';
import { DragLayers, type Surface } from '../../src/canvas/drag';
import { paint, paintAnnotations, PALETTE_HEX, type OverlayLook, type Scene, type SceneImage } from '../../src/render';

function recorder(width = 1000, height = 800) {
  const calls: string[] = [];
  const ctx = new Proxy(
    { canvas: { width, height } },
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
const style = DEFAULT_STYLES.rectangle;
const rect = (fill: 'none' | 'solid' | 'translucent' = 'none'): Annotation => ({
  id: 'r',
  kind: 'rectangle',
  style: { ...style, fill },
  box: { x: 100, y: 100, width: 200, height: 100 },
});
const arrow: Annotation = { id: 'a', kind: 'arrow', style, tail: { x: 0, y: 0 }, head: { x: 100, y: 0 } };
const line: Annotation = { id: 'l', kind: 'line', style, tail: { x: 0, y: 0 }, head: { x: 100, y: 0 } };
const scene = (annotations: Annotation[]): Scene => ({
  annotations,
  frame: { x: 0, y: 0, width: 1000, height: 800 },
  padding: { size: 'none', background: 'transparent' },
});
const look: OverlayLook = {
  outline: '#a47bff',
  halo: '#0b0812',
  handleFill: '#ffffff',
  handleBorder: '#6837e0',
  lineWidth: 2,
  handleSize: 10,
};
const T = { scale: 1, dx: 0, dy: 0 };

describe('MOD-Render paint', () => {
  it('F-003.AC1 F-003.R1 a rectangle is stroked in its colour at its stroke size, clipped to the canvas', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([rect()]), image, T, new Map());
    expect(calls).toContain('rect(0,0,1000,800)');
    expect(calls.indexOf('clip()')).toBeLessThan(calls.indexOf('rect(100,100,200,100)'));
    expect(calls).toContain(`strokeStyle=${PALETTE_HEX.red}`);
    expect(calls).toContain('lineWidth=5');
    expect(calls).not.toContain('fill()');
  });

  it('F-003.AC5 F-003.R3 translucent fills at 30 % opacity in the colour, solid at 100 %, then the outline', () => {
    const t = recorder();
    paintAnnotations(t.ctx, scene([rect('translucent')]), image, T, new Map());
    const fill = t.calls.indexOf('fill()');
    expect(t.calls[fill - 1]).toBe('globalAlpha=0.3');
    expect(t.calls.indexOf('stroke()')).toBeGreaterThan(fill);
    const s = recorder();
    paintAnnotations(s.ctx, scene([rect('solid')]), image, T, new Map());
    expect(s.calls[s.calls.indexOf('fill()') - 1]).toBe('globalAlpha=1');
  });

  it('F-003.AC3 F-003.R2 an arrow is a shaft to the head base and a filled 20 × 15 px head at its end', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([arrow]), image, T, new Map());
    expect(calls).toContain('lineTo(80,0)'); // shaft ends at the head's base
    expect(calls).toContain('moveTo(100,0)'); // tip
    expect(calls).toContain('lineTo(80,7.5)');
    expect(calls).toContain('lineTo(80,-7.5)');
    expect(calls).toContain('fill()');
  });

  it('F-003.AC4 a line is one stroked segment with no head', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([line]), image, T, new Map());
    expect(calls).toContain('lineTo(100,0)');
    expect(calls).not.toContain('fill()');
  });

  it('NFR-08 ADR-0004 without a layer (the export) paint draws the image itself; with one it copies the layer', () => {
    const exportCtx = recorder();
    paint(exportCtx.ctx, scene([rect()]), image, T, new Map());
    expect(exportCtx.calls).toContain('drawImage(img,0,0,1000,800,0,0,1000,800)');
    const screen = recorder();
    paint(screen.ctx, scene([rect()]), image, T, new Map(), undefined, {} as CanvasImageSource);
    expect(screen.calls).toContain('drawImage(img,0,0)');
    expect(screen.calls).not.toContain('drawImage(img,0,0,1000,800,0,0,1000,800)');
  });

  it('F-003.AC9 CMP-Canvas "selected" a single selected arrow shows handles at its two end points', () => {
    const { ctx, calls } = recorder();
    paint(ctx, scene([arrow]), image, { scale: 2, dx: 10, dy: 20 }, new Map(), { selection: ['a'], look });
    expect(calls).toContain('fillRect(5,15,10,10)'); // tail handle at (10, 20) on screen
    expect(calls).toContain('fillRect(205,15,10,10)'); // head handle at (210, 20)
    expect(calls).toContain('fillStyle=#ffffff');
    expect(calls).not.toContain('strokeRect(10,20,200,0)'); // lines have no box outline
  });

  it('CMP-Canvas "selected" a box shows its outline and eight handles; nothing when not selected', () => {
    const one = recorder();
    paint(one.ctx, scene([rect()]), image, T, new Map(), { selection: ['r'], look });
    expect(one.calls).toContain('strokeRect(100,100,200,100)');
    expect(one.calls.filter((c) => c === 'fillStyle=#6837e0')).toHaveLength(8);
    const none = recorder();
    paint(none.ctx, scene([rect()]), image, T, new Map(), { selection: [], look });
    expect(none.calls).not.toContain('strokeRect(100,100,200,100)');
  });
});

describe('MOD-Canvas split drag layers (ADR-0022)', () => {
  function surfaces() {
    const made: { canvas: Surface; calls: string[] }[] = [];
    const create = (): Surface => {
      const r = recorder();
      const canvas = { width: 1, height: 1, getContext: () => r.ctx } as unknown as Surface;
      made.push({ canvas, calls: r.calls });
      return canvas;
    };
    return { made, create };
  }
  const base = {} as CanvasImageSource;
  const frame = (s: Scene, lo: number, hi: number, middle: Annotation[], baseVersion = 1) => ({
    base,
    baseVersion,
    scene: s,
    image,
    transform: T,
    patches: new Map(),
    width: 1000,
    height: 800,
    lo,
    hi,
    middle: { ...s, annotations: middle },
  });

  it('ADR-0022 NFR-02 while drawing, the lower layer holds every annotation and is built once per drag', () => {
    const { made, create } = surfaces();
    const layers = new DragLayers(create);
    const doc = scene([rect(), arrow]);
    const out = recorder();
    for (let i = 0; i < 5; i++) layers.paint(out.ctx, frame(doc, 2, 1, [line]));
    expect(layers.builds).toBe(1);
    expect(made).toHaveLength(1); // no upper layer: the new shape is on top
    expect(made[0]?.calls).toContain('rect(100,100,200,100)');
    expect(out.calls.filter((c) => c === 'lineTo(100,0)')).toHaveLength(5); // the preview, every frame
    // An image-layer input changes (zoom, pan, …): the layers are rebuilt.
    layers.paint(out.ctx, frame(doc, 2, 1, [line], 2));
    expect(layers.builds).toBe(2);
    layers.release();
    expect(made[0]?.canvas.width).toBe(0);
  });

  it('ADR-0022 moving a middle annotation caches those below and above it in two layers', () => {
    const { made, create } = surfaces();
    const layers = new DragLayers(create);
    const doc = scene([rect(), arrow, line]);
    const out = recorder();
    layers.paint(out.ctx, frame(doc, 1, 1, [arrow]));
    expect(made).toHaveLength(2);
    expect(made[0]?.calls).toContain('rect(100,100,200,100)'); // below
    expect(made[1]?.calls).toContain('lineTo(100,0)'); // above
    expect(out.calls).toContain('lineTo(80,0)'); // the dragged arrow, drawn each frame
  });
});
