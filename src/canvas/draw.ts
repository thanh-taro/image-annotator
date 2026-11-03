// MOD-Canvas — the drawing part of the tool state machine (promoted from the SP-engine spike's
// controller, ADR-0004 §5): a DOM-free `ToolInput` that turns one pointer gesture of a shape tool into
// one new annotation. Transient drag state stays here, in plain mutable data; only the finished shape
// leaves (one undo step, RULE-11). Pens, highlights, text, steps and redactions add their tools beside
// it; selecting, moving and resizing are F-008.
// Implements: F-003.R1/R2/R4/R5, RULE-05 (a drag under 4 screen pixels is a click), RULE-06 (Shift),
// RULE-19 (Esc cancels the current drag), F-003 edge case "Esc during a drag → nothing is created".
import {
  CLICK_THRESHOLD_PX,
  defaultAnnotationAt,
  isDrawingTool,
  isShapeKind,
  shapeFromDrag,
  TOOL_KIND,
  type Annotation,
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
  /** Screen (CSS px in the work area) → image pixels, for the current view. */
  toImage(p: Point): Point;
}

/** The id a shape has while it is drawn; MOD-App gives it its session id when it is created. */
export const DRAFT_ID = 'draft';

/** The shape kind a tool draws, or null for tools that are not shape tools. */
export function shapeKindOf(tool: ToolName): ShapeKind | null {
  if (!isDrawingTool(tool)) return null;
  const kind = TOOL_KIND[tool];
  return isShapeKind(kind) ? kind : null;
}

interface Gesture {
  readonly id: number;
  readonly kind: ShapeKind;
  readonly style: Style;
  readonly shortSide: number;
  readonly start: Point; // screen
  readonly from: Point; // image
  readonly toImage: (p: Point) => Point;
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
  ) {}

  /** True while a gesture is in progress (pointer down, not cancelled). */
  get active(): boolean {
    return !!this.gesture && !this.gesture.cancelled;
  }

  down(input: PointerInput): boolean {
    // A cancelled gesture whose pointer is still down (or was taken by a pinch) gives way to a new one.
    if (this.active || input.button !== 0) return false;
    const s = this.setup();
    const kind = s && shapeKindOf(s.tool);
    if (!s || !kind) return false;
    this.gesture = {
      id: input.id,
      kind,
      style: s.style,
      shortSide: s.shortSide,
      start: input.point,
      from: s.toImage(input.point),
      toImage: s.toImage,
      dragging: false,
      cancelled: false,
    };
    return true;
  }

  move(input: PointerInput): void {
    const g = this.gesture;
    if (!g || g.cancelled || input.id !== g.id) return;
    if (!g.dragging && Math.hypot(input.point.x - g.start.x, input.point.y - g.start.y) < CLICK_THRESHOLD_PX) return;
    g.dragging = true;
    this.preview = shapeFromDrag(g.kind, DRAFT_ID, g.style, g.from, g.toImage(input.point), !!input.shift);
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
    // RULE-05: a click places the default-size shape centred on it.
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
    if (this.preview) {
      this.preview = null;
      this.onPreview();
    }
    return true;
  }
}
