// MOD-Render — one paint function for the screen and the export
// (specs/40-technical/modules/MOD-Render.md, ADR-0004, ADR-0016, ADR-0022). Imports MOD-Core only and
// never reads language, theme or view state beyond the transform it is given (INV-05).
// The palette constants are generated from the tokens (scripts/gen-tokens.mjs). `paintBase` is built
// (F-001); `paint` draws rectangles, ellipses, lines and arrows and the selection overlay (F-003), pen
// strokes and highlights (F-004); the other kinds join with F-005…F-007. Promoted from the SP-engine spike (ADR-0004, ADR-0016, ADR-0022).
import {
  ARROW_HEAD_LENGTH,
  arrowHead,
  canvasRect,
  handlesOf,
  HIGHLIGHT_OPACITY,
  markWidth,
  strokePieces,
  isLineAnnotation,
  shapeBox,
  strokePixels,
  TRANSLUCENT_FILL_OPACITY,
  type Annotation,
  type Box,
  type Colour,
  type Frame,
  type Padding,
  type PathAnnotation,
} from '../core';
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

/** The image as `paint` reads it: drawable, with its size (RULE-04 sizes use its shorter side). */
export type SceneImage = CanvasImageSource & { readonly width: number; readonly height: number };

/**
 * How the screen-only selection overlay looks (style.md principle 3: selectionOutline, handleFill and
 * handleBorder read on any image). Context pixels: the caller scales them by the device pixel ratio.
 */
export interface OverlayLook {
  readonly outline: string;
  /** A thin halo around the outline (the work area colour) so it reads on any image. */
  readonly halo: string;
  readonly handleFill: string;
  readonly handleBorder: string;
  /** Outline and handle border width (border.width.focus). */
  readonly lineWidth: number;
  /** The visible handle's side (size.handle). */
  readonly handleSize: number;
}

/** Screen-only overlays (selection, handles, crop frame, checkerboard); never passed by the export. */
export interface Overlays {
  readonly selection?: readonly string[];
  readonly crop?: boolean;
  readonly look?: OverlayLook;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * The one scene painter for the screen and the export (ADR-0004 §1, NFR-08). With `layer` (the display
 * image layer, ADR-0016) it copies that layer instead of scene steps 1–2; the export never passes one
 * and gets the background and the image clipped to the frame from the image itself. Then the
 * annotations in painter's order, clipped to the canvas (RULE-14), then the screen-only overlays.
 * Implements: F-003.R1/R2/R3, F-004.R1/R2, RULE-09, NFR-08.
 */
export function paint(
  ctx: Ctx,
  scene: Scene,
  image: SceneImage,
  transform: Transform,
  patches: Patches,
  overlays?: Overlays,
  layer?: CanvasImageSource,
): void {
  ctx.save();
  if (layer) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(layer, 0, 0);
  } else paintScene(ctx, scene, image, transform, false);
  ctx.restore();
  paintAnnotations(ctx, scene, image, transform, patches);
  if (overlays?.look && overlays.selection?.length)
    paintSelection(ctx, scene, transform, overlays.selection, overlays.look);
}

/**
 * Scene step 3 alone, for the annotations from index `from` (inclusive) to `to` (exclusive) in
 * painter's order, clipped to the canvas. The split drag layers (ADR-0022) cache the parts below and
 * above the dragged annotations with it and draw the rest each frame.
 */
export function paintAnnotations(
  ctx: Ctx,
  scene: Scene,
  image: SceneImage,
  transform: Transform,
  _patches: Patches,
  from = 0,
  to = scene.annotations.length,
): void {
  if (to <= from) return;
  const { scale, dx, dy } = transform;
  const canvas = canvasRect(scene.frame, scene.padding.size);
  const shortSide = Math.min(image.width, image.height);
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, dx, dy);
  ctx.beginPath();
  ctx.rect(canvas.x, canvas.y, canvas.width, canvas.height);
  ctx.clip(); // RULE-14: annotations show only on the canvas (F-003 edge case: clipped while dragging)
  for (let i = from; i < to; i++) {
    const a = scene.annotations[i];
    if (a) drawAnnotation(ctx, a, shortSide);
  }
  ctx.restore();
}

