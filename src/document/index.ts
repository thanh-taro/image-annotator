// MOD-Document — immutable session document, edit operations, history, unexported state
// (specs/40-technical/modules/MOD-Document.md, ADR-0008). Imports MOD-Core only; no DOM.
// The session, its history and the RULE-18 change epoch are built (F-001); `add` and `restyle` (F-003);
// step numbering in `add`, `remove` and `duplicate` (F-006, RULE-07); `update`, `edit` and `reorder`
// (F-008, wired with `remove` and `duplicate` to the keys and the panel by MOD-App); the text commit rules
// in `commitText` (F-005); `setFrame` with the padding step-down (F-010, F-011.R6); `setPadding` and
// `setBackground` (F-011); `discardChain` for a cancelled colour picker (F-019.R8).
import {
  availablePaddings,
  DUPLICATE_OFFSET,
  HISTORY_STEPS,
  isBlankText,
  moved,
  nextStepNumber,
  renumberSteps,
  sameFrame,
  stepDownPadding,
  type Annotation,
  type Colour,
  type Frame,
  type ImageInfo,
  type PaddingSize,
  type Style,
  type TextAnnotation,
} from '../core';

/** The session's editable state: frozen plain objects with structural sharing. */
export interface Doc {
  readonly annotations: readonly Annotation[];
  readonly frame: Frame;
  readonly padding: { readonly size: PaddingSize; readonly background: 'transparent' | Colour };
}

export type Selection = readonly string[];

/** One pure edit operation: a function from a document to a new document. */
export type Op = (doc: Doc) => Doc;

const freezeAnnotation = (a: Annotation): Annotation => {
  const out = { ...a, style: Object.freeze({ ...a.style }) } as Annotation;
  return Object.freeze(out);
};

/**
 * F-003: adds an annotation on top (painter's order); every other object is shared (ADR-0008 §1).
 * F-006.R1 / RULE-07: a step gets the next number, whatever number its draft carries.
 */
export const add =
  (annotation: Annotation): Op =>
  (doc) => {
    const a = annotation.kind === 'step' ? { ...annotation, number: nextStepNumber(doc.annotations) } : annotation;
    return Object.freeze({ ...doc, annotations: Object.freeze([...doc.annotations, freezeAnnotation(a)]) });
  };

/**
 * F-008.R5 delete, as one step (RULE-11). F-006.R2 / RULE-07: the later steps are renumbered so the
 * numbers stay consecutive; undo restores the snapshot with the earlier numbers (ADR-0008). Deleting
 * nothing that exists returns the document itself (no step).
 */
export const remove =
  (ids: Selection): Op =>
  (doc) => {
    const gone = new Set(ids);
    const kept = doc.annotations.filter((a) => !gone.has(a.id));
    if (kept.length === doc.annotations.length) return doc;
    const annotations = renumberSteps(kept).map((a) => (Object.isFrozen(a) ? a : freezeAnnotation(a)));
    return Object.freeze({ ...doc, annotations: Object.freeze(annotations) });
  };

/**
 * F-008.R5 duplicate, as one step (RULE-11): copies of the annotations named in `ids`, in drawing order,
 * offset DUPLICATE_OFFSET image pixels right and down (RULE-19), on top; `newIds[i]` is the id of the
 * copy of `ids[i]` (MOD-App takes them from Session.newId). F-006.R5 / RULE-07: a copied step is a new
 * step and gets the next number.
 */
export const duplicate =
  (ids: Selection, newIds: readonly string[]): Op =>
  (doc) => {
    const idOf = new Map(ids.map((id, i) => [id, newIds[i]]));
    const copies: Annotation[] = [];
    let next = nextStepNumber(doc.annotations);
    for (const a of doc.annotations) {
      const id = idOf.get(a.id);
      if (id === undefined) continue;
      const copy = { ...moved(a, DUPLICATE_OFFSET, DUPLICATE_OFFSET), id } as Annotation;
      copies.push(freezeAnnotation(copy.kind === 'step' ? { ...copy, number: next++ } : copy));
    }
    if (!copies.length) return doc;
    return Object.freeze({ ...doc, annotations: Object.freeze([...doc.annotations, ...copies]) });
  };

