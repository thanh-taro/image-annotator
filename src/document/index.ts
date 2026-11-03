// MOD-Document — immutable session document, edit operations, history, unexported state
// (specs/40-technical/modules/MOD-Document.md, ADR-0008). Imports MOD-Core only; no DOM.
// The session, its history and the RULE-18 change epoch are built (F-001); `add` and `restyle` (F-003);
// step numbering in `add`, `remove` and `duplicate` (F-006, RULE-07; F-008 wires them to the keys and
// the panel); the other edit operations throw until F-005…F-011 build them.
import {
  DUPLICATE_OFFSET,
  HISTORY_STEPS,
  moved,
  nextStepNumber,
  renumberSteps,
  type Annotation,
  type Colour,
  type Frame,
  type ImageInfo,
  type PaddingSize,
  type Style,
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

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Document ${name}`);
};

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

export const update = (_id: string, _patch: Partial<Annotation>): Op => notImplemented('update');
export const reorder = (_ids: Selection, _direction: 'forward' | 'backward'): Op => notImplemented('reorder');
export const setFrame = (_frame: Frame): Op => notImplemented('setFrame');
export const setPadding = (_size: PaddingSize): Op => notImplemented('setPadding');
export const setBackground = (_background: 'transparent' | Colour): Op => notImplemented('setBackground');
export const commitText = (_id: string, _text: string, _isNew: boolean): Op => notImplemented('commitText');

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
}

/** A session: the current document, the history and the change epoch for RULE-18. */
export interface Session {
  readonly doc: Doc;
  readonly history: History;
  markExported(): void;
  readonly unexported: boolean;
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
  };

  return {
    get doc() {
      return doc;
    },
    history,
    markExported() {
      exportedEpoch = epoch;
      chain = undefined; // an export is another command (ADR-0008 §3)
    },
    get unexported() {
      return epoch !== exportedEpoch;
    },
    newId() {
      ids++;
      return `a${ids}`;
    },
  };
}