/** One annotation in image pixels (the context already carries the transform). */
function drawAnnotation(ctx: Ctx, a: Annotation, shortSide: number): void {
  const stroke = strokePixels(a.style, shortSide);
  const colour = paletteColour(a.style.color);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = stroke;
  ctx.beginPath();
  switch (a.kind) {
    case 'rectangle':
    case 'ellipse': {
      const b = shapeBox(a);
      ctx.lineJoin = 'miter';
      if (a.kind === 'rectangle') ctx.rect(b.x, b.y, b.width, b.height);
      else ctx.ellipse(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, b.height / 2, 0, 0, 2 * Math.PI);
      // F-003.R3 / RULE-04: outlined, filled solid, or filled at 30 % opacity in its colour.
      if (a.style.fill !== 'none') {
        ctx.globalAlpha = a.style.fill === 'translucent' ? TRANSLUCENT_FILL_OPACITY : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.stroke();
      return;
    }
    case 'line':
      ctx.lineCap = 'round';
      ctx.moveTo(a.tail.x, a.tail.y);
      ctx.lineTo(a.head.x, a.head.y);
      ctx.stroke();
      return;
    case 'arrow': {
      // F-003.R2: the shaft ends at the head's base; the head is a filled triangle with its tip at the head.
      const [tip, left, right] = arrowHead(a.tail, a.head, stroke);
      ctx.lineCap = 'round';
      if (Math.hypot(a.head.x - a.tail.x, a.head.y - a.tail.y) > ARROW_HEAD_LENGTH * stroke) {
        ctx.moveTo(a.tail.x, a.tail.y);
        ctx.lineTo((left.x + right.x) / 2, (left.y + right.y) / 2);
        ctx.stroke();
        ctx.beginPath();
      }
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case 'stroke':
    case 'highlight':
      drawPath(ctx, a, markWidth(a, shortSide));
      return;
    default:
      // Text, steps and redactions are drawn by F-005…F-007.
      return;
  }
}

/**
 * F-004.R1/R2 (ADR-0004 §4): a pen stroke as midpoint quadratics with round ends and joins; a highlight
 * as the same path, 3 × wider with square ends, stroked once at 40 % opacity so the parts where it
 * crosses itself are no darker than the rest (RULE-09, platform-mapping). A single point is a dot: a
 * circle of the stroke size for the pen, a square of the highlight's width for a highlight (RULE-05).
 */
function drawPath(ctx: Ctx, a: PathAnnotation, width: number): void {
  const highlight = a.kind === 'highlight';
  const pieces = strokePieces(a.points);
  const [first] = pieces;
  if (!first) return;
  if (highlight) ctx.globalAlpha = HIGHLIGHT_OPACITY;
  ctx.lineWidth = width;
  if (a.points.length === 1) {
    const { x, y } = first.from;
    if (highlight) ctx.rect(x - width / 2, y - width / 2, width, width);
    else ctx.arc(x, y, width / 2, 0, 2 * Math.PI);
    ctx.fill();
  } else {
    ctx.lineCap = highlight ? 'square' : 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(first.from.x, first.from.y);
    for (const q of pieces) ctx.quadraticCurveTo(q.control.x, q.control.y, q.to.x, q.to.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Screen-only selection overlay (CMP-Canvas "selected"): handles on a single selection — a box's
 * outline with eight handles, or a line's two end handles — and an outline on each of several, clipped
 * to the canvas. Drawn in context pixels, so handles keep their size at every zoom.
 */
function paintSelection(ctx: Ctx, scene: Scene, transform: Transform, ids: readonly string[], look: OverlayLook): void {
  const { scale, dx, dy } = transform;
  const X = (x: number) => dx + x * scale;
  const Y = (y: number) => dy + y * scale;
  const wanted = new Set(ids);
  const selected = scene.annotations.filter((a) => wanted.has(a.id));
  const single = selected.length === 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  // CMP-Canvas "cropping": outside the crop tool, annotations and handles are clipped to the canvas.
  const c = screenRect(canvasRect(scene.frame, scene.padding.size), transform);
  ctx.beginPath();
  ctx.rect(c.x, c.y, c.width, c.height);
  ctx.clip();
  for (const a of selected) {
    if (!single || !isLineAnnotation(a)) {
      const b = shapeBox(a);
      const x = X(b.x);
      const y = Y(b.y);
      ctx.lineWidth = look.lineWidth + 2;
      ctx.strokeStyle = look.halo;
      ctx.strokeRect(x, y, b.width * scale, b.height * scale);
      ctx.lineWidth = look.lineWidth;
      ctx.strokeStyle = look.outline;
      ctx.strokeRect(x, y, b.width * scale, b.height * scale);
    }
    if (!single) continue;
    const s = Math.round(look.handleSize);
    const w = Math.round(look.lineWidth);
    for (const [, p] of handlesOf(a)) {
      const x = Math.round(X(p.x) - s / 2);
      const y = Math.round(Y(p.y) - s / 2);
      ctx.fillStyle = look.handleBorder;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = look.handleFill;
      ctx.fillRect(x + w, y + w, s - 2 * w, s - 2 * w);
    }
  }
  ctx.restore();
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
  paintScene(ctx, scene, image, transform, !!view.crisp);
  ctx.restore();
}

/**
 * ADR-0004 scene steps 1–2, shared by the image layer and the export: the background over the canvas,
 * then the image clipped to the frame (image pixels outside the frame never show, RULE-14, D-020).
 * The frame clip stays on the context; callers wrap this in save/restore.
 */
function paintScene(ctx: Ctx, scene: Scene, image: CanvasImageSource, transform: Transform, crisp: boolean): void {
  const { scale, dx, dy } = transform;
  const canvas = canvasRect(scene.frame, scene.padding.size);
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
  ctx.imageSmoothingEnabled = !crisp;
  ctx.imageSmoothingQuality = 'high';
  // Only the part of the frame on screen is drawn (one source pixel of margin keeps the smoothing at its
  // edges); zoomed in, this is a small part of the image (NFR-02).
  const src = visibleSource(frame, transform, ctx.canvas);
  if (src) ctx.drawImage(image, src.x, src.y, src.width, src.height, src.x, src.y, src.width, src.height);
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