/**
 * RULE-04: changes the style of these annotations (one step for a multi-selection, RULE-11). Only the
 * fields in `patch` change; an annotation whose style already matches is kept as is, and when nothing
 * changes the document itself is returned (no step, ADR-0008).
 */
export const restyle =
  (ids: Selection, patch: Partial<Style>): Op =>
  (doc) => {
    const wanted = new Set(ids);
    const keys = Object.keys(patch) as (keyof Style)[];
    let changed = false;
    const annotations = doc.annotations.map((a) => {
      if (!wanted.has(a.id) || keys.every((k) => a.style[k] === patch[k])) return a;
      changed = true;
      return freezeAnnotation({ ...a, style: { ...a.style, ...patch } });
    });
    return changed ? Object.freeze({ ...doc, annotations: Object.freeze(annotations) }) : doc;
  };

/** Two field values are the same (geometry is small plain data: points, boxes, numbers). */
const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * F-008.R2/R3/R8: changes the annotation `id` — its geometry from a move, a resize or the position and
 * size fields — as one step (RULE-11). Only the fields in `patch` change; when they already have these
 * values, or the annotation does not exist, the document itself is returned (no step, ADR-0008).
 */
export const update =
  (id: string, patch: Partial<Annotation>): Op =>
  (doc) => {
    const keys = Object.keys(patch) as (keyof Annotation)[];
    let changed = false;
    const annotations = doc.annotations.map((a) => {
      if (a.id !== id || keys.every((k) => same(a[k], patch[k]))) return a;
      changed = true;
      return freezeAnnotation({ ...a, ...patch } as Annotation);
    });
    return changed ? Object.freeze({ ...doc, annotations: Object.freeze(annotations) }) : doc;
  };

/**
 * F-008.R2/R7: the annotations in `changes` replace those with the same ids (a move or resize of a
 * multi-selection), all in one step (RULE-11). Built from `update`.
 */
export const edit =
  (changes: readonly Annotation[]): Op =>
  (doc) =>
    changes.reduce((d, a) => update(a.id, a)(d), doc);

/**
 * F-008.R5 bring forward / send backward, as one step (RULE-11): each selected annotation moves one place
 * up (or down) the drawing order past the next unselected one; selected neighbours move together. When
 * nothing can move, the document itself is returned (no step). Step numbers follow creation, not drawing
 * order, so they never change here (RULE-07).
 */
export const reorder =
  (ids: Selection, direction: 'forward' | 'backward'): Op =>
  (doc) => {
    const wanted = new Set(ids);
    const list = [...doc.annotations];
    let changed = false;
    const swapIfUp = (i: number) => {
      const lower = list[i];
      const upper = list[i + 1];
      if (!lower || !upper) return;
      const lowerPicked = wanted.has(lower.id);
      const upperPicked = wanted.has(upper.id);
      if (direction === 'forward' ? lowerPicked && !upperPicked : upperPicked && !lowerPicked) {
        list[i] = upper;
        list[i + 1] = lower;
        changed = true;
      }
    };
    // Forward from the top down, backward from the bottom up, so a block of selected ones moves as one.
    if (direction === 'forward') for (let i = list.length - 2; i >= 0; i--) swapIfUp(i);
    else for (let i = 0; i < list.length - 1; i++) swapIfUp(i);
    return changed ? Object.freeze({ ...doc, annotations: Object.freeze(list) }) : doc;
  };
/**
 * F-010.R5 / RULE-11: sets the frame as one step (the caller keeps it within RULE-13, MOD-Core
 * `clampFrame`). F-011.R6 / RULE-14: when the padded canvas would exceed RULE-02's limits, the padding
 * steps down to the largest size that fits, in the same step. The same frame is no step (ADR-0008).
 */
