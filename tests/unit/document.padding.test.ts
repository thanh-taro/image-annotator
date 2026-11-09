// MOD-Document `setPadding` and `setBackground` (F-011.R1/R2/R4/R5, RULE-11, RULE-13, RULE-14).
import { describe, expect, it } from 'vitest';
import { canvasRect, type ImageInfo } from '../../src/core';
import { setBackground, setFrame, setPadding, startSession } from '../../src/document';

const info = (width: number, height: number): ImageInfo => ({ width, height, sourceName: null, sourceType: 'png' });

describe('MOD-Document padding and background', () => {
  it('F-011.AC1 RULE-14 padding M around a 1000 × 500 frame gives a 1120 × 620 canvas, 60 px on each side', () => {
    const s = startSession(info(1000, 500));
    const { doc } = s.history.apply(setPadding('M'), []);
    expect(doc.padding).toEqual({ size: 'M', background: 'transparent' });
    expect(Object.isFrozen(doc.padding)).toBe(true);
    expect(canvasRect(doc.frame, doc.padding.size)).toEqual({ x: -60, y: -60, width: 1120, height: 620 });
  });

  it('F-011.R4 RULE-13 changing the padding never moves or resizes the frame and shares the annotations', () => {
    const s = startSession(info(1000, 500));
    s.history.apply(setFrame({ x: 300, y: 150, width: 400, height: 200 }), []);
    const before = s.doc;
    const { doc } = s.history.apply(setPadding('L'), []);
    expect(doc.frame).toBe(before.frame);
    expect(doc.annotations).toBe(before.annotations);
  });

  it('F-011.AC5 RULE-11 adding padding is one step; undo removes it', () => {
    const s = startSession(info(1000, 500));
    s.history.apply(setPadding('S'), []);
    expect(s.history.canUndo).toBe(true);
    expect(s.history.undo()?.doc.padding.size).toBe('none');
    expect(s.history.canUndo).toBe(false);
  });

  it('F-011.R2 RULE-11 choosing a background is one step; the padding size is kept', () => {
    const s = startSession(info(1000, 500));
    s.history.apply(setPadding('M'), []);
    const { doc } = s.history.apply(setBackground('white'), []);
    expect(doc.padding).toEqual({ size: 'M', background: 'white' });
    expect(s.history.undo()?.doc.padding).toEqual({ size: 'M', background: 'transparent' });
  });

  it('RULE-11 choosing the padding or background the document already has is no step', () => {
    const s = startSession(info(1000, 500));
    s.history.apply(setPadding('none'), []);
    s.history.apply(setBackground('transparent'), []);
    expect(s.history.canUndo).toBe(false);
    expect(s.unexported).toBe(false);
  });

  it('F-011.R5 RULE-14 RULE-02 an unavailable size changes nothing (4096 × 4096: S, M and L exceed the limits)', () => {
    const s = startSession(info(4096, 4096));
    for (const size of ['S', 'M', 'L'] as const) s.history.apply(setPadding(size), []);
    expect(s.doc.padding.size).toBe('none');
    expect(s.history.canUndo).toBe(false);
  });
});
