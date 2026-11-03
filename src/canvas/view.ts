// MOD-Canvas — the view controller (F-002): a plain, DOM-free state machine over MOD-Core's view maths.
// <Canvas> feeds it the work area's size, the content and the input (wheel, pinch, keys, commands);
// it reports each new view once, so a repaint is scheduled only when the view really changed (NFR-02).
// It never sees the document, so no view change can edit it or add an undo step (INV-05, F-002.AC7).
// Implements: F-002.R1/R2/R3/R4, RULE-12, F-002 edge case "the host resizes the tool".
import {
  clampView,
  clampZoom,
  fitLevel,
  fitView,
  panBy,
  toImage,
  zoomAt,
  zoomIn,
  zoomOut,
  ZOOM_MAX,
  type Box,
  type Point,
  type View,
  type Viewport,
} from '../core';

export type PanDirection = 'left' | 'right' | 'up' | 'down';

/** One wheel event, as the canvas reads it (`mod`: Ctrl or Cmd held, or a trackpad pinch). */
export interface WheelInput {
  readonly deltaX: number;
  readonly deltaY: number;
  /** WheelEvent.deltaMode: 0 pixels, 1 lines, 2 pages. */
  readonly deltaMode: number;
  readonly mod: boolean;
}

/** RULE-19: arrow keys pan 40 screen pixels, 200 with Shift. */
export const PAN_STEP = 40;
export const PAN_STEP_SHIFT = 200;
/** A wheel delta at least this large (pixels) is a mouse-wheel notch, which zooms one RULE-12 step. */
const NOTCH = 50;
/** Smooth zoom for trackpad pinches: the zoom is multiplied by e^(−deltaY × this). */
const PINCH_RATE = 0.01;
/** Lines (deltaMode 1) in pixels. */
const LINE = 16;

const same = (a: View | null, b: View) =>
  !!a && a.zoom === b.zoom && a.x === b.x && a.y === b.y && a.fitted === b.fitted;

export class ViewController {
  private current: View | null = null;
  private content: Box | null = null;
  private area = { width: 0, height: 0 };
  private margin = 0;
  private pinchStart: { zoom: number; distance: number; point: Point } | null = null;

  constructor(private readonly onChange: (view: View) => void = () => {}) {}

  /** The current view, or null until there is content and an area. */
  get view(): View | null {
    return this.current;
  }

  private get port(): Viewport | null {
    if (!this.content || this.area.width <= 0 || this.area.height <= 0) return null;
    return { content: this.content, area: this.area, margin: this.margin };
  }

  private set(next: View): void {
    if (same(this.current, next)) return;
    this.current = next;
    this.onChange(next);
  }

  /** The visible work area (CSS px, minus any bottom inset) and Fit's margin (style.md, space.6). */
  setArea(area: { width: number; height: number }, margin: number): void {
    const old = this.area;
    this.area = { width: area.width, height: area.height };
    this.margin = margin;
    const port = this.port;
    if (!port) return;
    const view = this.current;
    if (!view || view.fitted) {
      this.set(fitView(port)); // edge case: a fitted view is refitted
      return;
    }
    // Edge case: the zoom level is kept; the image point at the centre stays at the centre.
    const centre = toImage(view, { x: old.width / 2, y: old.height / 2 });
    const z = view.zoom / 100;
    this.set(
      clampView({ ...view, x: port.area.width / 2 - centre.x * z, y: port.area.height / 2 - centre.y * z }, port),
    );
  }

  /** The content shown (the canvas, RULE-12). `refit` for a new image (F-002.R1); a fitted view refits. */
  setContent(content: Box, refit: boolean): void {
    this.content = content;
    const port = this.port;
    if (!port) return;
    const view = this.current;
    this.set(refit || !view || view.fitted ? fitView(port) : clampView(view, port));
  }

  private centre(): Point {
    return { x: this.area.width / 2, y: this.area.height / 2 };
  }

  private zoomTo(zoom: number, at: Point): void {
    const port = this.port;
    const view = this.current;
    if (!port || !view || zoom === view.zoom) return;
    this.set(zoomAt(view, zoom, at, port));
  }

  /** F-002.R2: one RULE-12 step in, about `at` (the centre of the view by default). */
  zoomIn(at: Point = this.centre()): void {
    if (this.current) this.zoomTo(zoomIn(this.current.zoom), at);
  }

  /** F-002.R2: one RULE-12 step out, never below RULE-12's floor. */
  zoomOut(at: Point = this.centre()): void {
    const port = this.port;
    if (this.current && port) this.zoomTo(zoomOut(this.current.zoom, fitLevel(port)), at);
  }

  /** F-002.R2 COPY-action.zoom_fit: the whole canvas, never above 100 % (RULE-12). */
  fit(): void {
    const port = this.port;
    if (port) this.set(fitView(port));
  }

  /** F-002.R2 COPY-action.zoom_actual: 100 %, about the centre of the view. */
  actualSize(): void {
    this.zoomTo(100, this.centre());
  }

  /** F-002.R4: pans by screen pixels (scrolling, Space+drag, two fingers). */
  panBy(dx: number, dy: number): void {
    const port = this.port;
    if (port && this.current) this.set(panBy(this.current, dx, dy, port));
  }

  /** F-002.R4 arrow keys with nothing selected (RULE-19): "Right" shows more of the right side. */
  panKey(direction: PanDirection, far = false): void {
    const n = far ? PAN_STEP_SHIFT : PAN_STEP;
    const d = { left: [n, 0], right: [-n, 0], up: [0, n], down: [0, -n] }[direction];
    this.panBy(d[0] ?? 0, d[1] ?? 0);
  }

  /**
   * F-002.R3/R4 the wheel: with Ctrl/Cmd (or a trackpad pinch, which arrives as Ctrl+wheel) it zooms at
   * the pointer — a mouse notch by one RULE-12 step, small pinch deltas smoothly; without, it pans.
   */
  wheel(input: WheelInput, at: Point): void {
    const view = this.current;
    const port = this.port;
    if (!view || !port) return;
    const unit = input.deltaMode === 1 ? LINE : input.deltaMode === 2 ? this.area.height : 1;
    const dx = input.deltaX * unit;
    const dy = input.deltaY * unit;
    if (!input.mod) {
      this.panBy(-dx, -dy);
      return;
    }
    if (dy === 0) return;
    if (input.deltaMode !== 0 || Math.abs(dy) >= NOTCH) {
      if (dy < 0) this.zoomIn(at);
      else this.zoomOut(at);
      return;
    }
    this.zoomTo(clampZoom(view.zoom * Math.exp(-dy * PINCH_RATE), fitLevel(port)), at);
  }

  /**
   * F-002.R3/R4 two fingers on a touch screen: call with `start` when the second finger lands, then on
   * every move. The zoom follows the fingers' distance; the image point between them follows their centre.
   */
  pinch(a: Point, b: Point, start: boolean): void {
    const view = this.current;
    const port = this.port;
    if (!view || !port) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    if (start || !this.pinchStart) {
      this.pinchStart = { zoom: view.zoom, distance, point: toImage(view, mid) };
      return;
    }
    const { zoom, distance: d0, point } = this.pinchStart;
    const next = Math.min(ZOOM_MAX, clampZoom((zoom * distance) / d0, fitLevel(port)));
    const z = next / 100;
    this.set(clampView({ zoom: next, x: mid.x - point.x * z, y: mid.y - point.y * z, fitted: false }, port));
  }

  /** The pinch ended (a finger lifted). */
  endPinch(): void {
    this.pinchStart = null;
  }
}
