// MOD-Canvas crop view scenes (F-010.R2, NFR-02, review m3): the crop view keeps its frame and padding
// objects while the image and background do (the image layer, ADR-0016, is not rebuilt for an annotation
// edit) and the whole scene while the shown scene does (a frame drag builds the drag layers once, ADR-0022).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STYLES, type Annotation } from '../../src/core';
import type { Doc } from '../../src/document';
import { CropScenes } from '../../src/canvas/crop';
import { DragLayers, type Surface } from '../../src/canvas/drag';
import { ImageLayer } from '../../src/canvas/layer';
import type { BaseView } from '../../src/render';

/** A 2D context that accepts every call. */
const ctx = () =>
  new Proxy({ canvas: { width: 1, height: 1 } } as Record<string, unknown>, {
    get: (target, key: string) => (key in target ? target[key] : () => undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
const surface = (): Surface => ({ width: 1, height: 1, getContext: () => ctx() }) as unknown as Surface;

const image = { width: 1920, height: 1080 } as unknown as ImageBitmap;
const rect: Annotation = {
  id: 'r',
  kind: 'rectangle',
  style: DEFAULT_STYLES.rectangle,
  box: { x: 100, y: 100, width: 200, height: 100 },
};
const doc = (annotations: Annotation[], background: Doc['padding']['background'] = 'transparent'): Doc => ({
  annotations,
  frame: { x: 200, y: 0, width: 1720, height: 1080 },
  padding: { size: 'none', background },
});
const T = { scale: 0.5, dx: 0, dy: 0 };
const VIEW = {
  surround: '#000',
  checkerA: '#111',
  checkerB: '#222',
  checkerSize: 8,
  outline: { colour: '#333', width: 1 },
} satisfies BaseView;

afterEach(() => vi.unstubAllGlobals());

describe('MOD-Canvas crop view scenes', () => {
  it('F-010.R2 the crop view shows the whole image without padding, with the annotations', () => {
    const d = doc([rect]);
    const shown = new CropScenes().get(d, image);
    expect(shown.frame).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(shown.padding).toEqual({ size: 'none', background: 'transparent' });
    expect(shown.annotations).toBe(d.annotations);
  });

  it('NFR-02 ADR-0022 F-010.R1 a frame drag builds the drag layers once', () => {
    const crops = new CropScenes();
    const layers = new DragLayers(surface);
    const d = doc([rect]);
    const out = ctx();
    const base = {} as CanvasImageSource; // the image layer, unchanged during the drag
    // Every paint of the drag reads the crop view of the same document again (as <Canvas> does).
    for (let i = 0; i < 5; i++) {
      const scene = crops.get(d, image);
      const n = scene.annotations.length;
      layers.paint(out, {
        base,
        baseVersion: 1,
        scene,
        image,
        transform: T,
        patches: new Map(),
        width: 1000,
        height: 800,
        lo: n,
        hi: n - 1,
        middle: { ...scene, annotations: [] },
      });
    }
    expect(layers.builds).toBe(1);
  });

  it('NFR-02 ADR-0016 F-010.R2 an annotation edit in the crop view does not rebuild the image layer', () => {
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width = 1;
        height = 1;
        getContext = () => ctx();
      },
    );
    const crops = new CropScenes();
    const layer = new ImageLayer();
    const inputs = (d: Doc) => ({
      image,
      doc: crops.get(d, image),
      transform: T,
      width: 1000,
      height: 800,
      theme: 'dark',
      crisp: false,
    });
    layer.get(inputs(doc([])), () => VIEW);
    layer.get(inputs(doc([rect])), () => VIEW); // a rectangle drawn in the crop view
    layer.get(inputs(doc([{ ...rect, box: { ...rect.box, x: 300 } }])), () => VIEW); // and moved
    expect(layer.rebuilds).toBe(1);
    layer.get(inputs(doc([rect], 'white')), () => VIEW); // the background is part of the layer
    expect(layer.rebuilds).toBe(2);
  });
});
