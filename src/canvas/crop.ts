// MOD-Canvas — the crop tool's part of the tool state machine (F-010), DOM-free: a `ToolInput` that turns
// one pointer gesture of the crop tool into a frame change. A press on an edge or corner resizes the frame,
// inside it moves it, outside it draws a new one (MOD-Core `frameGripAt`, `dragFrame`). Transient drag
// state stays here (MOD-Canvas); `preview` holds the frame as it is now, which <Canvas> paints over the
// cached drag layer (ADR-0022, prepared at the press, NFR-02); only the released frame leaves, and MOD-App
// records it as one undo step (RULE-11).
// Implements: F-010.R1 (edges, corners, move, a new frame; RULE-13 limits), F-010.R5 (one step per change),
// RULE-05 (a press that moves under 4 screen pixels changes nothing), RULE-19 (Esc cancels the current drag).
import {
  CLICK_THRESHOLD_PX,
  dragFrame,
  frameGripAt,
  sameFrame,
  type Frame,
  type FrameGrip,
  type ImageSize,
  type Point,
  type ToolName,
} from '../core';
import type { PointerInput, ToolInput } from './input';

/** What the crop tool reads when a gesture starts. */
export interface CropSetup {
  readonly tool: ToolName;
  readonly frame: Frame;
  readonly image: ImageSize;
  /** Half an edge's grip zone in image pixels (size.targetMin / 2 / zoom). */
  readonly gripHalf: number;
  /** Screen (CSS px in the work area) → image pixels, through the view as it is when called. */
  toImage(p: Point): Point;
}

export interface CropCallbacks {
  /** A finished frame change (one undo step, RULE-11). */
  commit(frame: Frame): void;
  /** The preview changed: repaint on the next frame. */
  preview(): void;
  /** ADR-0022 / NFR-02: a press that may become a drag; build the drag layer now. */
  prepare(): void;
}

interface Gesture {
  readonly id: number;
  readonly grip: FrameGrip;
  readonly start: Point; // screen
  readonly from: Point; // image
  readonly frame: Frame;
  readonly image: ImageSize;
  readonly toImage: (p: Point) => Point;
  last: Point;
  dragging: boolean;
  cancelled: boolean;
}

export class CropTool implements ToolInput {
  private gesture: Gesture | null = null;
  /** The frame being dragged, as it is now, or null. */
  preview: Frame | null = null;

  constructor(
    private readonly setup: () => CropSetup | null,
    private readonly callbacks: CropCallbacks,
  ) {}

  /** True while a gesture is in progress (pointer down, not cancelled). */
  get active(): boolean {
    return !!this.gesture && !this.gesture.cancelled;
  }

  /** CMP-Canvas: what a press at screen point `p` would grab (for the pointer cursor), or null. */
  gripAt(p: Point): FrameGrip | null {
    const s = this.setup();
    if (!s || s.tool !== 'crop') return null;
    return frameGripAt(s.frame, s.toImage(p), s.gripHalf);
  }

  down(input: PointerInput): boolean {
    if (this.active || input.button !== 0) return false;
    const s = this.setup();
    if (!s || s.tool !== 'crop') return false;
    const from = s.toImage(input.point);
    this.gesture = {
      id: input.id,
      grip: frameGripAt(s.frame, from, s.gripHalf),
      start: input.point,
      from,
      frame: s.frame,
      image: s.image,
      toImage: s.toImage,
      last: input.point,
      dragging: false,
      cancelled: false,
    };
    this.callbacks.prepare();
    return true;
  }

  move(input: PointerInput): void {
    const g = this.gesture;
    if (!g || g.cancelled || input.id !== g.id) return;
    g.last = input.point;
    if (!g.dragging) {
      // RULE-05: under the threshold it is a click, which changes nothing.
      if (Math.hypot(input.point.x - g.start.x, input.point.y - g.start.y) < CLICK_THRESHOLD_PX) return;
      g.dragging = true;
    }
    this.update(g);
  }

  /** The view changed mid-drag (scroll, zoom): re-map the pointer so the drag stays under it. */
  viewChanged(): void {
    const g = this.gesture;
    if (g && !g.cancelled && g.dragging) this.update(g);
  }

  private update(g: Gesture): void {
    const to = g.toImage(g.last);
    this.preview = dragFrame(g.frame, g.grip, to.x - g.from.x, to.y - g.from.y, g.image, g.from);
    this.callbacks.preview();
  }

  up(input: PointerInput): void {
    const g = this.gesture;
    if (!g || input.id !== g.id) return;
    if (!g.cancelled) this.move(input);
    this.gesture = null;
    const preview = this.preview;
    this.preview = null;
    if (!g.cancelled && g.dragging && preview && !sameFrame(preview, g.frame)) this.callbacks.commit(preview);
    this.callbacks.preview(); // the prepared drag layer is released
  }

  /** RULE-19 Esc (and a second finger): the current drag ends and the frame is unchanged. */
  cancel(): boolean {
    const g = this.gesture;
    if (!g || g.cancelled) return false;
    g.cancelled = true;
    this.preview = null;
    this.callbacks.preview();
    return true;
  }
}
