// MOD-Canvas — the split drag layers of ADR-0022 (amending ADR-0016). When a draw, move or resize
// starts, the annotations below the lowest dragged one are cached over the image layer (lower layer)
// and those above the highest dragged one on a transparent layer (upper layer). Each frame copies the
// lower layer, draws the dragged annotations and any undragged ones between them in drawing order, then
// copies the upper layer. While drawing, the new annotation is on top, so only the lower layer is used.
// The layers are rebuilt when an image-layer input changes, and dropped when the drag ends. They are
// built at pointerdown (`prepare`, before the RULE-05 threshold), so the first visible drag frame only
// composites (NFR-02); a gesture that ends as a click or is cancelled releases them.
// (F-007 adds: with a solid redaction dragged, blur and pixelate above it are drawn each frame.)
// Implements: ADR-0022, NFR-02.
import { paintAnnotations, type Patches, type Scene, type SceneImage, type Transform } from '../render';

export type Surface = OffscreenCanvas | HTMLCanvasElement;
type Surface2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const newSurface = (): Surface =>
  typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');

/** What the cached layers were painted from; any change rebuilds them. */
interface Key {
  readonly base: CanvasImageSource;
  readonly baseVersion: number;
  readonly scene: Scene;
  readonly lo: number;
  readonly hi: number;
  readonly width: number;
  readonly height: number;
}

export interface DragFrame {
  /** The image layer (ADR-0016) and how many times it has been rebuilt (its version). */
  readonly base: CanvasImageSource;
  readonly baseVersion: number;
  /** The committed document, whose annotations [0, lo) are below and (hi, n) above the dragged ones. */
  readonly scene: Scene;
  readonly image: SceneImage;
  readonly transform: Transform;
  readonly patches: Patches;
  readonly width: number;
  readonly height: number;
  /** Index of the lowest dragged annotation (= n while drawing a new one on top). */
  readonly lo: number;
  /** Index of the highest dragged annotation (= n − 1 while drawing, so the upper layer is empty). */
  readonly hi: number;
  /** What is drawn between the layers this frame, in drawing order (the dragged ones as they are now). */
  readonly middle: Scene;
}

export class DragLayers {
  private lower: Surface | null = null;
  private upper: Surface | null = null;
  private key: Key | null = null;
  /** How many times the layers were built (for the NFR-02 check that a drag builds them once). */
  builds = 0;

  constructor(private readonly surface: () => Surface = newSurface) {}

  private stale(k: Key): boolean {
    const a = this.key;
    return (
      !a ||
      a.base !== k.base ||
      a.baseVersion !== k.baseVersion ||
      a.scene !== k.scene ||
      a.lo !== k.lo ||
      a.hi !== k.hi ||
      a.width !== k.width ||
      a.height !== k.height
    );
  }

  private build(f: DragFrame): boolean {
    this.lower ??= this.surface();
    const n = f.scene.annotations.length;
    const lower = this.lower;
    if (lower.width !== f.width) lower.width = f.width;
    if (lower.height !== f.height) lower.height = f.height;
    // ADR-0005 §4: every canvas the tool creates is sRGB.
    const lc = lower.getContext('2d', { colorSpace: 'srgb' }) as Surface2D | null;
    if (!lc) return false;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, f.width, f.height);
    lc.drawImage(f.base, 0, 0);
    paintAnnotations(lc, f.scene, f.image, f.transform, f.patches, 0, f.lo);
    if (f.hi + 1 < n) {
      this.upper ??= this.surface();
      const upper = this.upper;
      if (upper.width !== f.width) upper.width = f.width;
      if (upper.height !== f.height) upper.height = f.height;
      const uc = upper.getContext('2d', { colorSpace: 'srgb' }) as Surface2D | null;
      if (!uc) return false;
      uc.setTransform(1, 0, 0, 1, 0, 0);
      uc.clearRect(0, 0, f.width, f.height);
      paintAnnotations(uc, f.scene, f.image, f.transform, f.patches, f.hi + 1, n);
    } else if (this.upper) {
      this.upper.width = 0;
      this.upper.height = 0;
      this.upper = null;
    }
    // NFR-02: Chromium records canvas work and rasterises it when the layer is first drawn, which
    // would land on the first drag frame. Reading one pixel makes it rasterise now, at pointerdown.
    lc.getImageData(0, 0, 1, 1);
    this.builds++;
    return true;
  }

  /** Builds the layers for `f` unless they are fresh; false if a context is unavailable. */
  private ensure(f: DragFrame): boolean {
    const key: Key = {
      base: f.base,
      baseVersion: f.baseVersion,
      scene: f.scene,
      lo: f.lo,
      hi: f.hi,
      width: f.width,
      height: f.height,
    };
    if (!this.stale(key)) return true;
    if (!this.build(f)) return false;
    this.key = key;
    return true;
  }

  /**
   * ADR-0022 / NFR-02: builds the layers a drag about to start will use (called at pointerdown for a
   * draw — lo = n, hi = n − 1 — and, from F-008, for a move or resize with its lo and hi), drawing
   * nothing. The first drag frame then finds them fresh. `f.middle` is not read.
   */
  prepare(f: DragFrame): boolean {
    return this.ensure(f);
  }

  /** Paints one drag frame into `ctx`: lower layer, the middle annotations, upper layer. */
  paint(ctx: Surface2D, f: DragFrame): void {
    if (!this.ensure(f)) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.lower) ctx.drawImage(this.lower, 0, 0);
    paintAnnotations(ctx, f.middle, f.image, f.transform, f.patches);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.upper) ctx.drawImage(this.upper, 0, 0);
  }

  /** The drag ended: the layers' pixels are freed (ADR-0022, NFR-04). */
  release(): void {
    for (const c of [this.lower, this.upper]) {
      if (c) {
        c.width = 0;
        c.height = 0;
      }
    }
    this.lower = null;
    this.upper = null;
    this.key = null;
  }
}
