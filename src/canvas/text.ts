// MOD-Canvas — the text tool and the edit session of CMP-TextEditor (F-005), DOM-free: which press
// starts, continues or ends an edit, which text it edits, and where the caret goes. The text field
// itself (the transparent `<textarea>` over the canvas glyphs, ADR-0009 §2) is behind `TextField`
// (./editor.ts); while an edit is open the canvas paints `draft()` — the edited text with the field's
// current value — through the same MOD-Render `paint` as the export, so the glyphs the user sees while
// typing are the final ones (F-005.R2). The document changes only when the edit ends (MOD-App commits
// it with MOD-Document `commitText`, F-005.R6).
// Implements: F-005.R1 (a click on empty canvas places a text with its top-left corner at the click and
// edits it; a click on an existing text edits that text), F-005.R3 (a press outside the text only ends
// the edit), F-005.R4 (double-click with the select tool, Enter on a selected text), RULE-19 (Enter with
// the text tool: a text at the centre of the view, editing), ADR-0009 §4 (nothing before the fonts).
import {
  caretIndexAt,
  DEFAULT_STYLES,
  hitsText,
  isTextAnnotation,
  textAt,
  type Annotation,
  type Point,
  type Style,
  type TextAnnotation,
  type TextMeasure,
  type ToolName,
} from '../core';
import { DRAFT_ID } from './draw';
import type { PointerInput, ToolInput } from './input';

/** What the text tool reads when it acts. */
export interface TextSetup {
  readonly tool: ToolName;
  /** The text tool's current style (RULE-04), for a new text. */
  readonly style: Style;
  readonly shortSide: number;
  readonly annotations: readonly Annotation[];
  readonly measure: TextMeasure;
  /** CMP-Canvas: the hit tolerance in image pixels (HIT_TOLERANCE_PX / zoom). */
  readonly tolerance: number;
  /** Screen (CSS px in the work area) → image pixels. */
  toImage(p: Point): Point;
}

/** CMP-TextEditor's field, as the session drives it (./editor.ts). */
export interface TextField {
  /** Shows the field with `value`, focuses it and puts the caret at `caret` (UTF-16 index). */
  open(value: string, caret: number): void;
  close(): void;
  readonly value: string;
}

/** An open edit: of an existing text (`id`), or of a new one at `anchor` (`id` null, not in the document). */
export interface TextEdit {
  readonly id: string | null;
  readonly anchor: Point;
}

/** Why an edit ended: Esc, a press on the canvas, focus leaving the tool's editing controls, or a new image. */
export type TextEndReason = 'escape' | 'press' | 'focus' | 'discard';

export interface TextCallbacks {
  /** An edit started (MOD-App: SCR-Annotator "editing-text", the selection). */
  begin(edit: TextEdit): void;
  /** An edit ended with the text as it is now (a new one has id DRAFT_ID); MOD-App commits it. */
  end(edit: TextEdit, text: TextAnnotation | null, reason: TextEndReason): void;
}

export class TextTool implements ToolInput {
  edit: TextEdit | null = null;
  private press: { readonly id: number; readonly point: Point } | null = null;
  /** The press that ended an edit: its release does nothing more (F-005.AC10). */
  private swallowed: number | null = null;

  constructor(
    private readonly setup: () => TextSetup | null,
    private readonly field: TextField,
    private readonly callbacks: TextCallbacks,
    /** ADR-0009 §4: no text is placed until the tool's face is ready (./fonts.ts). */
    private readonly fonts: { readonly ready: boolean } = { ready: true },
  ) {}

  get active(): boolean {
    return this.edit !== null;
  }

  /**
   * The text being edited, with the field's current value: an existing text keeps its place, style and
   * id from the document; a new one has the text tool's current style (RULE-04) and id DRAFT_ID.
   */
  draft(annotations: readonly Annotation[], style: Style): TextAnnotation | null {
    const e = this.edit;
    if (!e) return null;
    if (e.id === null) return textAt(e.anchor, DRAFT_ID, style, this.field.value);
    const a = annotations.find((x) => x.id === e.id);
    return a && isTextAnnotation(a) ? { ...a, text: this.field.value } : null;
  }

