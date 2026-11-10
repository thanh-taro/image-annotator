// MOD-Render — one paint function for the screen and the export
// (specs/40-technical/modules/MOD-Render.md, ADR-0004, ADR-0016, ADR-0022). Imports MOD-Core only and
// never reads language, theme or view state beyond the transform it is given (INV-05).
// The palette constants are generated from the tokens (scripts/gen-tokens.mjs). `paintBase` is built
// (F-001); `paint` draws rectangles, ellipses, lines and arrows and the selection overlay (F-003), pen
// strokes and highlights (F-004), step badges (F-006), text (F-005) and redactions (F-007: solid boxes, and
// blur/pixelate patches composited per ADR-0006); the crop view and its frame overlay (F-010). Promoted
// from the SP-engine spike (ADR-0004, ADR-0016, ADR-0022) and, for text, the SP-text spike (ADR-0009,
// ADR-0020). F-020 (M-1c): rectangle and ellipse fills in their fill colour, and text backgrounds (RULE-22).
import {
  ARROW_HEAD_LENGTH,
  arrowHead,
  boundsOf,
  canvasRect,
  contrastPairing,
  fillColourOf,
  handleBox,
  handlesOf,
  HIGHLIGHT_OPACITY,
  markWidth,
  strokePieces,
  isLineAnnotation,
  isEffectRedaction,
  isSolidRedaction,
  isStepAnnotation,
  intersectBoxes,
  isHexColour,
  redactionBox,
  isTextAnnotation,
  shapeBox,
  stepBadge,
  strokePixels,
  textBackground,
  textLines,
  textMetrics,
  textOutlineWidth,
  TRANSLUCENT_FILL_OPACITY,
  type Annotation,
  type Box,
  type Frame,
  type Padding,
  type PathAnnotation,
  type RedactionAnnotation,
  type StepAnnotation,
  type StyleColour,
  type TextAnnotation,
  type TextMeasure,
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

/**
 * A blur or pixelate patch from MOD-Effects (structurally its `Patch`): `bitmap` covers `box` (the output
 * area O = B ∩ F, image pixels). An approximation is smaller: `source` is the part of it covering `box`.
 * `smooth` is false for pixelate, whose blocks keep hard edges when scaled.
 */
export interface PatchImage {
  readonly box: Box;
  readonly bitmap: CanvasImageSource;
  readonly smooth?: boolean;
  readonly source?: { readonly width: number; readonly height: number };
  /** Where `source` is drawn (image pixels), clipped to `box`; default `box` (MOD-Effects Patch). */
  readonly at?: Box;
}

/** Blur/pixelate patches by annotation id (MOD-Effects, ADR-0006). */
export type Patches = ReadonlyMap<string, PatchImage>;

/**
 * Screen-only: what a transparent background looks like where a blur or pixelate patch replaces the
 * pixels under it (the checkerboard of the image layer, ADR-0016). The export passes none and clears.
 */
export type Backdrop = Pick<BaseView, 'checkerA' | 'checkerB' | 'checkerSize'>;

/** Options of a partial annotation pass (ADR-0022 split drag layers; screen-only backdrop). */
export interface AnnotationPassOptions {
  readonly backdrop?: Backdrop;
  /**
   * The solid redactions re-stamped over every patch (ADR-0006 step 3); by default the scene's own.
   * A drag frame draws only the dragged annotations, so it passes the whole document's solids.
   */
  readonly solids?: readonly Annotation[];
  /** Screen only: the empty text being edited and its placeholder, which its background surrounds (RULE-22). */
  readonly placeholder?: Placeholder;
}

/**
 * RULE-22 / F-020.R8 (screen only): the text being edited while it is empty, by id, and the placeholder it
 * shows (COPY-text.placeholder); its background box surrounds the placeholder at the text's size.
 */
export interface Placeholder {
  readonly id: string;
  readonly text: string;
}

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
  /** F-010.R2: the dim over the image outside the crop frame (style.md "Work area": cropDim). */
  readonly cropDim?: string;
}

