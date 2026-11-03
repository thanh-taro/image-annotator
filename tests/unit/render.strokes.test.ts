// MOD-Render paint for pen strokes and highlights (F-004, ADR-0004 §4, platform-mapping RULE-09):
// strokes as midpoint quadratics with round ends; a highlight as one path stroked once at 40 %, so it
// never darkens itself; dots for clicks; the selection overlay on a path. Recording fake contexts; the
// pixels are checked end to end in tests/e2e/draw-strokes.spec.ts.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, type Annotation, type Point } from '../../src/core';
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

const image = { width: 1000, height: 800 } as SceneImage; // s = 800: stroke M = 5, L = 10
const T = { scale: 1, dx: 0, dy: 0 };
const scene = (annotations: Annotation[]): Scene => ({
  annotations,
  frame: { x: 0, y: 0, width: 1000, height: 800 },
  padding: { size: 'none', background: 'transparent' },
});
const zigzag: Point[] = [
  { x: 100, y: 100 },
  { x: 150, y: 200 },
  { x: 200, y: 100 },
  { x: 250, y: 200 },
];
const pen = (points: Point[] = zigzag): Annotation => ({ id: 'p', kind: 'stroke', style: DEFAULT_STYLES.pen, points });
const marker = (points: Point[] = zigzag): Annotation => ({
  id: 'h',
  kind: 'highlight',
  style: DEFAULT_STYLES.highlight,
  points,
});
const look: OverlayLook = {
  outline: '#a47bff',
  halo: '#0b0812',
  handleFill: '#ffffff',
  handleBorder: '#6837e0',
  lineWidth: 2,
  handleSize: 10,
};

/** The calls from the annotation's first style setting to the end of its pass. */
const pass = (calls: string[]) => calls.slice(calls.indexOf('globalAlpha=1', calls.indexOf('clip()')));

