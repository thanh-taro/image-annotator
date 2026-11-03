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
});
