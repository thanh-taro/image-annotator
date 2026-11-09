// MOD-Canvas image layer (ADR-0016) with F-011: the padding and the background are inputs of the cached
// screen layer, so changing either rebuilds it (RULE-14, review m4); a step that leaves them alone does not.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageLayer } from '../../src/canvas/layer';
import { add, setBackground, setPadding, startSession, type Doc } from '../../src/document';
import { DEFAULT_STYLES } from '../../src/core';
import type { BaseView } from '../../src/render';

/** A 2D context that accepts every call. */
const ctx = () =>
  new Proxy({ canvas: { width: 1, height: 1 } } as Record<string, unknown>, {
    get: (target, key: string) => (key in target ? target[key] : () => undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;

const image = { width: 1000, height: 500 } as unknown as ImageBitmap;
const VIEW: BaseView = {
  surround: '#000',
  checkerA: '#fff',
  checkerB: '#eee',
  checkerSize: 8,
  outline: { colour: '#999', width: 1 },
};
const inputs = (doc: Doc) => ({
  image,
  doc,
  transform: { scale: 1, dx: 0, dy: 0 },
  width: 1200,
  height: 800,
  theme: 'light',
  crisp: false,
});

describe('MOD-Canvas image layer and the padding', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ADR-0016 RULE-14 F-011.R1 F-011.R2 a padding or background change rebuilds the screen layer; an annotation does not', () => {
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width = 1;
        height = 1;
        getContext = () => ctx();
      },
    );
    const s = startSession({ width: 1000, height: 500, sourceName: null, sourceType: 'png' });
    const layer = new ImageLayer();
    layer.get(inputs(s.doc), () => VIEW);
    expect(layer.rebuilds).toBe(1);
    const padded = s.history.apply(setPadding('M'), []).doc;
    layer.get(inputs(padded), () => VIEW);
    expect(layer.rebuilds).toBe(2);
    const white = s.history.apply(setBackground('white'), []).doc;
    layer.get(inputs(white), () => VIEW);
    expect(layer.rebuilds).toBe(3);
    const rect = {
      id: 'a1',
      kind: 'rectangle' as const,
      box: { x: 10, y: 10, width: 50, height: 40 },
      style: DEFAULT_STYLES.rectangle,
    };
    const drawn = s.history.apply(add(rect), []).doc;
    layer.get(inputs(drawn), () => VIEW);
    expect(layer.rebuilds).toBe(3);
  });
});
