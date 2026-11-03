// MOD-Canvas — the pointer input controller: a DOM-free router from pointer events to the view (and,
// from F-003, to the active tool). It owns the Space-held state, the Space+drag pan and the touch
// pointers; two touch pointers pan and zoom, one finger and plain mouse or pen drags go to the tool
// (`tool` below: the drawing tools from F-003). <Canvas> only wires the DOM listeners and pointer capture.
// Implements: F-002.R3/R4 (Space+drag, two fingers), CMP-Canvas "Behavior", RULE-19 Space+drag.
import type { Point } from '../core';
import type { ViewController } from './view';

/** One pointer event, as the canvas reads it (CSS px in the work area). */
export interface PointerInput {
  readonly id: number;
  readonly type: 'mouse' | 'pen' | 'touch' | string;
  readonly button: number;
  readonly point: Point;
  /** Shift held (RULE-06 constrain). */
  readonly shift?: boolean;
  /** Alt held (RULE-19 Pointer: Alt+drag moves an annotation, F-008). */
  readonly alt?: boolean;
}

/** What a drawing tool receives (F-003…F-010); the view takes the pointer first. */
export interface ToolInput {
  down(input: PointerInput): boolean;
  move(input: PointerInput): void;
  up(input: PointerInput): void;
  /** The gesture ends without a result (a second finger starts a pinch; RULE-19 Esc). */
  cancel?(): boolean;
}

/** The cursor the canvas shows: the pan hand while Space is held, grabbing while dragging. */
export type PanCursor = '' | 'ready' | 'active';

export class InputController {
  private space = false;
  private drag: { id: number; last: Point } | null = null;
  private readonly touches = new Map<number, Point>();
  private toolPointer: number | null = null;

  constructor(
    private readonly view: ViewController,
    private readonly onCursor: (cursor: PanCursor) => void = () => {},
    /** The active tool's input (F-003 on); null while only the view takes input. */
    public tool: ToolInput | null = null,
  ) {}

  get cursor(): PanCursor {
    return this.drag ? 'active' : this.space ? 'ready' : '';
  }

  private changed(): void {
    this.onCursor(this.cursor);
  }

  /** RULE-19 Space held on the canvas: drags pan instead of reaching the tool. Releasing ends a pan. */
  holdSpace(held: boolean): void {
    if (this.space === held) return;
    this.space = held;
    if (!held) this.drag = null;
    this.changed();
  }

  private pair(): [Point, Point] | null {
    const [a, b] = Array.from(this.touches.values());
    return a && b ? [a, b] : null;
  }

  /** A pointer went down. Returns true when the canvas should capture it. */
  down(input: PointerInput): boolean {
    if (input.type === 'touch') {
      this.touches.set(input.id, input.point);
      if (this.touches.size === 2) {
        const pair = this.pair();
        if (pair) this.view.pinch(pair[0], pair[1], true);
        // A second finger turns a one-finger tool gesture into a pinch: the tool's gesture is cancelled.
        if (this.toolPointer !== null) this.tool?.cancel?.();
        this.toolPointer = null;
        return true;
      }
      if (this.touches.size > 2) return true;
    }
    if (this.space && input.type !== 'touch') {
      if (input.button !== 0 || this.drag) return false;
      this.drag = { id: input.id, last: input.point };
      this.changed();
      return true;
    }
    if (this.tool?.down(input)) {
      this.toolPointer = input.id;
      return true;
    }
    return input.type === 'touch';
  }

  move(input: PointerInput): void {
    if (this.touches.has(input.id)) {
      this.touches.set(input.id, input.point);
      if (this.touches.size >= 2) {
        const pair = this.pair();
        if (pair) this.view.pinch(pair[0], pair[1], false);
        return;
      }
    }
    const drag = this.drag;
    if (drag && input.id === drag.id) {
      this.view.panBy(input.point.x - drag.last.x, input.point.y - drag.last.y);
      drag.last = input.point;
      return;
    }
    if (input.id === this.toolPointer) this.tool?.move(input);
  }

  /** A pointer went up (see cancel() for `pointercancel`). */
  up(input: PointerInput): void {
    if (this.touches.delete(input.id)) {
      this.view.endPinch();
      const pair = this.pair();
      if (pair) this.view.pinch(pair[0], pair[1], true); // a third finger lifted: go on with the two left
    }
    if (this.drag && input.id === this.drag.id) {
      this.drag = null;
      this.changed();
      return;
    }
    if (input.id === this.toolPointer) {
      this.toolPointer = null;
      this.tool?.up(input);
    }
  }

  /**
   * The browser or OS cancelled a pointer (`pointercancel`: an edge gesture, palm rejection, lost
   * capture). Pinch and pan end as on release; the tool's gesture ends with no result, like Esc.
   */
  cancel(input: PointerInput): void {
    if (input.id === this.toolPointer) {
      this.toolPointer = null;
      this.tool?.cancel?.();
      this.tool?.up(input); // the cancelled gesture is closed; nothing is created
      return;
    }
    this.up(input);
  }
}
