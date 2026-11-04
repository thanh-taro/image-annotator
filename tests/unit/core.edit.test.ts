// MOD-Core edit geometry (F-008): moving every kind, resizing with handles (boxes, end points, scaling
// paths; RULE-06 Shift), the RULE-19 Alt+arrow resize, the marquee and the position and size fields (R8).
import { describe, expect, it } from 'vitest';
import {
  altResized,
  DEFAULT_STYLES,
  geometryOf,
  handlesOf,
  marqueeHits,
  moved,
  resized,
  shapeBox,
  withGeometry,
  type Annotation,
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
const highlight = (
  points = [
    { x: 100, y: 100 },
    { x: 150, y: 120 },
    { x: 200, y: 140 },
  ],
): Annotation => ({ id: 'h', kind: 'highlight', style: DEFAULT_STYLES.highlight, points });
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
    const r = resized(arrow, 'head', 30, -20);
    expect(r).toMatchObject({ tail: { x: 10, y: 10 }, head: { x: 140, y: 40 } });
  });

  it('F-008.AC3 RULE-06 a corner handle dragged with Shift keeps a rectangle’s aspect ratio', () => {
    const r = resized(rect(), 'se', 100, 10, true);
    const b = shapeBox(r);
    expect(b.width / b.height).toBeCloseTo(2);
    expect(b).toMatchObject({ x: 100, y: 100, width: 200, height: 100 });
    // Without Shift the box follows the handle.
    expect(shapeBox(resized(rect(), 'se', 100, 10))).toMatchObject({ width: 200, height: 60 });
  });

  it('F-008.R3 a stroke or highlight is scaled by its handles: the points follow their bounding box', () => {
    const r = resized(highlight(), 'se', 100, 40);
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
    expect(handlesOf(flat).map(([h]) => h)).toEqual(['e', 'w']);
    expect(shapeBox(resized(flat, 'e', 50, 30))).toEqual({ x: 100, y: 100, width: 250, height: 0 });
    // A dot has no handles at all.
    expect(handlesOf(highlight([{ x: 5, y: 5 }]))).toEqual([]);
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
