// MOD-Canvas — the selecting and editing part of the tool state machine (F-008), DOM-free: a `ToolInput`
// that turns one pointer gesture of the select tool (or an Alt+press on an annotation while a drawing
// tool is active, RULE-19 Pointer) into a selection click, a marquee, a move of the selection or a
// handle drag. Transient drag state stays here in plain mutable data (MOD-Canvas); only the finished
// move or resize leaves, as the changed annotations (MOD-App records them as one undo step, RULE-11).
// While dragging, `preview` holds the dragged annotations as they are now, which <Canvas> paints between
// the split drag layers (ADR-0022), prepared at the press (`pending`, NFR-02).
// Implements: F-008.R1 (click, Shift+click, marquee, a click on empty canvas clears), F-008.R2 (dragging
// a selected annotation moves the whole selection), F-008.R3 (handles: resize a box, move a line's ends,
// scale a stroke or highlight; Shift keeps the aspect ratio, RULE-06), F-008.R6 (Alt+drag with a drawing
// tool moves; a plain drag always draws), RULE-05 (a press that moves under 4 screen pixels is a
// selection click and records nothing; past it, the move or resize follows from the press point),
// RULE-19 (Esc cancels the current drag).
import {
  CLICK_THRESHOLD_PX,
  boxBetween,
  hitHandle,
  hitTopmost,
  marqueeHits,
  moved,
  resized,
  type Annotation,
  type Box,
  type Handle,
  type Point,
  type TextMeasure,
  type ToolName,
} from '../core';
import type { PointerInput, ToolInput } from './input';

/** What the select tool reads when a gesture starts. */
export interface SelectSetup {
  readonly tool: ToolName;
  readonly annotations: readonly Annotation[];
  readonly selection: readonly string[];
  /** The image's shorter side `s` (RULE-04 stroke widths for hit-testing). */
  readonly shortSide: number;
  readonly measure: TextMeasure;
  /** CMP-Canvas: the hit tolerance in image pixels (HIT_TOLERANCE_PX / zoom). */
  readonly tolerance: number;
  /** Half a handle's hit area in image pixels (size.targetMin / 2 / zoom). */
  readonly handleHalf: number;
  /** Screen (CSS px in the work area) → image pixels, through the view as it is when called. */
  toImage(p: Point): Point;
}

export interface SelectCallbacks {
  /** The selection changes (not an undo step, RULE-11). */
  select(ids: readonly string[]): void;
  /** A finished move or resize: the dragged annotations as they are now (one undo step, RULE-11). */
  commit(changes: readonly Annotation[]): void;
  /** The preview or marquee changed: repaint on the next frame. */
  preview(): void;
  /** ADR-0022 / NFR-02: a press that may become a move or resize; build the drag layers now. */
  prepare(): void;
}

type Mode = 'move' | 'resize' | 'marquee';

