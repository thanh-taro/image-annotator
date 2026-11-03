// MOD-Document — immutable session document, edit operations, history, unexported state
// (specs/40-technical/modules/MOD-Document.md, ADR-0008). Imports MOD-Core only; no DOM.
// The session, its history and the RULE-18 change epoch are built (F-001); the edit operations throw
// until F-003…F-011 build them.
import { HISTORY_STEPS, type Annotation, type Colour, type Frame, type ImageInfo, type PaddingSize } from '../core';

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

export const add = (_annotation: Annotation): Op => notImplemented('add');
export const update = (_id: string, _patch: Partial<Annotation>): Op => notImplemented('update');
export const remove = (_ids: Selection): Op => notImplemented('remove');
export const duplicate = (_ids: Selection): Op => notImplemented('duplicate');
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
  };
}
