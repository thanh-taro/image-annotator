// MOD-Document `setFrame` (F-010.R5, RULE-11, RULE-13; the padding step-down of F-011.R6 in the same step).
import { describe, expect, it } from 'vitest';
import type { ImageInfo } from '../../src/core';
import { setFrame, startSession, type Doc } from '../../src/document';

const image: ImageInfo = { width: 1920, height: 1080, sourceName: null, sourceType: 'png' };

describe('MOD-Document setFrame', () => {
  it('F-010.R5 RULE-11 a frame change is one undo step; the annotations are shared', () => {
    const s = startSession(image);
    const before = s.doc;
    const { doc } = s.history.apply(setFrame({ x: 200, y: 0, width: 1720, height: 1080 }), []);
    expect(doc.frame).toEqual({ x: 200, y: 0, width: 1720, height: 1080 });
    expect(Object.isFrozen(doc.frame)).toBe(true);
    expect(doc.annotations).toBe(before.annotations);
    expect(s.history.canUndo).toBe(true);
    expect(s.history.undo()?.doc.frame).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('F-010.AC5 cropped and cropped again: one undo restores the first crop', () => {
    const s = startSession(image);
    s.history.apply(setFrame({ x: 100, y: 100, width: 800, height: 600 }), []);
    s.history.apply(setFrame({ x: 150, y: 120, width: 400, height: 300 }), []);
    expect(s.history.undo()?.doc.frame).toEqual({ x: 100, y: 100, width: 800, height: 600 });
  });

  it('RULE-11 setting the frame it already has is no step', () => {
    const s = startSession(image);
    s.history.apply(setFrame({ x: 0, y: 0, width: 1920, height: 1080 }), []);
    expect(s.history.canUndo).toBe(false);
    expect(s.unexported).toBe(false);
  });

  it('F-011.R6 RULE-14 a frame change that would push the canvas over the limits steps the padding down in the same step', () => {
    const big: ImageInfo = { width: 4000, height: 4000, sourceName: null, sourceType: 'png' };
    const s = startSession(big);
    // A padded document (F-011 builds the padding command): L around a small frame fits.
    const padded = (d: Doc): Doc => ({
      ...d,
      frame: { x: 0, y: 0, width: 1000, height: 1000 },
      padding: { size: 'L', background: 'blue' },
    });
    s.history.apply(padded, []);
    const { doc } = s.history.apply(setFrame({ x: 0, y: 0, width: 3800, height: 3800 }), []);
    expect(doc.padding).toEqual({ size: 'S', background: 'blue' });
    expect(s.history.undo()?.doc.padding.size).toBe('L');
  });
});