interface Gesture {
  readonly id: number;
  readonly mode: Mode;
  readonly start: Point; // screen
  readonly from: Point; // image
  readonly toImage: (p: Point) => Point;
  readonly handle?: Handle;
  /** The selection a click (a press that does not pass the threshold) leaves. */
  readonly click: readonly string[];
  /** The annotations a move or resize drags (and the selection it leaves), as at the press. */
  readonly dragged: readonly Annotation[];
  readonly shortSide: number;
  readonly measure: TextMeasure;
  readonly annotations: readonly Annotation[];
  readonly selection: readonly string[];
  last: Point;
  shift: boolean;
  dragging: boolean;
  cancelled: boolean;
}

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export class SelectTool implements ToolInput {
  private gesture: Gesture | null = null;
  /** The dragged annotations as they are now, by id (CMP-Canvas "selected" while moving), or null. */
  preview: ReadonlyMap<string, Annotation> | null = null;
  /** The selection box being dragged, in image pixels (any direction), or null. */
  marquee: Box | null = null;

  constructor(
    private readonly setup: () => SelectSetup | null,
    private readonly callbacks: SelectCallbacks,
    /** ADR-0009 §4: nothing is edited until the tool's face is ready (./fonts.ts). */
    private readonly fonts: { readonly ready: boolean } = { ready: true },
  ) {}

  /** True while a gesture is in progress (pointer down, not cancelled). */
  get active(): boolean {
    return !!this.gesture && !this.gesture.cancelled;
  }

  /**
   * The ids a press on an annotation or handle may drag, from the press until the release (ADR-0022:
   * the drag layers are prepared for them), or null.
   */
  get pending(): readonly string[] | null {
    const g = this.gesture;
    return g && !g.cancelled && g.mode !== 'marquee' ? g.dragged.map((a) => a.id) : null;
  }

  /** The handle of the single selected annotation at `p` (image pixels), if any (F-008.R3). */
  handleAt(p: Point): Handle | undefined {
    const s = this.setup();
    if (!s || s.selection.length !== 1) return undefined;
    const a = s.annotations.find((x) => x.id === s.selection[0]);
    return a && hitHandle(a, p, s.handleHalf);
  }

  down(input: PointerInput): boolean {
    if (this.active || input.button !== 0 || !this.fonts.ready) return false;
    const s = this.setup();
    if (!s) return false;
    const select = s.tool === 'select';
    // F-008.R6 / RULE-19: with a drawing tool only Alt+press reaches the select tool; a plain one draws.
    if (!select && !input.alt) return false;
    const from = s.toImage(input.point);
    const shift = !!input.shift;
    const base = {
      id: input.id,
      start: input.point,
      from,
      toImage: s.toImage,
      shortSide: s.shortSide,
      measure: s.measure,
      annotations: s.annotations,
      selection: s.selection,
      last: input.point,
      shift,
      dragging: false,
      cancelled: false,
    };
    // F-008.R3: a handle of the single selection resizes it.
    const handle = s.selection.length === 1 ? this.handleAt(from) : undefined;
    const single = handle && s.annotations.find((a) => a.id === s.selection[0]);
    if (handle && single) {
      this.gesture = { ...base, mode: 'resize', handle, click: s.selection, dragged: [single] };
      this.callbacks.prepare();
      return true;
    }
    const hit = hitTopmost(s.annotations, from, s.tolerance, s.shortSide, s.measure);
    if (!hit) {
      // Alt on empty canvas with a drawing tool: the press is the drawing tool's.
      if (!select) return false;
      // RULE-05: a click on empty canvas clears the selection; beyond 4 px it draws a selection box.
      this.gesture = { ...base, mode: 'marquee', click: [], dragged: [] };
      return true;
    }
    const picked = s.selection.includes(hit.id);
    // F-008.R1: a click selects it; Shift+click adds or removes it.
    const click = shift ? (picked ? s.selection.filter((id) => id !== hit.id) : [...s.selection, hit.id]) : [hit.id];
    // F-008.R2: dragging a selected annotation moves the whole selection; an unselected one is selected
    // first (Shift adds it to the selection).
    const ids = new Set(picked ? s.selection : shift ? [...s.selection, hit.id] : [hit.id]);
    const dragged = s.annotations.filter((a) => ids.has(a.id));
    this.gesture = { ...base, mode: 'move', click, dragged };
    this.callbacks.prepare();
    return true;
  }

  move(input: PointerInput): void {
    const g = this.gesture;
    if (!g || g.cancelled || input.id !== g.id) return;
    g.last = input.point;
    g.shift = !!input.shift;
    if (!g.dragging) {
      if (Math.hypot(input.point.x - g.start.x, input.point.y - g.start.y) < CLICK_THRESHOLD_PX) return;
      g.dragging = true;
      // The dragged annotations become the selection when the drag starts (not an undo step).
      const ids = g.dragged.map((a) => a.id);
      if (g.mode !== 'marquee' && !sameIds(ids, g.selection)) this.callbacks.select(ids);
    }
    this.update(g);
  }

  /** RULE-06 "while Shift is held": pressing or releasing Shift mid-resize updates the preview at once. */
  setShift(held: boolean): void {
    const g = this.gesture;
    if (!g || g.cancelled || g.shift === held) return;
    g.shift = held;
    if (g.dragging) this.update(g);
  }

  /** The view changed mid-drag (scroll, zoom): re-map the pointer so the drag stays under it. */
  viewChanged(): void {
    const g = this.gesture;
    if (g && !g.cancelled && g.dragging) this.update(g);
  }

  private update(g: Gesture): void {
    const to = g.toImage(g.last);
    const dx = to.x - g.from.x;
    const dy = to.y - g.from.y;
    if (g.mode === 'marquee') {
      this.marquee = boxBetween(g.from, to);
    } else if (g.mode === 'resize' && g.handle) {
      const handle = g.handle;
      this.preview = new Map(g.dragged.map((a) => [a.id, resized(a, handle, dx, dy, g.shift)]));
    } else {
      this.preview = new Map(g.dragged.map((a) => [a.id, moved(a, dx, dy)]));
    }
    this.callbacks.preview();
  }

  up(input: PointerInput): void {
    const g = this.gesture;
    if (!g || input.id !== g.id) return;
    if (!g.cancelled) this.move(input);
    this.gesture = null;
    const preview = this.preview;
    const marquee = this.marquee;
    this.preview = null;
    this.marquee = null;
    if (g.cancelled) return;
    if (!g.dragging) {
      // RULE-05: a selection click; no undo step.
      if (!sameIds(g.click, g.selection)) this.callbacks.select(g.click);
      this.callbacks.preview(); // the prepared drag layers are released
      return;
    }
    if (g.mode === 'marquee' && marquee) {
      this.callbacks.select(marqueeHits(g.annotations, marquee, g.shortSide, g.measure));
      this.callbacks.preview();
      return;
    }
    if (preview) this.callbacks.commit(g.dragged.map((a) => preview.get(a.id) ?? a));
  }

  /** RULE-19 Esc (and a second finger): the current drag ends and nothing changes. True if there was one. */
  cancel(): boolean {
    const g = this.gesture;
    if (!g || g.cancelled) return false;
    g.cancelled = true;
    this.preview = null;
    this.marquee = null;
    this.callbacks.preview();
    return true;
  }
}
