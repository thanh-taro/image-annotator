// MOD-Render paint (F-003, ADR-0004, ADR-0016, ADR-0022): shapes in painter's order clipped to the
// canvas, fills, arrowheads, the selection overlay, and the split drag layers built once per drag.
// Contexts are recording fakes; pixels are checked end to end in tests/e2e/draw-shapes.spec.ts.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, type Annotation, type BoxAnnotation } from '../../src/core';
import { DragLayers, dragRange, movePatches, type Surface } from '../../src/canvas/drag';
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

  it('F-003.AC2 an ellipse is drawn as the ellipse inscribed in its box, not as a rectangle', () => {
    const { ctx, calls } = recorder();
    const e: Annotation = {
      id: 'e',
      kind: 'ellipse',
      style: DEFAULT_STYLES.ellipse,
      box: { x: 100, y: 100, width: 200, height: 100 },
    };
    paintAnnotations(ctx, scene([e]), image, T, new Map());
    expect(calls).toContain('ellipse(200,150,100,50,0,0,6.28)');
    expect(calls).not.toContain('rect(100,100,200,100)');
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

  it('ADR-0022 NFR-02 F-007.R3 a new patch rebuilds a cached layer only when that layer draws it', () => {
    const { create } = surfaces();
    const layers = new DragLayers(create);
    const doc = scene([rect(), arrow, line]);
    const out = recorder();
    const p = (n: number) => ({ box: { x: 0, y: 0, width: n, height: n }, bitmap: {} as CanvasImageSource });
    const withPatches = (entries: [string, ReturnType<typeof p>][]) => ({
      ...frame(doc, 1, 1, [arrow]),
      patches: new Map(entries),
    });
    const below = p(1);
    layers.paint(
      out.ctx,
      withPatches([
        [arrow.id, p(1)],
        ['r', below],
      ]),
    );
    expect(layers.builds).toBe(1);
    // The dragged annotation's own exact patch arrives: drawn in the middle pass, no rebuild.
    layers.paint(
      out.ctx,
      withPatches([
        [arrow.id, p(2)],
        ['r', below],
      ]),
    );
    expect(layers.builds).toBe(1);
    // A patch of an annotation in the cached lower layer arrives: that layer is rebuilt.
    layers.paint(
      out.ctx,
      withPatches([
        [arrow.id, p(2)],
        ['r', p(3)],
      ]),
    );
    expect(layers.builds).toBe(2);
  });

  it('ADR-0022 a drag frame draws the shape exactly as the settled frame does, so nothing jumps on release', () => {
    const { create } = surfaces();
    const layers = new DragLayers(create);
    const final: Annotation = { ...rect('translucent'), id: 'n' };
    const before = scene([arrow, line]);
    const dragOut = recorder();
    layers.paint(dragOut.ctx, frame(before, 2, 1, [final]));
    const settledOut = recorder();
    paint(settledOut.ctx, scene([arrow, line, final]), image, T, new Map(), undefined, base);
    // The settled frame draws all three; its last annotation's calls equal the drag frame's preview calls.
    // The last annotation's calls: from its first style setting to the end of the clipped pass.
    const shape = (calls: string[]) => {
      const start = calls.findLastIndex((c) => c.startsWith('strokeStyle=')) - 1;
      const transform = calls.findLast((c, i) => i < start && c.startsWith('setTransform('));
      return [transform, ...calls.slice(start, calls.indexOf('restore()', start) + 1)];
    };
    expect(shape(dragOut.calls)).toEqual(shape(settledOut.calls));
    expect(shape(dragOut.calls)).toContain('rect(100,100,200,100)');
  });

  it('F-012 security m4 RULE-14 crisp paints the image without smoothing (the export); the screen default smooths', () => {
    const crisp = recorder();
    paint(crisp.ctx, scene([]), image, T, new Map(), undefined, undefined, true);
    expect(crisp.calls).toContain('imageSmoothingEnabled=false');
    expect(crisp.calls).not.toContain('imageSmoothingEnabled=true');
    const screen = recorder();
    paint(screen.ctx, scene([]), image, T, new Map());
    expect(screen.calls).toContain('imageSmoothingEnabled=true');
  });

  // A blur at index 0, a solid at 1 that overlaps it, and an arrow on top.
  const redaction = (id: string, kind: 'solid' | 'blur', x: number): BoxAnnotation => ({
    id,
    kind: 'redaction',
    style: { ...DEFAULT_STYLES.redact, redactionKind: kind },
    box: { x, y: 100, width: 200, height: 40 },
  });
  /** A MOD-Effects stand-in whose every answer is a new patch object (as a new spec key gives). */
  function freshEffects() {
    const asked: { ids: string[]; moving: string[] }[] = [];
    return {
      asked,
      patchesFor(doc: Scene, moving: ReadonlySet<string>) {
        asked.push({ ids: doc.annotations.map((a) => a.id), moving: [...moving] });
        const out = new Map<
          string,
          { box: { x: number; y: number; width: number; height: number }; bitmap: CanvasImageSource }
        >();
        for (const a of doc.annotations)
          if (a.kind === 'redaction' && a.style.redactionKind !== 'solid')
            out.set(a.id, { box: { x: 0, y: 0, width: 1, height: 1 }, bitmap: {} as CanvasImageSource });
        return out;
      },
    };
  }

  it('NFR-02 ADR-0022 F-008 review M1 a solid moved over an earlier blur builds the drag layers once', () => {
    const { create } = surfaces();
    const layers = new DragLayers(create);
    const blur = redaction('b', 'blur', 100);
    const solid = redaction('s', 'solid', 150);
    const doc = scene([blur, solid, arrow]);
    const effects = freshEffects();
    const still = effects.patchesFor(doc, new Set());
    const ids = new Set(['s']);
    const { lo, hi } = dragRange(doc.annotations, [1]);
    expect({ lo, hi }).toEqual({ lo: 1, hi: 1 }); // no effect above the solid: the blur stays below
    const out = recorder();
    for (let x = 150; x < 200; x += 10) {
      const now = { ...doc, annotations: [blur, { ...solid, box: { ...solid.box, x } }, arrow] };
      const patches = movePatches(effects, now, ids, still, lo, hi);
      expect(patches.get('b')).toBe(still.get('b')); // the cached layer's patch, not a new one
      layers.paint(out.ctx, { ...frame(doc, lo, hi, [now.annotations[1] as Annotation]), patches });
    }
    expect(layers.builds).toBe(1);
    // The blur below the range is not asked about (no approximation per frame); the solid stays, as
    // effects read it; the dragged one is passed as moving (ADR-0017: no exact job while it moves).
    expect(effects.asked.slice(1).every((q) => !q.ids.includes('b') && q.ids.includes('s'))).toBe(true);
    expect(effects.asked.slice(1).every((q) => q.moving.join() === 's')).toBe(true);
  });

  it('RULE-10 ADR-0022 F-008 review m7 a solid moved under a later blur draws that blur each frame, with fresh patches', () => {
    const solid = redaction('s', 'solid', 150);
    const blur = redaction('b', 'blur', 100);
    const doc = scene([solid, arrow, blur]);
    const { lo, hi } = dragRange(doc.annotations, [0]);
    expect({ lo, hi }).toEqual({ lo: 0, hi: 2 }); // widened to the later blur
    const effects = freshEffects();
    const still = effects.patchesFor(doc, new Set());
    const patches = movePatches(effects, doc, new Set(['s']), still, lo, hi);
    expect(patches.get('b')).not.toBe(still.get('b')); // asked again: it reads the moving solid
    expect(effects.asked.at(-1)).toEqual({ ids: ['s', 'a', 'b'], moving: ['s'] });
  });
});
