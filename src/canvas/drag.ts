// MOD-Canvas — the split drag layers of ADR-0022 (amending ADR-0016). When a draw, move or resize
// starts, the annotations below the lowest dragged one are cached over the image layer (lower layer)
// and those above the highest dragged one on a transparent layer (upper layer). Each frame copies the
// lower layer, draws the dragged annotations and any undragged ones between them in drawing order, then
// copies the upper layer. While drawing, the new annotation is on top, so only the lower layer is used.
// The layers are rebuilt when an image-layer input changes, and dropped when the drag ends. They are
// built at pointerdown (`prepare`, before the RULE-05 threshold), so the first visible drag frame only
// composites (NFR-02); a gesture that ends as a click or is cancelled releases them.
// F-007: with a solid redaction dragged, every blur and pixelate above the lowest dragged solid is drawn
// each frame, not cached, so the solid shows wherever it moves (`dragRange`); the patches drawn into the
// cached layers are part of their key (an exact patch arriving rebuilds them), and the dragged part
// re-stamps the whole document's solids over its patches (ADR-0006 step 3).
// Implements: ADR-0022, NFR-02, RULE-10 (a solid shows whatever the order), F-007.R3.
import { isEffectRedaction, isSolidRedaction, type Annotation } from '../core';
import {
  paintAnnotations,
  type Backdrop,
  type PatchImage,
  type Patches,
  type Scene,
  type SceneImage,
  type Transform,
} from '../render';

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
  /** The patches the cached layers drew, in order (only those outside the dragged range, NFR-02). */
  readonly patches: readonly unknown[];
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
  /** Screen-only checkerboard under patches with a transparent background. */
  readonly backdrop?: Backdrop;
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
      a.height !== k.height ||
      a.patches.length !== k.patches.length ||
      a.patches.some((p, i) => p !== k.patches[i])
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
    const options = f.backdrop ? { backdrop: f.backdrop } : {};
    paintAnnotations(lc, f.scene, f.image, f.transform, f.patches, 0, f.lo, options);
    if (f.hi + 1 < n) {
      this.upper ??= this.surface();
      const upper = this.upper;
      if (upper.width !== f.width) upper.width = f.width;
      if (upper.height !== f.height) upper.height = f.height;
      const uc = upper.getContext('2d', { colorSpace: 'srgb' }) as Surface2D | null;
      if (!uc) return false;
      uc.setTransform(1, 0, 0, 1, 0, 0);
      uc.clearRect(0, 0, f.width, f.height);
      paintAnnotations(uc, f.scene, f.image, f.transform, f.patches, f.hi + 1, n, options);
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
      // An exact patch replacing an approximation rebuilds a cached layer only when that layer draws it
      // (the dragged annotations' own patches are drawn in the middle pass each frame anyway).
      patches: f.scene.annotations.flatMap((a, i) => (i >= f.lo && i <= f.hi ? [] : [f.patches.get(a.id)])),
    };
    if (!this.stale(key)) return true;
    if (!this.build(f)) return false;
    this.key = key;
    return true;
  }

  /**
   * ADR-0022 / NFR-02: builds the layers a drag about to start will use (called at pointerdown for a
   * draw — lo = n, hi = n − 1 — and for a move or resize with its lo and hi from `dragRange`), drawing
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
    // ADR-0006 step 3: the dragged part's patches re-stamp every solid of the document, not just its own.
    // The dragged ones count as they are now, not where the document still has them.
    const now = new Set(f.middle.annotations.map((a) => a.id));
    const solids = [...f.scene.annotations.filter((a) => !now.has(a.id)), ...f.middle.annotations];
    paintAnnotations(ctx, f.middle, f.image, f.transform, f.patches, 0, f.middle.annotations.length, {
      solids,
      ...(f.backdrop ? { backdrop: f.backdrop } : {}),
    });
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

/**
 * ADR-0022 (F-007 rule): the lowest and highest indexes a drag of the annotations at `dragged` draws each
 * frame. Normally the lowest and highest dragged ones; when a solid redaction is dragged, every blur and
 * pixelate above the lowest dragged solid is drawn each frame too (RULE-10: the solid shows wherever it
 * moves), so the upper bound reaches the highest of them. Everything between the bounds is drawn each frame.
 * F-008: a move or resize takes its lo and hi from here, at prepare() (pointerdown) and every frame
 * (<Canvas> `moveRange`); drawing a new annotation (always on top) uses lo = n, hi = n − 1.
 */
export function dragRange(annotations: readonly Annotation[], dragged: readonly number[]): { lo: number; hi: number } {
  const lo = Math.min(...dragged);
  let hi = Math.max(...dragged);
  const solids = dragged.filter((i) => {
    const a = annotations[i];
    return !!a && isSolidRedaction(a);
  });
  if (solids.length) {
    const lowestSolid = Math.min(...solids);
    for (let i = annotations.length - 1; i > hi; i--) {
      const a = annotations[i];
      if (i > lowestSolid && a && isEffectRedaction(a)) {
        hi = i;
        break;
      }
    }
  }
  return { lo, hi };
}

/** What `movePatches` asks of MOD-Effects (its `patchesFor`, ADR-0017). */
export interface PatchSource {
  patchesFor(doc: Scene, moving: ReadonlySet<string>): Patches;
}

/**
 * The patches of one move or resize frame (F-008.R2/R3, ADR-0017, ADR-0022, NFR-02). `now` is the
 * document with the dragged annotations as they are now; [lo, hi] is their `dragRange`. Only the blur and
 * pixelate redactions inside the range are asked of `effects` (approximated, with no exact job while they
 * or a solid they read move); those outside keep `still`, the patches the cached layers were built with,
 * so the layers are not rebuilt and no approximation is computed for them each frame (F-008 review M1).
 * Every solid stays in the document asked about, since effects read them (RULE-10).
 */
export function movePatches(
  effects: PatchSource,
  now: Scene,
  moving: ReadonlySet<string>,
  still: Patches,
  lo: number,
  hi: number,
): Patches {
  const inRange = (i: number) => i >= lo && i <= hi;
  const asked = { ...now, annotations: now.annotations.filter((a, i) => inRange(i) || !isEffectRedaction(a)) };
  const fresh = effects.patchesFor(asked, moving);
  const out = new Map<string, PatchImage>();
  now.annotations.forEach((a, i) => {
    const p = inRange(i) ? fresh.get(a.id) : still.get(a.id);
    if (p) out.set(a.id, p);
  });
  return out;
}
