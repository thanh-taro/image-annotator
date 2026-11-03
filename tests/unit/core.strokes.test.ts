// MOD-Core path geometry (F-004): pen strokes and highlights as lists of points, drawn as midpoint
// quadratics (ADR-0004 §4); RULE-04 widths, RULE-05 dots, RULE-06 straight highlights, and the
// analytic hit-testing and bounds of ADR-0004 §3 for both kinds.
import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  DEFAULT_STYLES,
  defaultAnnotationAt,
  handlesOf,
  hitTest,
  markWidth,
  pathFromDrag,
  shapeBox,
  strokePieces,
  type Annotation,
  type Point,
} from '../../src/core';

const S = 800; // the shorter side of a 1000 × 800 image: stroke M = 5, L = 10, highlight L = 30
const pen = DEFAULT_STYLES.pen;
const marker = DEFAULT_STYLES.highlight;
const zigzag: Point[] = [
  { x: 100, y: 100 },
  { x: 150, y: 200 },
  { x: 200, y: 100 },
  { x: 250, y: 200 },
  { x: 300, y: 100 },
];
const stroke = (points: Point[]): Annotation => ({ id: 's', kind: 'stroke', style: pen, points });
const highlight = (points: Point[]): Annotation => ({ id: 'h', kind: 'highlight', style: marker, points });

/** The unit tangent of a piece at its start (t = 0) or end (t = 1). */
function tangent(from: Point, control: Point, to: Point, end: boolean): Point {
  const d = end ? { x: to.x - control.x, y: to.y - control.y } : { x: control.x - from.x, y: control.y - from.y };
  const l = Math.hypot(d.x, d.y);
  return { x: d.x / l, y: d.y / l };
}