describe('MOD-Render paint strokes and highlights', () => {
  it('F-004.AC1 F-004.R1 a pen stroke is one path of midpoint quadratics in its colour and stroke size', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([pen()]), image, T, new Map());
    const p = pass(calls);
    expect(p).toContain(`strokeStyle=${PALETTE_HEX.red}`);
    expect(p).toContain('lineWidth=5');
    expect(p).toContain('lineCap=round');
    expect(p).toContain('lineJoin=round');
    expect(p.filter((c) => c.startsWith('moveTo('))).toEqual(['moveTo(100,100)']);
    expect(p.filter((c) => c.startsWith('quadraticCurveTo('))).toEqual([
      'quadraticCurveTo(150,200,175,150)',
      'quadraticCurveTo(200,100,250,200)',
    ]);
    expect(p.filter((c) => c === 'stroke()')).toHaveLength(1);
    expect(p).not.toContain('lineTo(150,200)'); // no straight segments between the samples
  });

  it('F-004.AC2 F-004.R2 RULE-09 a highlight is drawn at 40 % opacity, 3 × the stroke size wide', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([marker()]), image, T, new Map());
    const p = pass(calls);
    expect(p).toContain(`strokeStyle=${PALETTE_HEX.yellow}`);
    expect(p).toContain('globalAlpha=0.4');
    expect(p).toContain('lineWidth=30');
    // Its alpha is set before its one stroke and put back after it, so later annotations are opaque.
    expect(p.indexOf('globalAlpha=0.4')).toBeLessThan(p.indexOf('stroke()'));
    expect(p.lastIndexOf('globalAlpha=1')).toBeGreaterThan(p.indexOf('stroke()'));
  });

  it('F-004.AC3 RULE-09 a highlight that crosses itself is one path stroked once, so overlaps do not darken', () => {
    const back: Point[] = [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 150, y: 100 },
      { x: 250, y: 100 },
    ];
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([marker(back)]), image, T, new Map());
    const p = pass(calls);
    expect(p.filter((c) => c === 'beginPath()')).toHaveLength(1);
    expect(p.filter((c) => c === 'stroke()')).toHaveLength(1);
    expect(p).not.toContain('fill()');
  });

  it('F-004.AC5 RULE-05 a pen dot is a filled circle whose diameter is the stroke size', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([pen([{ x: 40, y: 50 }])]), image, T, new Map());
    const p = pass(calls);
    expect(p).toContain('arc(40,50,2.5,0,6.28)');
    expect(p).toContain(`fillStyle=${PALETTE_HEX.red}`);
    expect(p).toContain('fill()');
    expect(p).not.toContain('stroke()');
  });

  it('F-004.AC6 RULE-05 a highlight dot is a square as wide as the highlight, at 40 %', () => {
    const { ctx, calls } = recorder();
    paintAnnotations(ctx, scene([marker([{ x: 40, y: 50 }])]), image, T, new Map());
    const p = pass(calls);
    expect(p).toContain('rect(25,35,30,30)');
    expect(p).toContain('globalAlpha=0.4');
    expect(p).toContain('fill()');
  });

  it('F-004.AC6 CMP-Canvas "selected" a selected path shows the outline of its points’ box and eight handles', () => {
    const { ctx, calls } = recorder();
    paint(ctx, scene([pen()]), image, T, new Map(), { selection: ['p'], look });
    expect(calls).toContain('strokeRect(100,100,150,100)');
    expect(calls.filter((c) => c === 'fillStyle=#6837e0')).toHaveLength(8);
  });

  it('ADR-0022 NFR-02 a stroke being drawn is painted over the cached lower layer, built once per drag', () => {
    const made: string[][] = [];
    const create = (): Surface => {
      const r = recorder();
      made.push(r.calls);
      return { width: 1, height: 1, getContext: () => r.ctx } as unknown as Surface;
    };
    const layers = new DragLayers(create);
    const doc = scene([marker()]);
    const out = recorder();
    const base = {} as CanvasImageSource;
    for (let n = 2; n <= 6; n++) {
      const growing = zigzag.concat(zigzag).slice(0, n);
      layers.paint(out.ctx, {
        base,
        baseVersion: 1,
        scene: doc,
        image,
        transform: T,
        patches: new Map(),
        width: 1000,
        height: 800,
        lo: 1,
        hi: 0,
        middle: { ...doc, annotations: [pen(growing)] },
      });
    }
    expect(layers.builds).toBe(1);
    expect(made[0]).toContain('globalAlpha=0.4'); // the committed highlight is in the lower layer
    expect(out.calls.filter((c) => c === `strokeStyle=${PALETTE_HEX.red}`)).toHaveLength(5);
  });

  it('ADR-0022 NFR-02 prepare() builds the layers at pointerdown, so the first drag frame only composites', () => {
    const made: string[][] = [];
    const create = (): Surface => {
      const r = recorder();
      made.push(r.calls);
      return { width: 1, height: 1, getContext: () => r.ctx } as unknown as Surface;
    };
    const layers = new DragLayers(create);
    const doc = scene([marker()]);
    const base = {} as CanvasImageSource;
    const f = (middle: Annotation[]) => ({
      base,
      baseVersion: 1,
      scene: doc,
      image,
      transform: T,
      patches: new Map(),
      width: 1000,
      height: 800,
      lo: 1,
      hi: 0,
      middle: { ...doc, annotations: middle },
    });
    expect(layers.prepare(f([]))).toBe(true);
    expect(layers.builds).toBe(1);
    expect(made[0]).toContain('getImageData(0,0,1,1)'); // rasterised now, not on the first drag frame
    expect(layers.prepare(f([]))).toBe(true); // already fresh: no second build
    expect(layers.builds).toBe(1);
    const out = recorder();
    layers.paint(out.ctx, f([pen()]));
    expect(layers.builds).toBe(1);
    expect(out.calls).not.toContain('globalAlpha=0.4'); // the committed highlight comes from the layer
  });
});