  down(input: PointerInput): boolean {
    // F-005.R3 / AC10: a press anywhere on the canvas while editing only ends the edit.
    if (this.edit) {
      this.end('press');
      this.swallowed = input.id;
      return true;
    }
    if (input.button !== 0 || !this.fonts.ready) return false;
    const s = this.setup();
    if (!s || s.tool !== 'text') return false;
    this.press = { id: input.id, point: input.point };
    return true;
  }

  move(): void {
    // A text is placed at its press point; a press that moves does not drag anything.
  }

  up(input: PointerInput): void {
    if (this.swallowed === input.id) {
      this.swallowed = null;
      return;
    }
    const press = this.press;
    if (!press || press.id !== input.id) return;
    this.press = null;
    const s = this.setup();
    if (!s || s.tool !== 'text') return;
    const p = s.toImage(press.point);
    // F-005.R1 / AC11: a click on an existing text edits it (caret where clicked); else a new text there.
    const hit = this.textAt(s, p);
    if (hit) this.begin(hit, hit.anchor, caretIndexAt(hit, p, s.shortSide, s.measure));
    else this.begin(null, p, 0);
  }

  /** The gesture ends with no result (a second finger, pointercancel). An open edit stays open. */
  cancel(): boolean {
    const had = this.press !== null;
    this.press = null;
    return had;
  }

  /** RULE-19 Enter with the text tool: a new text at `centre` (image pixels), editing. True if started. */
  placeAt(centre: Point | null): boolean {
    const s = this.fonts.ready ? this.setup() : null;
    if (!s || s.tool !== 'text' || !centre || this.edit) return false;
    this.begin(null, centre, 0);
    return true;
  }

  /** F-005.R4 / AC5: a double-click with the select tool on a text edits it with the caret where clicked. */
  editAtScreen(point: Point): boolean {
    const s = this.fonts.ready ? this.setup() : null;
    if (!s || s.tool !== 'select' || this.edit) return false;
    const p = s.toImage(point);
    const hit = this.textAt(s, p);
    if (!hit) return false;
    this.begin(hit, hit.anchor, caretIndexAt(hit, p, s.shortSide, s.measure));
    return true;
  }

  /** F-005.R4 / RULE-19 Enter with the select tool and one text selected: edits it, caret at the end. */
  editById(id: string): boolean {
    const s = this.fonts.ready ? this.setup() : null;
    const a = s?.annotations.find((x) => x.id === id);
    if (!s || !a || !isTextAnnotation(a) || this.edit) return false;
    this.begin(a, a.anchor, a.text.length);
    return true;
  }

  /** Ends the open edit, keeping the text (F-005.R3), or for 'discard' dropping it. True if one was open. */
  end(reason: TextEndReason): boolean {
    const e = this.edit;
    if (!e) return false;
    const s = this.setup();
    const text = reason === 'discard' ? null : this.draft(s?.annotations ?? [], s?.style ?? DEFAULT_STYLES.text);
    this.edit = null;
    this.field.close();
    this.callbacks.end(e, text, reason);
    return true;
  }

  private begin(target: TextAnnotation | null, anchor: Point, caret: number): void {
    this.edit = { id: target?.id ?? null, anchor: { x: anchor.x, y: anchor.y } };
    this.field.open(target?.text ?? '', caret);
    this.callbacks.begin(this.edit);
  }

  /** The topmost text annotation hit at `p` (only texts: a click on a text edits it even under a shape). */
  private textAt(s: TextSetup, p: Point): TextAnnotation | undefined {
    for (let i = s.annotations.length - 1; i >= 0; i--) {
      const a = s.annotations[i];
      if (a && isTextAnnotation(a) && hitsText(a, p, s.tolerance, s.shortSide, s.measure)) return a;
    }
    return undefined;
  }
}