/** Screen-only overlays (selection, handles, crop frame, checkerboard); never passed by the export. */
export interface Overlays {
  readonly selection?: readonly string[];
  readonly look?: OverlayLook;
  /** The checkerboard shown where a patch replaces pixels with a transparent background (screen only). */
  readonly backdrop?: Backdrop;
  /** F-008.R1: the selection box being dragged with the select tool (image pixels, any direction). */
  readonly marquee?: Box | null;
  /**
   * F-010.R2 (CMP-Canvas "cropping"): the frame shown while cropping — the image outside it dimmed, its
   * outline and eight handles on top. The scene is then the crop view (`cropView`).
   */
  readonly crop?: Frame | null;
  /** RULE-22 / F-020.R8: the empty text being edited, whose background surrounds its placeholder. */
  readonly placeholder?: Placeholder;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * ADR-0020: a TextMeasure on a Canvas 2D context — the advance width of a line in a font, which is
 * what the text box (RULE-08) is built from. The context's font is changed; callers save and restore.
 */
export function measureWith(ctx: Ctx): TextMeasure {
  return (font, line) => {
    ctx.font = font;
    return ctx.measureText(line).width;
  };
}

/**
 * The one scene painter for the screen and the export (ADR-0004 §1, NFR-08). With `layer` (the display
 * image layer, ADR-0016) it copies that layer instead of scene steps 1–2; the export never passes one
 * and gets the background and the image clipped to the frame from the image itself. Then the
 * annotations in painter's order, clipped to the canvas (RULE-14), then the screen-only overlays.
 * `crisp` draws the image without smoothing: the export passes it (F-012 security m4: at scale 1 on whole
 * pixels nothing changes, and no filter can ever read past the frame's source rectangle, RULE-14).
 * Implements: F-003.R1/R2/R3, F-004.R1/R2, F-005.R2/R5, F-006.R3/R4, F-007.R2/R3/R5, INV-02, RULE-07, RULE-08,
 * RULE-09, RULE-10, NFR-08.
 */
export function paint(
  ctx: Ctx,
  scene: Scene,
  image: SceneImage,
  transform: Transform,
  patches: Patches,
  overlays?: Overlays,
  layer?: CanvasImageSource,
  crisp = false,
): void {
  ctx.save();
  if (layer) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(layer, 0, 0);
  } else paintScene(ctx, scene, image, transform, crisp);
  ctx.restore();
  paintAnnotations(ctx, scene, image, transform, patches, 0, scene.annotations.length, {
    ...(overlays?.backdrop ? { backdrop: overlays.backdrop } : {}),
    ...(overlays?.placeholder ? { placeholder: overlays.placeholder } : {}),
  });
  if (overlays) paintOverlays(ctx, scene, image, transform, overlays);
}

/**
 * The screen-only overlays alone (CMP-Canvas "selected"): the selection outline and handles, then the
 * marquee. `paint` calls it; a drag frame (ADR-0022, MOD-Canvas) calls it after compositing its layers,
 * with the dragged annotations as they are now in `scene`.
 */
export function paintOverlays(
  ctx: Ctx,
  scene: Scene,
  image: SceneImage,
  transform: Transform,
  overlays: Overlays,
): void {
  const look = overlays.look;
  if (!look) return;
  if (overlays.crop) paintCrop(ctx, overlays.crop, image, transform, look);
  if (overlays.selection?.length)
    paintSelection(ctx, scene, transform, overlays.selection, look, Math.min(image.width, image.height));
  if (overlays.marquee) paintMarquee(ctx, overlays.marquee, transform, look);
}

/**
 * F-010.R2 / RULE-12: the scene as the crop view shows it — the whole image as the content, no padding
 * drawn (the background stays under transparent pixels), annotations over the whole image. Only the
 * screen uses it; the export always paints the document's own frame and padding (RULE-15).
 */
export function cropView(scene: Scene, image: { readonly width: number; readonly height: number }): Scene {
  return {
    annotations: scene.annotations,
    frame: { x: 0, y: 0, width: image.width, height: image.height },
    padding: { size: 'none', background: scene.padding.background },
  };
}

/**
 * CMP-Canvas "cropping" (F-010.R2): the image outside `frame` dimmed with cropDim — over the annotations
 * there too, which stay visible — then the frame's outline (selection outline with its halo) and its
 * eight handles, in context pixels so they keep their size at every zoom.
 */
