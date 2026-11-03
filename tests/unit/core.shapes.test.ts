// MOD-Core shape geometry (F-003): RULE-05 default size, RULE-06 constraints, F-003.R2 arrowheads,
// RULE-04 default styles, and the SP-engine hit-testing, handles, move and resize (ADR-0004 §3).
import { describe, expect, it } from 'vitest';
import {
  arrowHead,
  boundsOf,
  constrain,
  DEFAULT_STYLES,
  defaultAnnotationAt,
  handlesOf,
  hitHandle,
  hitTest,
  HIT_TOLERANCE_PX,
  moved,
  resized,
  shapeFromDrag,
  strokePixels,
  toolOf,
  type Annotation,
  type Style,
} from '../../src/core';

const red: Style = DEFAULT_STYLES.rectangle;
const S = 800; // the shorter side of a 1000 × 800 image

describe('MOD-Core shapes', () => {
  it('RULE-04 default current style per tool', () => {
    for (const tool of ['rectangle', 'ellipse', 'line', 'arrow', 'pen', 'text', 'step'] as const)
      expect(DEFAULT_STYLES[tool]).toMatchObject({ color: 'red', strokeSize: 'M', fill: 'none' });
    expect(DEFAULT_STYLES.highlight).toMatchObject({ color: 'yellow', strokeSize: 'L' });
    expect(DEFAULT_STYLES.redact).toMatchObject({ color: 'black', redactionKind: 'solid', strength: 'M' });
    expect(toolOf('stroke')).toBe('pen');
    expect(toolOf('redaction')).toBe('redact');
  });

  it('F-003.AC1 F-003.R1 a drag spans the box from its start to its end, in either direction', () => {
    const a = shapeFromDrag('rectangle', 'a', red, { x: 300, y: 200 }, { x: 100, y: 100 }, false);
    expect(a).toMatchObject({ kind: 'rectangle', box: { x: 100, y: 100, width: 200, height: 100 } });
  });

  it('F-003.AC3 F-003.R2 an arrowhead on a 1000 × 800 image with stroke M is 20 px long and 15 px wide', () => {
    expect(strokePixels(red, S)).toBe(5);
    const [tip, left, right] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 5);
    expect(tip).toEqual({ x: 100, y: 0 });
    expect(left.x).toBeCloseTo(80);
    expect(right.x).toBeCloseTo(80);
    expect(Math.abs(left.y - right.y)).toBeCloseTo(15);
  });

  it('F-003.AC6 RULE-06 Shift keeps boxes square and ellipses round, side = the longer side of the drag', () => {
    expect(constrain({ x: 0, y: 0 }, { x: 200, y: 120 }, 'ellipse')).toEqual({ x: 200, y: 200 });
    expect(constrain({ x: 50, y: 50 }, { x: -70, y: 10 }, 'rectangle')).toEqual({ x: -70, y: -70 });
    expect(constrain({ x: 0, y: 0 }, { x: 20, y: 60 }, 'redaction')).toEqual({ x: 60, y: 60 });
    const circle = shapeFromDrag('ellipse', 'e', red, { x: 10, y: 10 }, { x: 210, y: 130 }, true);
    expect(circle).toMatchObject({ box: { x: 10, y: 10, width: 200, height: 200 } });
  });

  it('F-003.AC6 RULE-06 Shift snaps lines and arrows to the nearest 45° and keeps the drag length', () => {
    const p = constrain({ x: 0, y: 0 }, { x: 100, y: 80 }, 'arrow'); // 38.7° → 45°
    expect(p.x).toBeCloseTo(p.y);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(Math.hypot(100, 80));
    expect(constrain({ x: 0, y: 0 }, { x: 100, y: 20 }, 'line')).toEqual({ x: Math.hypot(100, 20), y: 0 });
    expect(constrain({ x: 0, y: 0 }, { x: -10, y: -100 }, 'arrow').x).toBeCloseTo(0);
    expect(constrain({ x: 0, y: 0 }, { x: 100, y: 20 }, 'highlight')).toEqual({ x: 100, y: 0 });
  });

  it('F-003.AC7 RULE-05 a click places a 20 % default shape centred on it (160 × 160 on 1000 × 800)', () => {
    expect(defaultAnnotationAt({ x: 500, y: 400 }, 'rectangle', S, 'r', red)).toMatchObject({
      box: { x: 420, y: 320, width: 160, height: 160 },
    });
    // Lines and arrows point right.
    expect(defaultAnnotationAt({ x: 500, y: 400 }, 'arrow', S, 'a', red)).toMatchObject({
      tail: { x: 420, y: 400 },
      head: { x: 580, y: 400 },
    });
  });

  it('ADR-0004 §3 hit tolerance is in screen pixels: 5 px selects and 8 px misses at 10 % and 800 %', () => {
    const line: Annotation = { id: 'l', kind: 'line', style: red, tail: { x: 0, y: 100 }, head: { x: 400, y: 100 } };
    const half = strokePixels(red, S) / 2;
    for (const zoom of [0.1, 8]) {
      const tol = HIT_TOLERANCE_PX / zoom;
      expect(hitTest(line, { x: 200, y: 100 + half + 5 / zoom }, tol, S)).toBe(true);
      expect(hitTest(line, { x: 200, y: 100 + half + 8 / zoom }, tol, S)).toBe(false);
    }
  });

  it('ADR-0004 §3 outlined shapes hit on their outline, filled ones inside too; arrowheads hit', () => {
    const box = { x: 100, y: 100, width: 200, height: 100 };
    const outline: Annotation = { id: 'r', kind: 'rectangle', style: red, box };
    const filled: Annotation = { ...outline, style: { ...red, fill: 'translucent' } };
    expect(hitTest(outline, { x: 200, y: 150 }, 1, S)).toBe(false);
    expect(hitTest(outline, { x: 101, y: 150 }, 1, S)).toBe(true);
    expect(hitTest(filled, { x: 200, y: 150 }, 1, S)).toBe(true);
    const ellipse: Annotation = { id: 'e', kind: 'ellipse', style: red, box };
    expect(hitTest(ellipse, { x: 100, y: 150 }, 1, S)).toBe(true);
    expect(hitTest(ellipse, { x: 102, y: 102 }, 1, S)).toBe(false);
    const arrow: Annotation = { id: 'a', kind: 'arrow', style: red, tail: { x: 0, y: 0 }, head: { x: 100, y: 0 } };
    expect(hitTest(arrow, { x: 85, y: 6 }, 0.5, S)).toBe(true); // inside the 15 px wide head
    expect(boundsOf(arrow, S).height).toBeCloseTo(15 + 5); // the head plus half the stroke on each side
  });

  it('F-008.R3 handles: eight on a box, end points on a line; Shift resize keeps the aspect ratio (RULE-06)', () => {
    const rect: Annotation = { id: 'r', kind: 'rectangle', style: red, box: { x: 0, y: 0, width: 200, height: 100 } };
    expect(handlesOf(rect)).toHaveLength(8);
    expect(hitHandle(rect, { x: 201, y: 99 }, 5)).toBe('se');
    expect(resized(rect, 'se', 100, 0, true)).toMatchObject({ box: { width: 300, height: 150 } });
    expect(moved(rect, 10, 5)).toMatchObject({ box: { x: 10, y: 5 } });
    const line: Annotation = { id: 'l', kind: 'line', style: red, tail: { x: 0, y: 0 }, head: { x: 10, y: 0 } };
    expect(handlesOf(line).map(([h]) => h)).toEqual(['tail', 'head']);
    expect(resized(line, 'head', 5, 5)).toMatchObject({ tail: { x: 0, y: 0 }, head: { x: 15, y: 5 } });
  });
});
