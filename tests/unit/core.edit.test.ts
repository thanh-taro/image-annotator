// MOD-Core edit geometry (F-008): moving every kind, resizing with handles (boxes, end points, scaling
// paths; RULE-06 Shift), the RULE-19 Alt+arrow resize, the marquee and the position and size fields (R8).
import { describe, expect, it } from 'vitest';
import {
  altResized,
  DEFAULT_STYLES,
  withFill,
  geometryOf,
  handleBox,
  handlesOf,
  marqueeHits,
  moved,
  resized,
  shapeBox,
  withGeometry,
  type Annotation,
  type LineAnnotation,
} from '../../src/core';

const measure = (_font: string, line: string) => line.length * 10;
const rect = (id = 'r', x = 100, y = 100, width = 100, height = 50): Annotation => ({
  id,
  kind: 'rectangle',
  style: DEFAULT_STYLES.rectangle,
  box: { x, y, width, height },
});
const arrow: Annotation = {
  id: 'a',
  kind: 'arrow',
  style: DEFAULT_STYLES.arrow,
  tail: { x: 10, y: 10 },
  head: { x: 110, y: 60 },
};
const line: Annotation = { ...arrow, id: 'l', kind: 'line' } as Annotation;
const pathPoints = [
  { x: 100, y: 100 },
  { x: 150, y: 120 },
  { x: 200, y: 140 },
] as const;
const highlight = (points: readonly { x: number; y: number }[] = pathPoints): Annotation => ({
  id: 'h',
  kind: 'highlight',
  style: DEFAULT_STYLES.highlight,
  points,
});
const text: Annotation = { id: 't', kind: 'text', style: DEFAULT_STYLES.text, anchor: { x: 40, y: 50 }, text: 'Hi' };
const step: Annotation = { id: 's', kind: 'step', style: DEFAULT_STYLES.step, centre: { x: 300, y: 300 }, number: 1 };