function paintCrop(
  ctx: Ctx,
  frame: Frame,
  image: { readonly width: number; readonly height: number },
  transform: Transform,
  look: OverlayLook,
): void {
  const img = screenRect({ x: 0, y: 0, width: image.width, height: image.height }, transform);
  const { scale, dx, dy } = transform;
  const x0 = Math.round(dx + frame.x * scale);
  const y0 = Math.round(dy + frame.y * scale);
  const x1 = Math.round(dx + (frame.x + frame.width) * scale);
  const y1 = Math.round(dy + (frame.y + frame.height) * scale);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  if (look.cropDim) {
    ctx.fillStyle = look.cropDim;
    const right = img.x + img.width;
    const bottom = img.y + img.height;
    ctx.fillRect(img.x, img.y, img.width, y0 - img.y); // above
    ctx.fillRect(img.x, y1, img.width, bottom - y1); // below
    ctx.fillRect(img.x, y0, x0 - img.x, y1 - y0); // left
    ctx.fillRect(x1, y0, right - x1, y1 - y0); // right
  }
  ctx.lineWidth = look.lineWidth + 2;
  ctx.strokeStyle = look.halo;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.lineWidth = look.lineWidth;
  ctx.strokeStyle = look.outline;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  const s = Math.round(look.handleSize);
  const w = Math.round(look.lineWidth);
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  for (const [hx, hy] of [
    [x0, y0],
    [mx, y0],
    [x1, y0],
    [x1, my],
    [x1, y1],
    [mx, y1],
    [x0, y1],
    [x0, my],
  ] as const) {
    const x = Math.round(hx - s / 2);
    const y = Math.round(hy - s / 2);
    ctx.fillStyle = look.handleBorder;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = look.handleFill;
    ctx.fillRect(x + w, y + w, s - 2 * w, s - 2 * w);
  }
  ctx.restore();
}

/** F-008.R1: the selection box, in the selection outline's colour with its halo, in context pixels. */
function paintMarquee(ctx: Ctx, box: Box, { scale, dx, dy }: Transform, look: OverlayLook): void {
  const x = dx + Math.min(box.x, box.x + box.width) * scale;
  const y = dy + Math.min(box.y, box.y + box.height) * scale;
  const w = Math.abs(box.width) * scale;
  const h = Math.abs(box.height) * scale;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.lineWidth = look.lineWidth + 2;
  ctx.strokeStyle = look.halo;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = look.lineWidth;
  ctx.strokeStyle = look.outline;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
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
  patches: Patches,
  from = 0,
  to = scene.annotations.length,
  options: AnnotationPassOptions = {},
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
  let solids: readonly RedactionAnnotation[] | null = null;
  for (let i = from; i < to; i++) {
    const a = scene.annotations[i];
    if (!a) continue;
    if (isEffectRedaction(a)) {
      solids ??= (options.solids ?? scene.annotations).filter(isSolidRedaction);
      drawEffect(ctx, a, scene, patches.get(a.id), solids, transform, options.backdrop);
    } else drawAnnotation(ctx, a, shortSide, options.placeholder);
  }
  ctx.restore();
}

/**
 * F-007.R2, INV-02, RULE-10: a solid redaction is a fully opaque box in its colour over every pixel its
 * box touches (extended outward to whole pixels), with no opacity of any kind; at 1:1 (the export) its
 * edges fall on whole pixels, so it has no antialiased edge.
 */
function drawSolid(ctx: Ctx, a: RedactionAnnotation): void {
  const b = redactionBox(a.box);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = colourValue(a.style.color);
  ctx.fillRect(b.x, b.y, b.width, b.height);
}

/**
 * ADR-0006 "Patch and composite", for a blur or pixelate redaction over its box B (already clipped to
 * the canvas): (1) B is replaced — not blended — by the background (transparent, or the palette colour,
 * RULE-14), hiding earlier annotations there (F-007.AC9) and giving the background in the padding
 * (F-007.AC13); (2) the effect pixels of O = B ∩ F are drawn over it; (3) every solid redaction's pixels
 * inside B are re-stamped in its colour, so a solid shows whatever the order (F-007.AC10, INV-02).
 * Without a patch yet (the pixels are still on their way to the worker), B shows the background: the
 * image under a blur is never shown unobscured.
 */
