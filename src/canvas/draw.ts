// MOD-Canvas — the drawing part of the tool state machine (promoted from the SP-engine spike's
// controller, ADR-0004 §5): a DOM-free `ToolInput` that turns one pointer gesture of a shape tool (F-003)
// or of the pen or highlight tool (F-004) into one new annotation. Transient drag state stays here, in plain mutable data; only the finished shape
// leaves (one undo step, RULE-11). Text, steps and redactions add their tools beside it; selecting,
// moving and resizing are F-008. A pen or highlight gesture keeps every pointer sample (the coalesced
// events of each move included) from the press on, as image pixels; a repeated sample is kept once.
// Implements: F-003.R1/R2/R4/R5, F-004.R1/R2/R3/R4, RULE-05 (a drag under 4 screen pixels is a click; a
// pen or highlight click places a dot), RULE-06 (Shift),
// RULE-19 (Esc cancels the current drag), F-003 edge case "Esc during a drag → nothing is created".
// The pointer is mapped through the view as it is now (setup().toImage on every call), so a scroll or
// zoom mid-drag keeps the shape's end under the pointer; the start stays where it was pressed. For a
// path, a view change adds the image point now under the pointer, so the stroke's end stays under it.
import {
  CLICK_THRESHOLD_PX,
  defaultAnnotationAt,
  isDrawingTool,
  isPathKind,
  isShapeKind,
  pathFromDrag,
  shapeFromDrag,
  TOOL_KIND,
  type Annotation,
  type PathAnnotation,
  type Point,
  type ShapeKind,
  type Style,
  type ToolName,
} from '../core';
import type { PointerInput, ToolInput } from './input';

/** What the drawing tool reads when a gesture starts (the active tool and its current style, RULE-04). */
export interface DrawSetup {
  readonly tool: ToolName;
  readonly style: Style;
  /** The image's shorter side `s` (RULE-04, RULE-05). */
  readonly shortSide: number;
  /** Screen (CSS px in the work area) → image pixels, through the view as it is when called. */
  toImage(p: Point): Point;
}

/** The id a shape has while it is drawn; MOD-App gives it its session id when it is created. */
export const DRAFT_ID = 'draft';

/** The kinds a pointer drag draws: the shapes (F-003) and the paths (F-004). */
export type DragKind = ShapeKind | PathAnnotation['kind'];

/** The kind a tool draws by dragging, or null for tools that do not draw this way. */
export function drawKindOf(tool: ToolName): DragKind | null {
  if (!isDrawingTool(tool)) return null;
  const kind = TOOL_KIND[tool];
  return isShapeKind(kind) || isPathKind(kind) ? kind : null;
}

interface Gesture {
  readonly id: number;
  readonly kind: DragKind;
  readonly style: Style;
  readonly shortSide: number;
  readonly start: Point; // screen
  readonly from: Point; // image
  readonly toImage: (p: Point) => Point;
  /** The latest pointer position (screen) and Shift state, so a view change or Shift redraws at once. */
  last: Point;
  shift: boolean;
  /** F-004: a path's samples so far, in image pixels (the press point first); empty for shapes. */
  readonly points: Point[];
  /** RULE-05: the pointer has passed the click threshold, so this gesture is a drag. */
  dragging: boolean;
  cancelled: boolean;
}

export class DrawTool implements ToolInput {
  private gesture: Gesture | null = null;
  /** The shape being dragged (CMP-Canvas "drawing": the live preview), or null. */
  preview: Annotation | null = null;

  constructor(
    private readonly setup: () => DrawSetup | null,
    /** The preview changed: repaint on the next frame. */
    private readonly onPreview: () => void,
    /** A finished shape (F-003.R1/R5); its id is DRAFT_ID until MOD-App adds it to the document. */
    private readonly onCreate: (draft: Annotation) => void,
    /** ADR-0022 / NFR-02: a gesture started; build the drag layers now, before the 4 px threshold. */
    private readonly onPrepare: () => void = () => {},
  ) {}

  /** True while a gesture is in progress (pointer down, not cancelled). */
  get active(): boolean {
    return !!this.gesture && !this.gesture.cancelled;
  }

  down(input: PointerInput): boolean {
    // A cancelled gesture whose pointer is still down (or was taken by a pinch) gives way to a new one.
    if (this.active || input.button !== 0) return false;
    const s = this.setup();
    const kind = s && drawKindOf(s.tool);
    if (!s || !kind) return false;
    const from = s.toImage(input.point);
    this.gesture = {
      id: input.id,
      kind,
      style: s.style,
      shortSide: s.shortSide,
      start: input.point,
      from,
      toImage: s.toImage,
      last: input.point,
      shift: !!input.shift,
      points: isPathKind(kind) ? [from] : [],
      dragging: false,
      cancelled: false,
    };
    this.onPrepare();
    return true;
  }

  move(input: PointerInput): void {
    const g = this.gesture;
    if (!g || g.cancelled || input.id !== g.id) return;
    if (isPathKind(g.kind)) for (const p of input.samples ?? [input.point]) this.addSample(g, g.toImage(p));
    if (!g.dragging && Math.hypot(input.point.x - g.start.x, input.point.y - g.start.y) < CLICK_THRESHOLD_PX) return;
    g.dragging = true;
    g.last = input.point;
    g.shift = !!input.shift;
    this.update(g);
  }

  /** RULE-06 "while Shift is held": pressing or releasing Shift mid-drag updates the preview at once. */
  setShift(held: boolean): void {
    const g = this.gesture;
    if (!g || g.cancelled || g.shift === held) return;
    g.shift = held;
    if (g.dragging) this.update(g);
  }

  /** The view changed mid-drag (scroll, zoom, inset): re-map the pointer so the end stays under it. */
  viewChanged(): void {
    const g = this.gesture;
    if (!g || g.cancelled || !g.dragging) return;
    if (isPathKind(g.kind)) this.addSample(g, g.toImage(g.last));
    this.update(g);
  }

  /** F-004.R1: a path sample, unless it repeats the previous one exactly. */
  private addSample(g: Gesture, p: Point): void {
    const prev = g.points[g.points.length - 1];
    if (!prev || prev.x !== p.x || prev.y !== p.y) g.points.push(p);
  }

  private update(g: Gesture): void {
    this.preview = isPathKind(g.kind)
      ? pathFromDrag(g.kind, DRAFT_ID, g.style, g.points, g.shift)
      : shapeFromDrag(g.kind, DRAFT_ID, g.style, g.from, g.toImage(g.last), g.shift);
    this.onPreview();
  }

  up(input: PointerInput): void {
    const g = this.gesture;
    if (!g || input.id !== g.id) return;
    if (!g.cancelled) this.move(input);
    this.gesture = null;
    const preview = this.preview;
    this.preview = null;
    if (g.cancelled) return;
    if (g.dragging && preview) this.onCreate(preview);
    // RULE-05: a click places the default-size shape centred on it, or a pen or highlight dot.
    else this.onCreate(defaultAnnotationAt(g.from, g.kind, g.shortSide, DRAFT_ID, g.style));
  }

  /**
   * RULE-19 Esc (and a second finger turning the gesture into a pinch): the current drag ends and
   * nothing is created. The pointer's later moves and release are ignored. Returns true if there was one.
   */
  cancel(): boolean {
    const g = this.gesture;
    if (!g || g.cancelled) return false;
    g.cancelled = true;
    this.preview = null;
    this.onPreview(); // repaint: the preview goes and the prepared drag layers are released
    return true;
  }
}
