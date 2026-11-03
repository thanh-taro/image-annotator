// MOD-Render — one paint function for the screen and the export
// (specs/40-technical/modules/MOD-Render.md, ADR-0004, ADR-0016). Imports MOD-Core only and never
// reads language, theme or view state beyond the transform it is given (INV-05).
// The palette constants are generated from the tokens (scripts/gen-tokens.mjs). `paintBase` is built
// (F-001); `paint` throws until F-003…F-007 are built.
import { canvasRect, type Annotation, type Box, type Colour, type Frame, type Padding } from '../core';
import { PALETTE_HEX } from './palette.gen';

export { PALETTE, PALETTE_HEX, type PaletteColour } from './palette.gen';

/** The document as MOD-Render reads it (structurally the same as MOD-Document's Doc). */
export interface Scene {
  readonly annotations: readonly Annotation[];
  readonly frame: Frame;
  readonly padding: Padding;
}

/** Image pixels → context pixels: a uniform scale and a translation. */
export interface Transform {
  readonly scale: number;
  readonly dx: number;
  readonly dy: number;
}

/** Finished blur/pixelate patches by annotation id (MOD-Effects). */
export type Patches = ReadonlyMap<string, { readonly box: Box; readonly bitmap: CanvasImageSource }>;

/** Screen-only overlays (selection, handles, crop frame, checkerboard); never passed by the export. */
export interface Overlays {
  readonly selection?: readonly string[];
  readonly crop?: boolean;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Render ${name}`);
};

export function paint(
  _ctx: Ctx,
  _scene: Scene,
  _image: CanvasImageSource,
  _transform: Transform,
  _patches: Patches,
  _overlays?: Overlays,
  _layer?: CanvasImageSource,
): void {
  notImplemented('paint');
}

/** Screen-only inputs of the image layer (ADR-0016): the surround and the checkerboard (theme colours). */
export interface BaseView {
  /** The surround outside the canvas (style.md "Work area": color.work-area). */
  readonly surround: string;
  readonly checkerA: string;
  readonly checkerB: string;
  /** One checker square, in context pixels (style.md: size.checker on screen × device pixel ratio). */
  readonly checkerSize: number;
  /** style.md "Work area": a hairline around the canvas so its edge shows on light images. */
  readonly outline: { readonly colour: string; readonly width: number };
  /** Architecture A5: at zoom ≥ 200 % the image is drawn without smoothing on screen (INV-05: export unaffected). */
  readonly crisp?: boolean;
}

/**
 * ADR-0016 image layer (MOD-Render `paintBase(ctx, doc, image, transform, view)`): the screen-only
 * surround and the checkerboard behind transparent pixels, then scene steps 1–2 — the background over
 * the canvas, then the image clipped to the frame. The export never calls it.
 * Implements: F-001.R6 (the image as decoded, oriented, INV-03 sRGB context), RULE-14 (canvas and
 * background; image pixels only inside the frame), F-001 edge case "transparent PNG over a checkerboard".
 */
export function paintBase(
  ctx: Ctx,
  scene: Scene,
  image: CanvasImageSource,
  transform: Transform,
  view: BaseView,
): void {
  const { scale, dx, dy } = transform;
  const canvas = canvasRect(scene.frame, scene.padding.size);
  const onScreen = screenRect(canvas, transform);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = view.surround;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const w = Math.max(1, Math.round(view.outline.width));
  ctx.fillStyle = view.outline.colour;
  ctx.fillRect(onScreen.x - w, onScreen.y - w, onScreen.width + 2 * w, onScreen.height + 2 * w);
  paintChecker(ctx, onScreen, view);

  ctx.setTransform(scale, 0, 0, scale, dx, dy);
  const background = scene.padding.background;
  if (background !== 'transparent') {
    ctx.fillStyle = paletteColour(background);
    ctx.fillRect(canvas.x, canvas.y, canvas.width, canvas.height);
  }
  const { frame } = scene;
  ctx.beginPath();
  ctx.rect(frame.x, frame.y, frame.width, frame.height);
  ctx.clip();
  ctx.imageSmoothingEnabled = !view.crisp;
  ctx.imageSmoothingQuality = 'high';
  // Only the part of the frame on screen is drawn (one source pixel of margin keeps the smoothing at its
  // edges); zoomed in, this is a small part of the image (NFR-02).
  const src = visibleSource(frame, transform, ctx.canvas);
  if (src) ctx.drawImage(image, src.x, src.y, src.width, src.height, src.x, src.y, src.width, src.height);
  ctx.restore();
}

/** The whole image pixels of `frame` that land on the context, plus one pixel around them, or null. */
function visibleSource(frame: Box, { scale, dx, dy }: Transform, out: { width: number; height: number }): Box | null {
  const x = Math.max(frame.x, Math.floor(-dx / scale) - 1);
  const y = Math.max(frame.y, Math.floor(-dy / scale) - 1);
  const right = Math.min(frame.x + frame.width, Math.ceil((out.width - dx) / scale) + 1);
  const bottom = Math.min(frame.y + frame.height, Math.ceil((out.height - dy) / scale) + 1);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

/** A box in image pixels → context pixels, snapped outward to whole pixels. */
function screenRect(box: Box, { scale, dx, dy }: Transform): Box {
  const x = Math.floor(dx + box.x * scale);
  const y = Math.floor(dy + box.y * scale);
  return {
    x,
    y,
    width: Math.ceil(dx + (box.x + box.width) * scale) - x,
    height: Math.ceil(dy + (box.y + box.height) * scale) - y,
  };
}

/**
 * The checkerboard over `r`, drawn only where it meets the context (zoomed in, the canvas can be far
 * larger than the screen), with the squares' phase anchored to the canvas corner so panning moves it.
 */
function paintChecker(ctx: Ctx, r: Box, view: BaseView): void {
  const size = Math.max(1, Math.round(view.checkerSize));
  const x0 = Math.max(r.x, 0);
  const y0 = Math.max(r.y, 0);
  const x1 = Math.min(r.x + r.width, ctx.canvas.width);
  const y1 = Math.min(r.y + r.height, ctx.canvas.height);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.fillStyle = view.checkerA;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.beginPath();
  const row0 = Math.floor((y0 - r.y) / size);
  const col0 = Math.floor((x0 - r.x) / size);
  for (let row = row0; r.y + row * size < y1; row++) {
    const y = r.y + row * size;
    for (let col = col0 + ((col0 + row) % 2); r.x + col * size < x1; col += 2) {
      const x = r.x + col * size;
      ctx.rect(x, y, Math.min(size, r.x + r.width - x), Math.min(size, r.y + r.height - y));
    }
  }
  ctx.fillStyle = view.checkerB;
  ctx.fill();
}

/** The sRGB value of a palette colour (tokens.json, ADR-0013). */
export function paletteColour(name: Colour): string {
  return PALETTE_HEX[name];
}

/** RULE-07 contrast pairing: black on yellow, orange, green, white; white on red, blue, purple, black. */
export function contrastPair(name: Colour): 'black' | 'white' {
  return name === 'yellow' || name === 'orange' || name === 'green' || name === 'white' ? 'black' : 'white';
}