function drawEffect(
  ctx: Ctx,
  a: RedactionAnnotation,
  scene: Scene,
  patch: PatchImage | undefined,
  solids: readonly RedactionAnnotation[],
  transform: Transform,
  backdrop: Backdrop | undefined,
): void {
  const b = redactionBox(a.box);
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.width, b.height);
  ctx.clip();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const background = scene.padding.background;
  if (background !== 'transparent') {
    ctx.fillStyle = colourValue(background);
    ctx.fillRect(b.x, b.y, b.width, b.height);
  } else {
    ctx.clearRect(b.x, b.y, b.width, b.height);
    if (backdrop) paintBackdrop(ctx, scene, b, transform, backdrop);
  }
  if (patch) {
    const o = patch.box;
    ctx.imageSmoothingEnabled = patch.smooth ?? true;
    ctx.imageSmoothingQuality = 'medium';
    const sw = patch.source?.width ?? o.width;
    const sh = patch.source?.height ?? o.height;
    const at = patch.at ?? o;
    ctx.save();
    if (patch.at) {
      // RULE-10 pixelate preview: whole p × p blocks from B's corner, drawn only inside O.
      ctx.beginPath();
      ctx.rect(o.x, o.y, o.width, o.height);
      ctx.clip();
    }
    ctx.drawImage(patch.bitmap, 0, 0, sw, sh, at.x, at.y, at.width, at.height);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
  }
  for (const s of solids) {
    const r = intersectBoxes(redactionBox(s.box), b);
    if (!r) continue;
    ctx.fillStyle = colourValue(s.style.color);
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }
  ctx.restore();
}

/** Screen only: the image layer's checkerboard inside `box`, anchored to the canvas corner (ADR-0016). */
function paintBackdrop(ctx: Ctx, scene: Scene, box: Box, transform: Transform, backdrop: Backdrop): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const canvas = screenRect(canvasRect(scene.frame, scene.padding.size), transform);
  paintChecker(ctx, canvas, backdrop, screenRect(box, transform));
  ctx.restore();
}

/** One annotation in image pixels (the context already carries the transform). */
function drawAnnotation(ctx: Ctx, a: Annotation, shortSide: number, placeholder?: Placeholder): void {
  const stroke = strokePixels(a.style, shortSide);
  const colour = colourValue(a.style.color);
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
      // F-003.R3 / RULE-04: outlined, filled solid, or filled at 30 % opacity — from M-1c in its fill colour
      // as stored, never the outline colour (D-054), under the outline (Implements: F-020.R1/R2, RULE-22). A
      // filled shape always has a fill colour (RULE-22); unset only occurs with fill none.
      const fillColour = fillColourOf(a.kind, a.style);
      if (a.style.fill !== 'none' && fillColour) {
        ctx.fillStyle = colourValue(fillColour);
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
    case 'step':
      drawStep(ctx, a, shortSide);
      return;
    case 'text':
      drawText(ctx, a, shortSide, placeholder?.id === a.id ? placeholder.text : undefined);
      return;
    case 'redaction':
      // Blur and pixelate go through drawEffect (they need the patches and the solids).
      if (isSolidRedaction(a)) drawSolid(ctx, a);
      return;
  }
}

/**
 * F-006.R3/R4, RULE-07, ADR-0009: a filled circle in the step's colour (from three digits a pill of the
 * same height), with its number as plain digits in the contrast pairing, in the tool's face at the
 * step's text size, centred. Sizes are image pixels, so the display at any zoom and the export draw the
 * same glyph (NFR-08); the digits are centred from the font's own metrics, not `textBaseline: middle`.
 */