export const setFrame =
  (frame: Frame): Op =>
  (doc) => {
    if (sameFrame(doc.frame, frame)) return doc;
    const next = freeze({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });
    const padding = stepDownPadding(next, doc.padding);
    return freeze({ ...doc, frame: next, padding: padding === doc.padding ? padding : freeze({ ...padding }) });
  };
/**
 * F-011.R1/R4/R5 / RULE-14: sets the padding size as one step (RULE-11); the frame is never touched
 * (RULE-13). A size whose canvas would exceed RULE-02's limits is unavailable, so it changes nothing, and
 * the size the document already has is no step (ADR-0008).
 */
export const setPadding =
  (size: PaddingSize): Op =>
  (doc) => {
    if (doc.padding.size === size || !availablePaddings(doc.frame).includes(size)) return doc;
    return freeze({ ...doc, padding: freeze({ ...doc.padding, size }) });
  };

/**
 * F-011.R2 / RULE-14: sets the background of the whole canvas — transparent or a palette colour — as one
 * step (RULE-11); the same background is no step.
 */
export const setBackground =
  (background: 'transparent' | Colour): Op =>
  (doc) => {
    if (doc.padding.background === background) return doc;
    return freeze({ ...doc, padding: freeze({ ...doc.padding, background }) });
  };

/**
 * F-005.R6 / RULE-11 / RULE-08 text commit rules (MOD-Document "Responsibility"): `text` is the edited
 * annotation as it is when editing ends. A new text and its first edit are one step (`add`); a new text
 * left empty or only whitespace adds nothing (no step); an existing text edited to empty is one deletion
 * step; an existing text with new content is one step; an unchanged one is none. The text is kept
 * composed (NFC), as a safety net behind CMP-TextEditor (ADR-0020).
 * Spec gap (reported with F-005): MOD-Document's surface names `commitText` without its parameters; a
 * new text needs its anchor and style, so it takes the whole annotation.
 */
export const commitText =
  (text: TextAnnotation, isNew: boolean): Op =>
  (doc) => {
    const value = text.text.normalize('NFC');
    if (isBlankText(value)) return isNew ? doc : remove([text.id])(doc);
    if (isNew) return add({ ...text, text: value })(doc);
    let changed = false;
    const annotations = doc.annotations.map((a) => {
      if (a.id !== text.id || a.kind !== 'text' || a.text === value) return a;
      changed = true;
      return freezeAnnotation({ ...a, text: value });
    });
    return changed ? Object.freeze({ ...doc, annotations: Object.freeze(annotations) }) : doc;
  };

export interface Restore {
  readonly doc: Doc;
  readonly selection: Selection;
}

/**
 * Snapshot history (RULE-11, F-009): 500 steps, coalescing, redo discard. `apply` takes the selection
 * after the step; the one before is the selection last applied or restored.
 */
export interface History {
  apply(op: Op, selection: Selection, coalesceKey?: string): Restore;
  undo(): Restore | null;
  redo(): Restore | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /**
   * The selection changed outside a step (MOD-App calls this on every selection change): it becomes
   * the next step's "selection before" (F-009.R3) and breaks the coalescing chain (ADR-0008 §3).
   */
  noteSelection(selection: Selection): void;
  /** Any other command (tool change, …) breaks the coalescing chain (ADR-0008 §3). */
  breakChain(): void;
  /**
   * F-019.R8: a cancelled colour picker — when the top step is the chain `coalesceKey` (nothing else since),
   * it is dropped without a redo, so the document returns to before it and no step is recorded. Null when
   * that chain made no step.
   */
  discardChain(coalesceKey: string): Restore | null;
}

/** A session: the current document, the history and the change epoch for RULE-18. */
export interface Session {
  readonly doc: Doc;
  readonly history: History;
  /**
   * RULE-18: records a successful export. `at` is the change epoch the exported document had (taken when
   * the export started, F-012); a change made while the export ran keeps the session unexported.
   */
  markExported(at?: number): void;
  readonly unexported: boolean;
  /** The change epoch (ADR-0008 §5): bumped by every do, undo and redo. */
  readonly epoch: number;
  /** A new annotation id, unique within the session (ENT-Annotation `id`); never reused, even after undo. */
  newId(): string;
}