describe('MOD-Core edit geometry', () => {
  it('F-008.R2 every kind moves by (dx, dy), strokes and highlights by every point', () => {
    expect(moved(highlight(), 10, -5)).toMatchObject({
      points: [
        { x: 110, y: 95 },
        { x: 160, y: 115 },
        { x: 210, y: 135 },
      ],
    });
    expect(moved(rect(), 10, 0)).toMatchObject({ box: { x: 110, y: 100 } });
    expect(moved(step, 1, 1)).toMatchObject({ centre: { x: 301, y: 301 } });
  });

  it('F-008.AC2 dragging an arrow’s head handle moves only the head; the tail stays', () => {
    const r = resized(arrow, 'head', 30, -20, 800);
    expect(r).toMatchObject({ tail: { x: 10, y: 10 }, head: { x: 140, y: 40 } });
  });

  it('F-008.AC3 RULE-06 a corner handle dragged with Shift keeps a rectangle’s aspect ratio', () => {
    const r = resized(rect(), 'se', 100, 10, 800, true);
    const b = shapeBox(r);
    expect(b.width / b.height).toBeCloseTo(2);
    expect(b).toMatchObject({ x: 100, y: 100, width: 200, height: 100 });
    // Without Shift the box follows the handle.
    expect(shapeBox(resized(rect(), 'se', 100, 10, 800))).toMatchObject({ width: 200, height: 60 });
  });

  it('F-008.R3 a stroke or highlight is scaled by its handles: the points follow their bounding box', () => {
    const r = resized(highlight(), 'se', 100, 40, 800);
    expect(shapeBox(r)).toEqual({ x: 100, y: 100, width: 200, height: 80 });
    expect(r).toMatchObject({
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 140 },
        { x: 300, y: 180 },
      ],
    });
  });

  it('F-008.R3 a straight highlight (zero-height box) has only its side handles; its height cannot be scaled', () => {
    const flat = highlight([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ]);
    expect(handlesOf(flat, 800).map(([h]) => h)).toEqual(['e', 'w']);
    expect(shapeBox(resized(flat, 'e', 50, 30, 800))).toEqual({ x: 100, y: 100, width: 250, height: 0 });
    // A dot has no handles at all.
    expect(handlesOf(highlight([{ x: 5, y: 5 }]), 800)).toEqual([]);
  });

  it('F-008.R3 D-044 F-008 edge case a straight highlight’s handles sit at the ends of its drawn mark', () => {
    // s = 800: the default highlight is 30 px wide, so its mark reaches 15 px past each end point.
    const flat = highlight([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ]);
    expect(handlesOf(flat, 800)).toEqual([
      ['e', { x: 315, y: 100 }],
      ['w', { x: 85, y: 100 }],
    ]);
    const tall = highlight([
      { x: 100, y: 100 },
      { x: 100, y: 300 },
    ]);
    expect(handlesOf(tall, 800)).toEqual([
      ['n', { x: 100, y: 85 }],
      ['s', { x: 100, y: 315 }],
    ]);
    // Never scaled across it: the s handle dragged sideways only lengthens it.
    expect(shapeBox(resized(tall, 's', 40, 20, 800))).toEqual({ x: 100, y: 100, width: 0, height: 220 });
  });

  it('F-008.R3 D-044 a stroke’s or highlight’s handles sit on its points’ box grown by half its line width', () => {
    expect(handleBox(highlight(), 800)).toEqual({ x: 85, y: 85, width: 130, height: 70 });
    const pen = { id: 'p', kind: 'stroke', style: DEFAULT_STYLES.pen, points: [...pathPoints] } as Annotation;
    // The default pen is 5 px wide on s = 800.
    expect(handleBox(pen, 800)).toEqual({ x: 97.5, y: 97.5, width: 105, height: 45 });
    expect(Object.fromEntries(handlesOf(pen, 800))).toMatchObject({
      nw: { x: 97.5, y: 97.5 },
      se: { x: 202.5, y: 142.5 },
    });
    // A box annotation's handles stay on its box.
    expect(handleBox(rect(), 800)).toEqual(shapeBox(rect()));
  });

  it('F-008.AC18 F-008.R3 D-044 a thin highlight’s se handle dragged scales its points; the line width stays', () => {
    const thin = highlight([
      { x: 100, y: 102 },
      { x: 200, y: 101 },
      { x: 300, y: 100 },
    ]);
    const r = resized(thin, 'se', 60, 40, 800);
    expect(r.style).toBe(thin.style);
    // The mark box's se corner follows the drag, so the points' box grows by the same amount.
    expect(shapeBox(r)).toEqual({ x: 100, y: 100, width: 260, height: 42 });
    expect(handleBox(r, 800)).toEqual({ x: 85, y: 85, width: 290, height: 72 });
  });

  it('F-008.R3 D-044 a mark box dragged past its opposite edge flips the points; until then they stop 1 px short', () => {
    // highlight(): points 100–200 wide, mark 85–215. Dragging e by −120 puts the mark's e edge at 95,
    // still right of its w edge (85): the points stop 1 px short of flipping (MIN_EDIT_SIZE).
    expect(shapeBox(resized(highlight(), 'e', -120, 0, 800))).toMatchObject({ x: 100, width: 1 });
    // By −200 the mark's e edge is at 15, past its w edge: the flipped mark is 15–115, its points 30–100.
    const flipped = resized(highlight(), 'e', -200, 0, 800);
    expect(shapeBox(flipped)).toMatchObject({ x: 30, width: 70 });
    expect(handleBox(flipped, 800)).toMatchObject({ x: 15, width: 100 });
  });

  it('F-008.AC10 RULE-19 Alt+Right makes a 100 × 50 rectangle 101 × 50 with its top-left kept; text does nothing', () => {
    expect(shapeBox(altResized(rect(), 1, 0))).toEqual({ x: 100, y: 100, width: 101, height: 50 });
    expect(shapeBox(altResized(rect('r', 0, 0, 1, 1), -10, -10))).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(altResized(text, 1, 0)).toBe(text);
    expect(altResized(step, 1, 0)).toBe(step);
    // A line or arrow: its head moves; a highlight: its bounding box scales from the top-left corner.
    expect(altResized(arrow, 10, 0)).toMatchObject({ tail: { x: 10, y: 10 }, head: { x: 120, y: 60 } });
    expect(shapeBox(altResized(highlight(), 100, 0))).toEqual({ x: 100, y: 100, width: 200, height: 40 });
  });

  it('F-008.AC1 a marquee selects every annotation whose mark it touches', () => {
    const list = [rect('r1', 100, 100), rect('r2', 400, 100), rect('r3', 800, 600)];
    expect(marqueeHits(list, { x: 50, y: 50, width: 400, height: 100 }, 800, measure)).toEqual(['r1', 'r2']);
    // Dragged from bottom-right to top-left: the same box.
    expect(marqueeHits(list, { x: 450, y: 150, width: -400, height: -100 }, 800, measure)).toEqual(['r1', 'r2']);
    expect(marqueeHits(list, { x: 600, y: 300, width: 10, height: 10 }, 800, measure)).toEqual([]);
  });

  it('F-008.R8 position and size fields by kind: box X Y W H; line start and end; text and step X Y', () => {
    expect(geometryOf(rect())).toEqual([
      ['x', 100],
      ['y', 100],
      ['width', 100],
      ['height', 50],
    ]);
    expect(geometryOf(line).map(([f]) => f)).toEqual(['startX', 'startY', 'endX', 'endY']);
    expect(geometryOf(text)).toEqual([
      ['x', 40],
      ['y', 50],
    ]);
    expect(geometryOf(highlight())).toEqual([
      ['x', 100],
      ['y', 100],
      ['width', 100],
      ['height', 40],
    ]);
  });

  it('F-008.AC14 a step shows X and Y of its centre, and no width or height', () => {
    expect(geometryOf(step)).toEqual([
      ['x', 300],
      ['y', 300],
    ]);
  });

  it('F-008.AC12 setting a rectangle’s width to 200 makes it 200 wide, top-left kept; never below 1', () => {
    expect(shapeBox(withGeometry(rect(), 'width', 200))).toEqual({ x: 100, y: 100, width: 200, height: 50 });
    expect(shapeBox(withGeometry(rect(), 'width', 0))).toMatchObject({ width: 1 });
    expect(shapeBox(withGeometry(rect(), 'x', -20))).toMatchObject({ x: -20, width: 100 });
  });

  it('F-008.AC13 setting a line’s start X and Y moves its tail; the head stays', () => {
    const r = withGeometry(withGeometry(line, 'startX', 400), 'startY', 300);
    expect(r).toMatchObject({ tail: { x: 400, y: 300 }, head: { x: 110, y: 60 } });
  });

  it('F-008.AC15 setting a 100 × 40 highlight’s width to 200 scales its points to a 200 × 40 box, top-left kept', () => {
    const r = withGeometry(highlight(), 'width', 200);
    expect(shapeBox(r)).toEqual({ x: 100, y: 100, width: 200, height: 40 });
    expect(r).toMatchObject({
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 120 },
        { x: 300, y: 140 },
      ],
    });
  });

  it('F-008.R8 text moves by its anchor and a step by its centre', () => {
    expect(withGeometry(text, 'x', 7)).toMatchObject({ anchor: { x: 7, y: 50 } });
    expect(withGeometry(step, 'y', 9)).toMatchObject({ centre: { x: 300, y: 9 } });
  });
});