function drawStep(ctx: Ctx, a: StepAnnotation, shortSide: number): void {
  const b = stepBadge(a, shortSide);
  const r = b.height / 2;
  ctx.fillStyle = colourValue(a.style.color);
  if (b.width > b.height) ctx.roundRect(b.centre.x - b.width / 2, b.centre.y - r, b.width, b.height, r);
  else ctx.arc(b.centre.x, b.centre.y, r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = b.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colourValue(contrastPairing(a.style.color)); // RULE-07 (MOD-Core)
  ctx.fillText(b.label, b.centre.x, b.baseline);
}

/**
 * F-005.R2/R5, RULE-08, ADR-0009 §1, ADR-0020: each line in the tool's face at the text size, its
 * alphabetic baseline at the line top plus the font's own metric offset (not engine `textBaseline`
 * values), so the display at any zoom, the editing field above it and the export agree (NFR-08). The
 * outline is `strokeText` in the contrast pairing (RULE-07) with lineWidth 2 × max(1, 0.08 × size) and
 * round joins — half of it lies under the glyph — then `fillText` in the style colour on top. Lines
 * break only at typed new lines; nothing wraps.
 * From M-1c (RULE-22, F-020.R4/R8): a text with a background is drawn on a box with rounded corners — the
 * text box grown by 0.25 × the text size on every side, radius 0.2 × the text size — opaque when solid and
 * at 70 % when translucent, in its text background colour (automatic: the contrast pairing of its colour),
 * directly under its letters and without the outline. `placeholder` is the screen-only placeholder an empty
 * text being edited shows, which the box then surrounds.
 */
function drawText(ctx: Ctx, a: TextAnnotation, shortSide: number, placeholder?: string): void {
  const m = textMetrics(a.style, shortSide);
  ctx.font = m.font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const background = textBackground(a, shortSide, measureWith(ctx), placeholder);
  if (background) {
    const { box: b, radius, opacity } = background;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = colourValue(fillColourOf('text', a.style));
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, radius);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = m.font; // measuring the box set the same font; kept explicit for the letters
  } else {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = 2 * textOutlineWidth(m.size);
    ctx.strokeStyle = colourValue(contrastPairing(a.style.color)); // RULE-07 (MOD-Core)
  }
  ctx.fillStyle = colourValue(a.style.color);
  textLines(a.text).forEach((line, i) => {
    if (!line) return;
    const y = a.anchor.y + i * m.lineHeight + m.baseline;
    if (!background) ctx.strokeText(line, a.anchor.x, y);
    ctx.fillText(line, a.anchor.x, y);
  });
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
function paintSelection(
  ctx: Ctx,
  scene: Scene,
  transform: Transform,
  ids: readonly string[],
  look: OverlayLook,
  shortSide: number,
): void {
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
    // F-008.R3 (D-044): a stroke's or highlight's outline and handles sit on its drawn mark's box (its
    // points' box grown by half its width), so a straight (Shift) highlight's outline is the band's edge;
    // MOD-Core `handlesOf` gives it only the handles along its length, at its ends, so none stack.
    if (!single || !isLineAnnotation(a)) {
      // F-006: a step's outline is its badge (no stroke), which needs the image's shorter side; F-005:
      // a text's is its box (RULE-08, ADR-0020), measured in the tool's face.
      const b =
        isStepAnnotation(a) || isTextAnnotation(a) ? boundsOf(a, shortSide, measureWith(ctx)) : handleBox(a, shortSide);
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
    for (const [, p] of handlesOf(a, shortSide)) {
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
    ctx.fillStyle = colourValue(background);
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
function paintChecker(ctx: Ctx, r: Box, view: Backdrop, limit?: Box): void {
  const size = Math.max(1, Math.round(view.checkerSize));
  const x0 = Math.max(r.x, 0, limit?.x ?? 0);
  const y0 = Math.max(r.y, 0, limit?.y ?? 0);
  const x1 = Math.min(r.x + r.width, ctx.canvas.width, limit ? limit.x + limit.width : Infinity);
  const y1 = Math.min(r.y + r.height, ctx.canvas.height, limit ? limit.y + limit.height : Infinity);
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

/** The sRGB value of a palette colour (tokens.json, ADR-0013), or a custom colour's own (RULE-21, F-019). */
export function colourValue(name: StyleColour): string {
  return isHexColour(name) ? name : PALETTE_HEX[name];
}