describe('MOD-Core strokes and highlights', () => {
  it('F-004.AC1 F-004.R1 a zig-zag is one smooth curve: midpoint quadratics from the first to the last point', () => {
    const pieces = strokePieces(zigzag);
    expect(pieces).toHaveLength(zigzag.length - 2);
    expect(pieces[0]?.from).toEqual(zigzag[0]);
    expect(pieces.at(-1)?.to).toEqual(zigzag.at(-1));
    // Each inner sample is a control point; the curve passes through the midpoints between samples.
    expect(pieces.map((p) => p.control)).toEqual(zigzag.slice(1, -1));
    expect(pieces[0]?.to).toEqual({ x: 175, y: 150 });
  });

  it('F-004.AC1 consecutive pieces meet with the same tangent, so no angle shows between samples', () => {
    const pieces = strokePieces(zigzag);
    for (let i = 1; i < pieces.length; i++) {
      const a = pieces[i - 1];
      const b = pieces[i];
      if (!a || !b) throw new Error('missing piece');
      expect(b.from).toEqual(a.to);
      const out = tangent(a.from, a.control, a.to, true);
      const into = tangent(b.from, b.control, b.to, false);
      expect(out.x).toBeCloseTo(into.x, 12);
      expect(out.y).toBeCloseTo(into.y, 12);
    }
  });

  it('F-004.R1 two points are one straight piece; one point is a dot (a piece of zero length)', () => {
    expect(strokePieces([zigzag[0] as Point, zigzag[1] as Point])).toEqual([
      { from: zigzag[0], control: { x: 125, y: 150 }, to: zigzag[1] },
    ]);
    expect(strokePieces([zigzag[0] as Point])).toEqual([{ from: zigzag[0], control: zigzag[0], to: zigzag[0] }]);
    expect(strokePieces([])).toEqual([]);
  });

  it('RULE-04 a pen stroke is the stroke size wide; a highlight is 3 × the stroke size of its size', () => {
    expect(markWidth(stroke(zigzag), S)).toBe(5); // M = max(3, 0.006 · 800) = 4.8 → 5
    expect(markWidth(highlight(zigzag), S)).toBe(30); // L = max(6, 0.012 · 800) = 9.6 → 10; × 3
    expect(markWidth({ ...highlight(zigzag), style: { ...marker, strokeSize: 'S' } }, S)).toBe(6); // 3 × round(max(2, 2.4))
  });

  it('F-004.R1 F-004.R4 a pen drag keeps every sampled point as it came, in order', () => {
    const a = pathFromDrag('stroke', 'd', pen, zigzag, false);
    expect(a).toEqual({ id: 'd', kind: 'stroke', style: pen, points: zigzag });
    // Shift does not constrain the pen (RULE-06 names highlights only).
    expect(pathFromDrag('stroke', 'd', pen, zigzag, true)).toEqual(a);
  });

  it('F-004.AC4 F-004.R3 RULE-06 with Shift a highlight runs from the press point straight to the pointer', () => {
    const sideways: Point[] = [
      { x: 100, y: 100 },
      { x: 180, y: 112 },
      { x: 260, y: 93 },
      { x: 400, y: 130 },
    ];
    const h = pathFromDrag('highlight', 'd', marker, sideways, true);
    expect(h).toMatchObject({
      kind: 'highlight',
      points: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
      ],
    });
    const down: Point[] = [
      { x: 100, y: 100 },
      { x: 120, y: 300 },
    ];
    expect(pathFromDrag('highlight', 'd', marker, down, true)).toMatchObject({
      points: [
        { x: 100, y: 100 },
        { x: 100, y: 300 },
      ],
    });
    // Without Shift the highlight follows the pointer.
    expect(pathFromDrag('highlight', 'd', marker, sideways, false)).toMatchObject({ points: sideways });
  });

  it('F-004.AC5 F-004.AC6 RULE-05 a click (or Enter) with the pen or highlight tool places a dot at the point', () => {
    const at = { x: 500, y: 400 };
    expect(defaultAnnotationAt(at, 'stroke', S, 'p', pen)).toEqual({
      id: 'p',
      kind: 'stroke',
      style: pen,
      points: [at],
    });
    expect(defaultAnnotationAt(at, 'highlight', S, 'h', marker)).toEqual({
      id: 'h',
      kind: 'highlight',
      style: marker,
      points: [at],
    });
  });

  it('F-008.R3 the geometry box of a path is the box of its points; its handles sit on that box', () => {
    expect(shapeBox(stroke(zigzag))).toEqual({ x: 100, y: 100, width: 200, height: 100 });
    expect(shapeBox(stroke([{ x: 7, y: 9 }]))).toEqual({ x: 7, y: 9, width: 0, height: 0 });
    expect(handlesOf(highlight(zigzag)).map(([h]) => h)).toEqual(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);
  });

  it('ADR-0004 §3 a pen stroke’s bounds are its points’ box grown by half the stroke (round caps)', () => {
    expect(boundsOf(stroke(zigzag), S)).toEqual({ x: 97.5, y: 97.5, width: 205, height: 105 });
  });

  it('ADR-0004 §3 a highlight’s bounds also cover the corners of its square ends', () => {
    const b = boundsOf(highlight(zigzag), S);
    const reach = 15 * Math.SQRT2;
    expect(b.x).toBeCloseTo(100 - reach, 9);
    expect(b.y).toBeCloseTo(100 - reach, 9);
    expect(b.width).toBeCloseTo(200 + 2 * reach, 9);
    expect(b.height).toBeCloseTo(100 + 2 * reach, 9);
  });

  it('ADR-0004 §3 CMP-Canvas a press hits the visible mark of a stroke within the tolerance, not its box', () => {
    const a = stroke(zigzag);
    // On the curve near the first sample, and on the midpoint between two samples (on the curve).
    expect(hitTest(a, { x: 101, y: 102 }, 0, S)).toBe(true);
    expect(hitTest(a, { x: 175, y: 150 }, 0, S)).toBe(true);
    // Inside the box but between the zig-zag's teeth: a miss, unless the tolerance reaches it.
    expect(hitTest(a, { x: 150, y: 120 }, 0, S)).toBe(false);
    expect(hitTest(a, { x: 200, y: 180 }, 0, S)).toBe(false);
    // Half the stroke (2.5) plus the tolerance from the midpoint (175, 150) along its normal: the curve's
    // tangent there runs from (150, 200) to (200, 100), so the normal is (2, 1) / √5.
    const n = { x: 2 / Math.sqrt(5), y: 1 / Math.sqrt(5) };
    const off = (d: number) => ({ x: 175 + n.x * d, y: 150 + n.y * d });
    expect(hitTest(a, off(2.4), 0, S)).toBe(true);
    expect(hitTest(a, off(2.6), 0, S)).toBe(false);
    expect(hitTest(a, off(8.4), 6, S)).toBe(true);
    expect(hitTest(a, off(8.6), 6, S)).toBe(false);
  });

  it('ADR-0004 §3 a highlight hits within half its wide mark; a dot hits around its point', () => {
    const h = highlight([
      { x: 100, y: 100 },
      { x: 400, y: 100 },
    ]);
    expect(hitTest(h, { x: 250, y: 114 }, 0, S)).toBe(true);
    expect(hitTest(h, { x: 250, y: 116 }, 0, S)).toBe(false);
    const dot = stroke([{ x: 50, y: 50 }]);
    expect(hitTest(dot, { x: 52, y: 51 }, 0, S)).toBe(true);
    expect(hitTest(dot, { x: 50, y: 60 }, 0, S)).toBe(false);
    expect(hitTest(dot, { x: 50, y: 60 }, 8, S)).toBe(true);
  });

  it('F-004.AC4 RULE-09 a Shift highlight that ends back at its press point is a dot, not an empty run', () => {
    const back: Point[] = [
      { x: 100, y: 100 },
      { x: 120, y: 104 },
      { x: 100, y: 100 },
    ];
    expect(pathFromDrag('highlight', 'd', marker, back, true)).toMatchObject({ points: [{ x: 100, y: 100 }] });
  });

  it('ADR-0004 §3 RULE-09 a press on the square corner of a highlight’s end or dot hits it', () => {
    const h = highlight([
      { x: 100, y: 100 },
      { x: 400, y: 100 },
    ]);
    // Half the width is 15: the square end runs to x = 85 and covers its corner (86, 114).
    expect(hitTest(h, { x: 86, y: 114 }, 0, S)).toBe(true);
    expect(hitTest(h, { x: 414, y: 86 }, 0, S)).toBe(true);
    expect(hitTest(h, { x: 84, y: 114 }, 0, S)).toBe(false);
    expect(hitTest(h, { x: 84, y: 116 }, 2, S)).toBe(true); // the tolerance grows the square
    // A diagonal highlight's end square is turned with its run.
    const d = highlight([
      { x: 100, y: 100 },
      { x: 300, y: 300 },
    ]);
    const u = Math.SQRT1_2;
    const corner = { x: 100 - 14 * u + 14 * u, y: 100 - 14 * u - 14 * u }; // back 14 along, 14 across
    expect(hitTest(d, corner, 0, S)).toBe(true);
    const dot = highlight([{ x: 50, y: 50 }]);
    expect(hitTest(dot, { x: 64, y: 36 }, 0, S)).toBe(true);
    expect(hitTest(dot, { x: 66, y: 50 }, 0, S)).toBe(false);
    // The pen's ends stay round.
    expect(hitTest(stroke([{ x: 50, y: 50 }]), { x: 52.3, y: 52.3 }, 0, S)).toBe(false);
  });
});