describe('MOD-Core edit geometry — F-008 review round 1', () => {
  it('F-008.R1 MOD-Core marqueeHits tests the drawn shape: a box in the empty corner of a diagonal arrow’s bounds misses it', () => {
    const long = { ...arrow, tail: { x: 0, y: 0 }, head: { x: 400, y: 400 } } as Annotation;
    // The bounds are 0…400 on both axes; the box at the lower-left corner is far from the segment.
    expect(marqueeHits([long], { x: 10, y: 330, width: 40, height: 40 }, 800, measure)).toEqual([]);
    // A box across the segment selects it.
    expect(marqueeHits([long], { x: 190, y: 180, width: 20, height: 40 }, 800, measure)).toEqual(['a']);
    // A box only over the arrowhead selects it.
    expect(marqueeHits([long], { x: 396, y: 396, width: 2, height: 2 }, 800, measure)).toEqual(['a']);
  });

  it('F-008.R1 MOD-Core marqueeHits: an outline is not touched by a box wholly inside it; a filled box is', () => {
    const outline = rect('o', 100, 100, 300, 300);
    const filled = {
      ...rect('f', 100, 100, 300, 300),
      style: withFill(DEFAULT_STYLES.rectangle, 'solid'),
    } as Annotation;
    const inside = { x: 200, y: 200, width: 50, height: 50 };
    expect(marqueeHits([outline, filled], inside, 800, measure)).toEqual(['f']);
    expect(marqueeHits([outline], { x: 390, y: 200, width: 50, height: 50 }, 800, measure)).toEqual(['o']);
    const ellipse = { ...outline, id: 'e', kind: 'ellipse' } as Annotation;
    expect(marqueeHits([ellipse], inside, 800, measure)).toEqual([]);
    // The corner of the ellipse's bounds lies outside the ellipse itself.
    expect(marqueeHits([ellipse], { x: 100, y: 100, width: 20, height: 20 }, 800, measure)).toEqual([]);
    expect(marqueeHits([ellipse], { x: 390, y: 240, width: 20, height: 20 }, 800, measure)).toEqual(['e']);
  });

  it('F-008.R1 MOD-Core marqueeHits follows a stroke’s curve, not its bounds', () => {
    const h = highlight([
      { x: 0, y: 0 },
      { x: 200, y: 200 },
    ]);
    expect(marqueeHits([h], { x: 150, y: 0, width: 40, height: 40 }, 800, measure)).toEqual([]);
    expect(marqueeHits([h], { x: 90, y: 90, width: 20, height: 20 }, 800, measure)).toEqual(['h']);
  });

  it('F-008 review m1 CMP-StylePanel a handle drag never makes a box smaller than 1 × 1, and a scaled stroke can be widened again', () => {
    // Dragging the e handle exactly onto the w edge stops 1 pixel short.
    expect(resized(rect(), 'e', -100, 0, 800)).toMatchObject({ box: { x: 100, width: 1, height: 50 } });
    // Past it, the box flips: still at least 1 wide.
    expect(resized(rect(), 'e', -100.5, 0, 800)).toMatchObject({ box: { width: 1 } });
    const s = resized(highlight(), 'e', -100, 0, 800);
    expect(shapeBox(s).width).toBe(1);
    expect(handlesOf(s, 800).map(([h]) => h)).toContain('e');
    expect(shapeBox(resized(s, 'e', 99, 0, 800)).width).toBe(100);
  });

  it('F-008.R3 RULE-06 Shift on an edge handle scales the other axis by the same factor about its centre', () => {
    // 100 × 50 at (100, 100): e by +100 doubles the width; the height doubles about y = 125.
    expect(resized(rect(), 'e', 100, 0, 800, true)).toMatchObject({ box: { x: 100, y: 75, width: 200, height: 100 } });
    expect(resized(rect(), 's', 0, 50, 800, true)).toMatchObject({ box: { x: 50, y: 100, width: 200, height: 100 } });
  });

  it('F-008.R3 RULE-06 Shift on a line’s end handle snaps it to 45° steps about the other end', () => {
    // Tail (10, 10), head (110, 60) dragged to (110, 100): nearest 45°.
    const r = resized(line, 'head', 0, 40, 800, true) as LineAnnotation;
    expect(r.tail).toEqual({ x: 10, y: 10 });
    expect(r.head.x - 10).toBeCloseTo(r.head.y - 10, 6);
    const t = resized(arrow, 'tail', 0, 45, 800, true) as LineAnnotation;
    expect(t.head).toEqual({ x: 110, y: 60 });
    expect(t.tail.y).toBeCloseTo(60, 6); // horizontal: closer to 0° than 45°
  });
});