interface Step {
  readonly before: Doc;
  readonly after: Doc;
  readonly selectionBefore: Selection;
  readonly selectionAfter: Selection;
}

const freeze = <T extends object>(value: T): T => Object.freeze(value);

/** The document of a freshly loaded image: no annotations, the whole image as frame, no padding (RULE-13, RULE-14). */
function initialDoc(image: ImageInfo): Doc {
  return freeze({
    annotations: freeze([] as Annotation[]),
    frame: freeze({ x: 0, y: 0, width: image.width, height: image.height }),
    padding: freeze({ size: 'none' as const, background: 'transparent' as const }),
  });
}

/**
 * A new session for a loaded image (ENT-Session, F-001.R7): an empty history (RULE-11) and the change
 * epoch of RULE-18 (ADR-0008 §5) — every do, undo and redo counts; exporting records the epoch.
 * Implements: RULE-11 (snapshot steps, redo discard, HISTORY_STEPS kept), RULE-18.
 * Coalescing by key (ADR-0008 §3) is here; composite steps arrive with the features that need them.
 */
export function startSession(image: ImageInfo): Session {
  let doc = initialDoc(image);
  let steps: Step[] = [];
  let cursor = 0; // steps[0..cursor) are done
  let current: Selection = [];
  let chain: string | undefined; // coalescing key of the top step, while nothing else happened
  let epoch = 0;
  let exportedEpoch = 0;
  let ids = 0;

  const history: History = {
    apply(op, selection, coalesceKey) {
      const after = op(doc);
      if (after === doc) {
        // A no-op is not a completed change (RULE-11, RULE-18): no step, no epoch.
        current = selection;
        return { doc, selection };
      }
      const top = steps[cursor - 1];
      if (coalesceKey !== undefined && coalesceKey === chain && top && cursor === steps.length) {
        steps[cursor - 1] = { ...top, after, selectionAfter: selection };
      } else {
        steps = steps.slice(0, cursor);
        steps.push({ before: doc, after, selectionBefore: current, selectionAfter: selection });
        if (steps.length > HISTORY_STEPS) steps = steps.slice(steps.length - HISTORY_STEPS);
        cursor = steps.length;
      }
      chain = coalesceKey;
      current = selection;
      doc = after;
      epoch++;
      return { doc, selection };
    },
    undo() {
      chain = undefined;
      const step = steps[cursor - 1];
      if (!step) return null;
      cursor--;
      doc = step.before;
      current = step.selectionBefore;
      epoch++;
      return { doc, selection: current };
    },
    redo() {
      chain = undefined;
      const step = steps[cursor];
      if (!step) return null;
      cursor++;
      doc = step.after;
      current = step.selectionAfter;
      epoch++;
      return { doc, selection: current };
    },
    get canUndo() {
      return cursor > 0;
    },
    get canRedo() {
      return cursor < steps.length;
    },
    noteSelection(selection) {
      current = selection;
      chain = undefined;
    },
    breakChain() {
      chain = undefined;
    },
    discardChain(coalesceKey) {
      const top = steps[cursor - 1];
      if (chain !== coalesceKey || !top || cursor !== steps.length) return null;
      chain = undefined;
      steps = steps.slice(0, cursor - 1);
      cursor = steps.length;
      doc = top.before;
      current = top.selectionBefore;
      epoch++;
      return { doc, selection: current };
    },
  };

  return {
    get doc() {
      return doc;
    },
    history,
    markExported(at = epoch) {
      exportedEpoch = at;
      chain = undefined; // an export is another command (ADR-0008 §3)
    },
    get unexported() {
      return epoch !== exportedEpoch;
    },
    get epoch() {
      return epoch;
    },
    newId() {
      ids++;
      return `a${ids}`;
    },
  };
}
