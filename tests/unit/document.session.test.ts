// MOD-Document session: a new session per loaded image, the change epoch of RULE-18 (ADR-0008 §5).
import { describe, expect, it } from 'vitest';
import type { ImageInfo } from '../../src/core';
import { startSession, type Doc } from '../../src/document';

const image: ImageInfo = { width: 640, height: 480, sourceName: null, sourceType: 'png' };
const touch = (doc: Doc): Doc => ({ ...doc, annotations: [...doc.annotations] });

describe('MOD-Document session', () => {
  it('RULE-11 a new session has an empty history, the whole image as frame and no padding', () => {
    const s = startSession(image);
    expect(s.doc).toEqual({
      annotations: [],
      frame: { x: 0, y: 0, width: 640, height: 480 },
      padding: { size: 'none', background: 'transparent' },
    });
    expect(Object.isFrozen(s.doc)).toBe(true);
    expect(s.history.canUndo).toBe(false);
    expect(s.history.canRedo).toBe(false);
  });

  it('RULE-18 loading an image by itself is not a change', () => {
    expect(startSession(image).unexported).toBe(false);
  });

  it('RULE-18 any step made, undone or redone since load or export makes the session unexported', () => {
    const s = startSession(image);
    s.history.apply(touch, []);
    expect(s.unexported).toBe(true);
    s.markExported();
    expect(s.unexported).toBe(false);
    s.history.undo();
    expect(s.unexported).toBe(true);
    s.markExported();
    s.history.redo();
    expect(s.unexported).toBe(true);
  });

  it('RULE-18 export → undo → redo stays unexported (epoch, not cursor)', () => {
    const s = startSession(image);
    s.history.apply(touch, []);
    s.markExported();
    s.history.undo();
    s.history.redo();
    expect(s.unexported).toBe(true);
  });

  it('RULE-11 undo and redo restore the document and the selection', () => {
    const s = startSession(image);
    const before = s.doc;
    const r = s.history.apply(touch, ['a']);
    expect(r.doc).not.toBe(before);
    expect(s.doc).toBe(r.doc);
    expect(s.history.undo()).toEqual({ doc: before, selection: [] });
    expect(s.doc).toBe(before);
    expect(s.history.redo()?.selection).toEqual(['a']);
    expect(s.history.redo()).toBeNull();
  });

  it('F-009.R3 undo restores the selection that went with the change, after a selection change', () => {
    const s = startSession(image);
    s.history.apply(touch, ['A']); // draw A, A selected
    s.history.noteSelection(['B']); // the user clicks B (not a step)
    s.history.apply(touch, []); // delete B
    expect(s.history.undo()?.selection).toEqual(['B']);
    expect(s.history.redo()?.selection).toEqual([]);
  });

  it('RULE-18 a no-op operation adds no step and does not make the session unexported', () => {
    const s = startSession(image);
    s.history.apply((d) => d, ['A']);
    expect(s.history.canUndo).toBe(false);
    expect(s.unexported).toBe(false);
  });

  it('RULE-11 ADR-0008 §3 an export breaks the coalescing chain (nudge, export, nudge, undo)', () => {
    const s = startSession(image);
    s.history.apply(touch, ['A'], 'nudge:A');
    const exportedDoc = s.doc;
    s.markExported();
    s.history.apply(touch, ['A'], 'nudge:A');
    expect(s.history.undo()?.doc).toBe(exportedDoc); // back to the exported state, not past it
    expect(s.history.canUndo).toBe(true);
  });

  it('RULE-11 repeated steps with the same key coalesce until another command breaks the chain', () => {
    const s = startSession(image);
    const start = s.doc;
    s.history.apply(touch, ['A'], 'nudge:A');
    s.history.apply(touch, ['A'], 'nudge:A');
    expect(s.history.undo()?.doc).toBe(start);
    expect(s.history.canUndo).toBe(false);
    s.history.redo();
    s.history.apply(touch, ['A'], 'nudge:A'); // undo/redo broke the chain: a new step
    s.history.breakChain();
    s.history.apply(touch, ['A'], 'nudge:A'); // breakChain: another new step
    s.history.noteSelection(['A']);
    s.history.apply(touch, ['A'], 'nudge:A'); // a selection change: another new step
    let undos = 0;
    while (s.history.undo()) undos++;
    expect(undos).toBe(4);
  });
});
