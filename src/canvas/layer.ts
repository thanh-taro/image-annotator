// MOD-Canvas — the display image layer (ADR-0016, promoted from the SP-engine spike's `baseLayer`):
// a device-sized canvas holding MOD-Render `paintBase` for the current view. It is rebuilt only when
// one of its inputs changes (zoom, pan, viewport size, device pixel ratio, theme, image, frame,
// padding or background, crop view on or off: F-010 passes the crop view's own frame and padding), so repaints for anything else — and the
// annotations of F-003 on — just copy it. Several inputs in one animation frame cost one rebuild.
import type { Doc } from '../document';
import { paintBase, type BaseView, type Transform } from '../render';

export interface LayerInputs {
  readonly image: ImageBitmap;
  readonly doc: Doc;
  readonly transform: Transform;
  readonly width: number;
  readonly height: number;
  readonly theme: string;
  /** Architecture A5: no smoothing on screen from 200 %. */
  readonly crisp: boolean;
}

type Layer2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export class ImageLayer {
  private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  private last: LayerInputs | null = null;
  /** How many times the layer was painted (for the NFR-02 check that zoom and pan do not over-rebuild). */
  rebuilds = 0;

  private changed(next: LayerInputs): boolean {
    const a = this.last;
    if (!a) return true;
    // The document's frame and padding are what the layer reads; annotations are not in it (ADR-0016).
    return (
      a.image !== next.image ||
      a.doc.frame !== next.doc.frame ||
      a.doc.padding !== next.doc.padding ||
      a.transform.scale !== next.transform.scale ||
      a.transform.dx !== next.transform.dx ||
      a.transform.dy !== next.transform.dy ||
      a.width !== next.width ||
      a.height !== next.height ||
      a.theme !== next.theme ||
      a.crisp !== next.crisp
    );
  }

  /** The layer for these inputs, painted again only if they changed. `view` is read only when painting. */
  get(inputs: LayerInputs, view: () => BaseView): CanvasImageSource | null {
    if (!this.canvas) {
      this.canvas =
        typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
    }
    const c = this.canvas;
    if (!this.changed(inputs)) return c;
    if (c.width !== inputs.width) c.width = inputs.width;
    if (c.height !== inputs.height) c.height = inputs.height;
    // ADR-0005 §4: every canvas the tool creates is sRGB.
    const ctx = c.getContext('2d', { colorSpace: 'srgb' }) as Layer2D | null;
    if (!ctx) return null;
    paintBase(ctx, inputs.doc, inputs.image, inputs.transform, view());
    this.last = inputs;
    this.rebuilds++;
    return c;
  }

  /** Frees the layer's pixels (NFR-04) when the canvas unmounts. */
  release(): void {
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
    }
    this.canvas = null;
    this.last = null;
  }
}
