// MOD-Canvas — the view controller (F-002): a plain, DOM-free state machine over MOD-Core's view maths.
// <Canvas> feeds it the work area's size, the content and the input (wheel, pinch, keys, commands);
// it reports each new view once, so a repaint is scheduled only when the view really changed (NFR-02).
// It never sees the document, so no view change can edit it or add an undo step (INV-05, F-002.AC7).
// Implements: F-002.R1/R2/R3/R4, RULE-12, F-002 edge case "the host resizes the tool"; RULE-19 (keep the
// selection in view, F-013).
import {
  clampView,
  clampZoom,
  fitLevel,
  fitView,
  panBy,
  toImage,
  zoomAt as zoomViewAt,
  zoomIn,
  zoomOut,
  ZOOM_MAX,
  type Box,
  type Point,
  type View,
  type Viewport,
} from '../core';

/** One wheel event, as the canvas reads it (`mod`: Ctrl or Cmd held, or a trackpad pinch). */
export interface WheelInput {
  readonly deltaX: number;
  readonly deltaY: number;
  /** WheelEvent.deltaMode: 0 pixels, 1 lines, 2 pages. */
  readonly deltaMode: number;
  readonly mod: boolean;
}

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

  /** RULE-19 Enter: the image point at the centre of the visible area (above any bottom inset), or null. */
  centreImage(): Point | null {
    return this.current ? toImage(this.current, this.centre()) : null;
  }

  /** F-002.R3 zoom at a point: `zoom` (percent, kept within RULE-12's range) keeping the image point under `at`. */
  zoomAt(zoom: number, at: Point): void {
    const port = this.port;
    const view = this.current;
    if (!port || !view) return;
    const next = clampZoom(zoom, fitLevel(port));
    if (next !== view.zoom) this.set(zoomViewAt(view, next, at, port));
  }

  /** F-002.R2: one RULE-12 step in, about `at` (the centre of the view by default). */
  zoomIn(at: Point = this.centre()): void {
    if (this.current) this.zoomAt(zoomIn(this.current.zoom), at);
  }

  /** F-002.R2: one RULE-12 step out, never below RULE-12's floor. */
  zoomOut(at: Point = this.centre()): void {
    const port = this.port;
    if (this.current && port) this.zoomAt(zoomOut(this.current.zoom, fitLevel(port)), at);
  }

  /** F-002.R2 COPY-action.zoom_fit: the whole canvas, never above 100 % (RULE-12). */
  fit(): void {
    const port = this.port;
    if (port) this.set(fitView(port));
  }

  /** F-002.R2 COPY-action.zoom_actual: 100 %, about the centre of the view. */
  actualSize(): void {
    this.zoomAt(100, this.centre());
  }

  /** F-002.R4: pans by screen pixels (scrolling, Space+drag, two fingers). */
  panBy(dx: number, dy: number): void {
    const port = this.port;
    if (port && this.current) this.set(panBy(this.current, dx, dy, port));
  }

  /** F-002.R4 arrow keys (RULE-19): moves the view by (dx, dy) — positive dx shows more of the right side. */
  panView(dx: number, dy: number): void {
    this.panBy(-dx, -dy);
  }

  /**
   * RULE-19 "the view scrolls to keep a newly placed or selected annotation visible": pans as little as
   * possible so `box` (image pixels) is inside the visible area, at Fit's margin from its edges; a box
   * larger than the area shows its top-left corner. The zoom is kept; the pan limits apply (F-002.R4).
   */
  reveal(box: Box): void {
    const view = this.current;
    if (!view || !this.port) return;
    const z = view.zoom / 100;
    const m = this.margin;
    const axis = (pos: number, start: number, size: number, extent: number) => {
      const a = pos + start * z;
      const b = a + size * z;
      if (a >= m && b <= extent - m) return 0;
      if (a < m || b - a > extent - 2 * m) return m - a;
      return extent - m - b;
    };
    const dx = axis(view.x, box.x, box.width, this.area.width);
    const dy = axis(view.y, box.y, box.height, this.area.height);
    if (dx || dy) this.panBy(dx, dy);
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
    this.zoomAt(clampZoom(view.zoom * Math.exp(-dy * PINCH_RATE), fitLevel(port)), at);
  }

  /**
   * F-002.R3/R4 two fingers on a touch screen: call with `start` when the second finger lands, then on
   * every move. The zoom follows the fingers' distance; the image point between them follows their centre.
   */
  pinch(a: Point, b: Point, start: boolean): void {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.scaleAt(Math.hypot(a.x - b.x, a.y - b.y) || 1, mid, start);
  }

  /**
   * F-002.R3 Safari's trackpad pinch (`gesturestart` / `gesturechange`, whose `scale` starts at 1): the
   * zoom follows the gesture's scale; the image point under the pointer stays there.
   */
  gesture(scale: number, at: Point, start: boolean): void {
    this.scaleAt(scale > 0 ? scale : 1, at, start);
  }

  /** A pinch measured by `distance` (any unit) about `mid`; `start` records the reference. */
  private scaleAt(distance: number, mid: Point, start: boolean): void {
    const view = this.current;
    const port = this.port;
    if (!view || !port) return;
    if (start || !this.pinchStart) {
      this.pinchStart = { zoom: view.zoom, distance, point: toImage(view, mid) };
      return;
    }
    const { zoom, distance: d0, point } = this.pinchStart;
    const next = Math.min(ZOOM_MAX, clampZoom((zoom * distance) / d0, fitLevel(port)));
    const z = next / 100;
    this.set(clampView({ zoom: next, x: mid.x - point.x * z, y: mid.y - point.y * z, fitted: false }, port));
  }

  /** The pinch or gesture ended (a finger lifted, `gestureend`). */
  endPinch(): void {
    this.pinchStart = null;
  }
}
