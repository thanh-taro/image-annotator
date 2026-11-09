// MOD-Core frame maths (RULE-13) and the padding sizes it allows (RULE-14), driven by F-010's crop tool,
// keys and fields.
import { describe, expect, it } from 'vitest';
import {
  availablePaddings,
  clampFrame,
  dragFrame,
  frameGripAt,
  isWholeFrame,
  movedFrame,
  resizedFrame,
  stepDownPadding,
  wholeFrame,
  withFrameField,
} from '../../src/core';

const HD = { width: 1920, height: 1080 };
const whole = wholeFrame(HD);

describe('MOD-Core frame (RULE-13)', () => {
  it('F-010.AC1 dragging the left edge 200 image pixels right gives a 1720 × 1080 frame', () => {
    expect(dragFrame(whole, 'w', 200, 0, HD)).toEqual({ x: 200, y: 0, width: 1720, height: 1080 });
  });

  it('F-010.AC6 RULE-13 dragging a corner towards 5 × 5 stops at 16 × 16; the opposite corner stays', () => {
    const f = { x: 100, y: 100, width: 400, height: 300 };
    expect(dragFrame(f, 'se', -395, -295, HD)).toEqual({ x: 100, y: 100, width: 16, height: 16 });
    expect(dragFrame(f, 'nw', 395, 295, HD)).toEqual({ x: 484, y: 384, width: 16, height: 16 });
    // A new frame drawn as a 5 × 5 box grows to the minimum in the direction dragged.
    expect(dragFrame(f, 'new', 5, 5, HD, { x: 50, y: 60 })).toEqual({ x: 50, y: 60, width: 16, height: 16 });
    expect(dragFrame(f, 'new', -5, -5, HD, { x: 50, y: 60 })).toEqual({ x: 34, y: 44, width: 16, height: 16 });
  });

  it('RULE-13 an image smaller than 16 px on a side keeps that side whole', () => {
    const tiny = { width: 10, height: 400 };
    expect(dragFrame(wholeFrame(tiny), 'e', -8, 0, tiny).width).toBe(10);
    expect(clampFrame({ x: 3, y: 0, width: 2, height: 1 }, tiny)).toEqual({ x: 0, y: 0, width: 10, height: 16 });
  });

  it('F-010.AC8 dragging inside a 1000 × 500 frame 100 image pixels right moves it and keeps its size', () => {
    const f = { x: 200, y: 200, width: 1000, height: 500 };
    expect(dragFrame(f, 'move', 100, 0, HD)).toEqual({ x: 300, y: 200, width: 1000, height: 500 });
    // RULE-13: always inside the image.
    expect(dragFrame(f, 'move', 5000, 5000, HD)).toEqual({ x: 920, y: 580, width: 1000, height: 500 });
  });

  it('RULE-13 edges stay inside the image and values are whole pixels', () => {
    expect(dragFrame(whole, 'w', -50, 0, HD)).toEqual(whole);
    expect(dragFrame(whole, 'ne', 10.4, 30.6, HD)).toEqual({ x: 0, y: 31, width: 1920, height: 1049 });
    expect(dragFrame(whole, 'new', 3000, 3000, HD, { x: 100.2, y: -40 })).toEqual({
      x: 100,
      y: 0,
      width: 1820,
      height: 1080,
    });
    expect(clampFrame({ x: 1900.4, y: -3, width: 400.6, height: 2000 }, HD)).toEqual({
      x: 1519,
      y: 0,
      width: 401,
      height: 1080,
    });
  });

  it('F-010.AC7 RULE-19 Alt+Shift+Left moves the right edge 10 px left; arrows move the frame', () => {
    const f = { x: 100, y: 100, width: 800, height: 600 };
    expect(resizedFrame(f, -10, 0, HD)).toEqual({ x: 100, y: 100, width: 790, height: 600 });
    expect(resizedFrame(f, 0, 1, HD)).toEqual({ x: 100, y: 100, width: 800, height: 601 });
    expect(movedFrame(f, -10, 1, HD)).toEqual({ x: 90, y: 101, width: 800, height: 600 });
    expect(resizedFrame(f, -1000, 0, HD).width).toBe(16);
  });

  it('F-010.AC9 typing 800 in the width field makes the frame 800 pixels wide', () => {
    expect(withFrameField(whole, 'width', 800, HD)).toEqual({ x: 0, y: 0, width: 800, height: 1080 });
    const f = { x: 1500, y: 0, width: 400, height: 1080 };
    // Within the limits of dragging: the left edge stays, the right edge stops at the image's edge.
    expect(withFrameField(f, 'width', 800, HD).width).toBe(420);
    expect(withFrameField(f, 'x', 10, HD)).toEqual({ x: 10, y: 0, width: 400, height: 1080 });
    expect(withFrameField(f, 'height', 3, HD).height).toBe(16);
  });

  it('F-010.AC4 the reset frame is the whole image', () => {
    expect(isWholeFrame(whole, HD)).toBe(true);
    expect(isWholeFrame({ ...whole, width: 1919 }, HD)).toBe(false);
  });

  it('F-010.R1 a press grabs an edge or corner, the inside (move) or the outside (a new frame)', () => {
    const f = { x: 100, y: 100, width: 400, height: 300 };
    expect(frameGripAt(f, { x: 100, y: 250 }, 8)).toBe('w');
    expect(frameGripAt(f, { x: 505, y: 105 }, 8)).toBe('ne');
    expect(frameGripAt(f, { x: 300, y: 395 }, 8)).toBe('s');
    expect(frameGripAt(f, { x: 300, y: 250 }, 8)).toBe('move');
    expect(frameGripAt(f, { x: 50, y: 50 }, 8)).toBe('new');
    // A frame narrower than two grip zones: the nearer edge wins.
    const thin = { x: 100, y: 100, width: 10, height: 300 };
    expect(frameGripAt(thin, { x: 102, y: 250 }, 8)).toBe('w');
    expect(frameGripAt(thin, { x: 109, y: 250 }, 8)).toBe('e');
  });
});

describe('MOD-Core padding sizes (RULE-14)', () => {
  it('RULE-14 every size is available for a small frame', () => {
    expect(availablePaddings({ x: 0, y: 0, width: 800, height: 600 })).toEqual(['none', 'S', 'M', 'L']);
  });

  it('RULE-14 RULE-02 sizes that push the canvas over the limits are unavailable', () => {
    // 4096 × 4096 is exactly the pixel limit: any padding is over it.
    expect(availablePaddings({ x: 0, y: 0, width: 4096, height: 4096 })).toEqual(['none']);
    // 3800 × 3800: S (114 px a side) → 4028² fits; M (228) → 4256² does not.
    expect(availablePaddings({ x: 0, y: 0, width: 3800, height: 3800 })).toEqual(['none', 'S']);
  });

  it('F-011.R6 RULE-14 a frame change steps the padding down to the largest size that fits', () => {
    const big = { x: 0, y: 0, width: 3800, height: 3800 };
    expect(stepDownPadding(big, { size: 'L', background: 'blue' })).toEqual({ size: 'S', background: 'blue' });
    const kept = { size: 'M' as const, background: 'transparent' as const };
    expect(stepDownPadding({ x: 0, y: 0, width: 800, height: 600 }, kept)).toBe(kept);
  });
});
