// MOD-Core redaction geometry (F-007): the outward-rounded box (INV-02), the RULE-10 sizes and read
// window (ADR-0006), the solids an effect reads, and the RULE-20 count.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STYLES,
  effectArea,
  effectSize,
  redactionBox,
  redactionCount,
  solidsTouching,
  type Annotation,
  type Box,
  type Style,
} from '../../src/core';

const red = (id: string, box: Box, style: Partial<Style> = {}): Annotation => ({
  id,
  kind: 'redaction',
  style: { ...DEFAULT_STYLES.redact, ...style },
  box,
});

describe('MOD-Core redaction geometry', () => {
  it('INV-02 F-007.AC11 a redaction box is extended outward to whole pixels (left edge 10.4 covers column 10)', () => {
    expect(redactionBox({ x: 10.4, y: 5.6, width: 20.2, height: 3 })).toEqual({ x: 10, y: 5, width: 21, height: 4 });
    expect(redactionBox({ x: 3, y: 4, width: 5, height: 6 })).toEqual({ x: 3, y: 4, width: 5, height: 6 });
    // A box given right-to-left is normalised first.
    expect(redactionBox({ x: 30.5, y: 10, width: -10.2, height: 2 })).toEqual({ x: 20, y: 10, width: 11, height: 2 });
  });

  it('RULE-10 F-007.AC4 pixelate M on a 1000 × 800 image is 16 px blocks; blur radii follow the table', () => {
    expect(effectSize({ ...DEFAULT_STYLES.redact, redactionKind: 'pixelate', strength: 'M' }, 800)).toBe(16);
    expect(effectSize({ ...DEFAULT_STYLES.redact, redactionKind: 'blur', strength: 'S' }, 800)).toBe(8);
    expect(effectSize({ ...DEFAULT_STYLES.redact, redactionKind: 'blur', strength: 'L' }, 800)).toBe(32);
    expect(effectSize({ ...DEFAULT_STYLES.redact, redactionKind: 'blur', strength: 'S' }, 100)).toBe(6);
  });

  it('RULE-10 ADR-0006 the output is the box within the frame; blur reads 3b around it, clamped to the frame', () => {
    const frame = { x: 0, y: 0, width: 400, height: 200 };
    // r = 10 → b = 5 → 3b = 15.
    expect(effectArea({ x: -20.5, y: 50, width: 100, height: 20 }, 'blur', 10, frame)).toEqual({
      output: { x: 0, y: 50, width: 80, height: 20 },
      window: { x: 0, y: 35, width: 95, height: 50 },
    });
    expect(effectArea({ x: 100, y: 50, width: 10, height: 10 }, 'pixelate', 16, frame)?.window).toEqual({
      x: 100,
      y: 50,
      width: 10,
      height: 10,
    });
    expect(effectArea({ x: 500, y: 50, width: 10, height: 10 }, 'blur', 10, frame)).toBeNull();
  });

  it('RULE-10 INV-02 an effect depends on exactly the solids inside its read window', () => {
    const solid = red('s', { x: 50, y: 50, width: 10, height: 10 });
    const far = red('f', { x: 300, y: 50, width: 10, height: 10 });
    const blur = red('b', { x: 0, y: 0, width: 10, height: 10 }, { redactionKind: 'blur' });
    expect(solidsTouching([solid, far, blur], { x: 0, y: 0, width: 100, height: 100 }).map((a) => a.id)).toEqual(['s']);
  });

  it('RULE-20 the count is redactions of any kind overlapping the canvas', () => {
    const canvas = { x: 0, y: 0, width: 1000, height: 800 };
    const inside = red('a', { x: 10, y: 10, width: 50, height: 50 });
    const blur = red('b', { x: 990, y: 790, width: 50, height: 50 }, { redactionKind: 'blur' });
    const outside = red('c', { x: 1200, y: 10, width: 50, height: 50 });
    const rect: Annotation = {
      id: 'r',
      kind: 'rectangle',
      style: DEFAULT_STYLES.rectangle,
      box: { x: 0, y: 0, width: 5, height: 5 },
    };
    expect(redactionCount([inside, blur, outside, rect], canvas)).toBe(2);
    expect(redactionCount([], canvas)).toBe(0);
  });
});
