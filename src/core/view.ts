// MOD-Core — the view maths (RULE-12, F-002): zoom steps, the zoom-out floor, fit, zoom at a point and
// the pan limits. Pure; positions are CSS pixels of the work area, contents are image pixels.
// Implements: RULE-12, F-002.R1/R2/R3/R4; INV-05 (a view never touches the document).
import { fitZoom } from './canvas';
import { ZOOM_MAX, ZOOM_MIN_STEP, ZOOM_STEPS } from './constants';
import type { Box, Point } from './types';

/**
 * The view: `zoom` in percent; `x`, `y` the screen position (CSS px in the work area) of image pixel
 * (0, 0); `fitted` while the view is the Fit view (a resize or a content change refits it).
 */
export interface View {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
  readonly fitted: boolean;
}

/** What the view shows (the canvas, RULE-12), the area it is shown in, and Fit's margin (style.md). */
export interface Viewport {
  readonly content: Box;
  readonly area: { readonly width: number; readonly height: number };
  readonly margin: number;
}

/** Levels this close to a step count as the step (pinch and fit produce arbitrary levels). */
const EPS = 1e-6;

/** RULE-12: the next step above `zoom`, at most 800 %. */
export function zoomIn(zoom: number): number {
  return ZOOM_STEPS.find((s) => s > zoom * (1 + EPS)) ?? ZOOM_MAX;
}

/** RULE-12: zooming out stops at 10 % or the fit level, whichever is lower (10 % until a fit is known). */
export function zoomFloor(fit: number): number {
  return fit > 0 ? Math.min(ZOOM_MIN_STEP, fit) : ZOOM_MIN_STEP;
}

/** RULE-12: the next step below `zoom`; below 10 % only the fit level, and never below the floor. */
export function zoomOut(zoom: number, fit: number): number {
  const floor = zoomFloor(fit);
  const below = ZOOM_STEPS.filter((s) => s < zoom * (1 - EPS)).pop();
  if (below !== undefined) return below;
  return floor < zoom * (1 - EPS) ? floor : zoom;
}

/** A zoom clamped to RULE-12's range. */
export function clampZoom(zoom: number, fit: number): number {
  return Math.min(ZOOM_MAX, Math.max(zoomFloor(fit), zoom));
}

/** RULE-12 Fit level (percent) of this viewport: the whole content inside the margin, at most 100 %. */
export function fitLevel({ content, area, margin }: Viewport): number {
  return fitZoom(content, { width: area.width - 2 * margin, height: area.height - 2 * margin });
}

/** Image point → screen point. */
export function toScreen(view: View, p: Point): Point {
  const z = view.zoom / 100;
  return { x: view.x + p.x * z, y: view.y + p.y * z };
}

/** Screen point → image point. */
export function toImage(view: View, p: Point): Point {
  const z = view.zoom / 100;
  return { x: (p.x - view.x) / z, y: (p.y - view.y) / z };
}

/**
 * F-002.R4 pan limits, per axis: a canvas no larger than the visible area is centred (no pan on that
 * axis); a larger one pans until its edge reaches the Fit margin, never further.
 */
export function clampView(view: View, { content, area, margin }: Viewport): View {
  const z = view.zoom / 100;
  const axis = (pos: number, start: number, size: number, extent: number) => {
    const s = size * z;
    if (s <= extent) return (extent - s) / 2 - start * z;
    // Larger than the area: from its far edge at the margin to its near edge at the margin.
    const lo = extent - margin - s - start * z;
    const hi = margin - start * z;
    return Math.min(hi, Math.max(lo, pos));
  };
  const x = axis(view.x, content.x, content.width, area.width);
  const y = axis(view.y, content.y, content.height, area.height);
  return x === view.x && y === view.y ? view : { ...view, x, y };
}

/** RULE-12 Fit: the whole content centred in the area. */
export function fitView(port: Viewport): View {
  return clampView({ zoom: fitLevel(port), x: 0, y: 0, fitted: true }, port);
}

/** F-002.R3: a new zoom keeping the image point under `at` in place (then the pan limits apply). */
export function zoomAt(view: View, zoom: number, at: Point, port: Viewport): View {
  const p = toImage(view, at);
  const z = zoom / 100;
  return clampView({ zoom, x: at.x - p.x * z, y: at.y - p.y * z, fitted: false }, port);
}

/** F-002.R4: moves the content by (dx, dy) screen pixels within the pan limits. */
export function panBy(view: View, dx: number, dy: number, port: Viewport): View {
  const next = clampView({ ...view, x: view.x + dx, y: view.y + dy }, port);
  return next.x === view.x && next.y === view.y ? view : { ...next, fitted: false };
}
