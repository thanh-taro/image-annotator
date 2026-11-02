// MOD-Document — immutable session document, edit operations, history, unexported state
// (specs/40-technical/modules/MOD-Document.md, ADR-0008). Imports MOD-Core only; no DOM.
// Phase 3.3 scaffold: the public surface is typed; every operation throws until F-008/F-009/F-014.
import type { Annotation, Colour, Frame, ImageInfo, PaddingSize } from '../core';

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

/** Snapshot history (RULE-11, F-009): 500 steps, coalescing, redo discard. */
export interface History {
  apply(op: Op, selection: Selection, coalesceKey?: string): Restore;
  undo(): Restore | null;
  redo(): Restore | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/** A session: the history plus the change epoch for RULE-18. */
export interface Session {
  readonly history: History;
  markExported(): void;
  readonly unexported: boolean;
}

export function startSession(_image: ImageInfo): Session {
  return notImplemented('startSession');
}
