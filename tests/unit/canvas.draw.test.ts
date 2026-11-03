// MOD-Canvas drawing tool (F-003): a pointer gesture of a shape tool becomes one shape; RULE-05 clicks,
// RULE-06 Shift, RULE-19 Esc, and the hand-off from the input controller (a pinch cancels the gesture).
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, type Annotation, type LineAnnotation, type Point, type ToolName } from '../../src/core';
import { DRAFT_ID, DrawTool, shapeKindOf } from '../../src/canvas/draw';
import { InputController, type PointerInput } from '../../src/canvas/input';
import { ViewController } from '../../src/canvas/view';

/** A view at `zoom` (fraction) with image pixel (0, 0) at screen (0, 0). */
function setup(tool: ToolName = 'rectangle', zoom = 1) {
  const created: Annotation[] = [];
  let previews = 0;
  const draw = new DrawTool(
    () => ({
      tool,
      style: DEFAULT_STYLES.rectangle,
      shortSide: 800,
      toImage: (p: Point) => ({ x: p.x / zoom, y: p.y / zoom }),
    }),
    () => previews++,
    (a) => created.push(a),
  );
  return { draw, created, previews: () => previews };
}

const at = (x: number, y: number, extra: Partial<PointerInput> = {}): PointerInput => ({
  id: 1,
  type: 'mouse',
  button: 0,
  point: { x, y },
  ...extra,
});

function drag(draw: DrawTool, from: Point, to: Point, shift = false) {
  expect(draw.down(at(from.x, from.y))).toBe(true);
  draw.move(at((from.x + to.x) / 2, (from.y + to.y) / 2, { shift }));
  draw.move(at(to.x, to.y, { shift }));
  draw.up(at(to.x, to.y, { shift }));
}

describe('MOD-Canvas drawing tool', () => {
  it('F-003.AC1 dragging (100, 100) → (300, 200) with the rectangle tool creates that box in the current style', () => {
    const { draw, created } = setup('rectangle');
    drag(draw, { x: 100, y: 100 }, { x: 300, y: 200 });
    expect(created).toEqual([
      {
        id: DRAFT_ID,
        kind: 'rectangle',
        style: DEFAULT_STYLES.rectangle,
        box: { x: 100, y: 100, width: 200, height: 100 },
      },
    ]);
  });

  it('F-003.AC1 image pixels, not screen pixels: at 50 % the same box takes a drag of half the size', () => {
    const { draw, created } = setup('rectangle', 0.5);
    drag(draw, { x: 50, y: 50 }, { x: 150, y: 100 });
    expect(created[0]).toMatchObject({ box: { x: 100, y: 100, width: 200, height: 100 } });
  });

  it('F-003.AC2 the ellipse tool creates the ellipse that fits the dragged box', () => {
    const { draw, created } = setup('ellipse');
    drag(draw, { x: 300, y: 260 }, { x: 40, y: 60 });
    expect(created[0]).toMatchObject({ kind: 'ellipse', box: { x: 40, y: 60, width: 260, height: 200 } });
  });

  it('F-003.AC3 the arrow tool creates an arrow from A with its head at B', () => {
    const { draw, created } = setup('arrow');
    drag(draw, { x: 10, y: 20 }, { x: 400, y: 300 });
    expect(created[0]).toMatchObject({ kind: 'arrow', tail: { x: 10, y: 20 }, head: { x: 400, y: 300 } });
  });

  it('F-003.AC4 the line tool creates a line (no head)', () => {
    const { draw, created } = setup('line');
    drag(draw, { x: 10, y: 20 }, { x: 400, y: 300 });
    expect(created[0]).toMatchObject({ kind: 'line', tail: { x: 10, y: 20 }, head: { x: 400, y: 300 } });
  });

  it('F-003.AC6 with Shift a 200 × 120 ellipse drag makes a 200 × 200 circle; an arrow snaps to 45°', () => {
    const e = setup('ellipse');
    drag(e.draw, { x: 100, y: 100 }, { x: 300, y: 220 }, true);
    expect(e.created[0]).toMatchObject({ box: { x: 100, y: 100, width: 200, height: 200 } });
    const a = setup('arrow');
    drag(a.draw, { x: 0, y: 0 }, { x: 300, y: 250 }, true);
    const arrow = a.created[0] as LineAnnotation;
    expect(arrow.head.x).toBeCloseTo(arrow.head.y);
  });

  it('F-003.AC7 RULE-05 a click (moving under 4 screen pixels) places a 160 × 160 rectangle centred on it', () => {
    const { draw, created, previews } = setup('rectangle', 2);
    draw.down(at(1000, 800));
    draw.move(at(1003, 800)); // 3 screen px = 1.5 image px: still a click
    draw.up(at(1003, 800));
    expect(previews()).toBe(0);
    expect(created).toEqual([
      {
        id: DRAFT_ID,
        kind: 'rectangle',
        style: DEFAULT_STYLES.rectangle,
        box: { x: 420, y: 320, width: 160, height: 160 },
      },
    ]);
  });

  it('RULE-05 once the pointer passes 4 screen pixels the gesture is a drag, even if it comes back', () => {
    const { draw, created } = setup('rectangle');
    draw.down(at(100, 100));
    draw.move(at(130, 120));
    draw.move(at(101, 101));
    draw.up(at(101, 101));
    expect(created[0]).toMatchObject({ box: { x: 100, y: 100, width: 1, height: 1 } });
  });

  it('F-003 edge case RULE-19 Esc during a drag creates nothing, and the rest of that gesture is ignored', () => {
    const { draw, created } = setup('arrow');
    draw.down(at(0, 0));
    draw.move(at(50, 50));
    expect(draw.preview).not.toBeNull();
    expect(draw.cancel()).toBe(true);
    expect(draw.preview).toBeNull();
    draw.move(at(80, 80));
    draw.up(at(80, 80));
    expect(created).toEqual([]);
    expect(draw.cancel()).toBe(false);
    // The next gesture draws normally.
    drag(draw, { x: 0, y: 0 }, { x: 40, y: 0 });
    expect(created).toHaveLength(1);
  });

  it('F-003.R6 the select tool does not draw; only the primary button starts a shape', () => {
    expect(setup('select').draw.down(at(0, 0))).toBe(false);
    expect(setup('rectangle').draw.down(at(0, 0, { button: 2 }))).toBe(false);
    expect(shapeKindOf('arrow')).toBe('arrow');
    expect(shapeKindOf('pen')).toBeNull();
    expect(shapeKindOf('crop')).toBeNull();
  });

  it('CMP-Canvas a second finger turns a one-finger drawing into a pinch: nothing is created', () => {
    const { draw, created } = setup('rectangle');
    const view = new ViewController();
    view.setArea({ width: 1200, height: 800 }, 24);
    view.setContent({ x: 0, y: 0, width: 1000, height: 800 }, true);
    const input = new InputController(view, () => {}, draw);
    input.down(at(100, 100, { id: 1, type: 'touch' }));
    input.move(at(200, 200, { id: 1, type: 'touch' }));
    input.down(at(400, 400, { id: 2, type: 'touch' }));
    input.up(at(200, 200, { id: 1, type: 'touch' }));
    input.up(at(400, 400, { id: 2, type: 'touch' }));
    expect(created).toEqual([]);
    expect(draw.active).toBe(false);
  });

  it('F-003.AC3 a scroll or zoom mid-drag maps the pointer through the view as it is now', () => {
    let zoom = 1;
    let dx = 0;
    const created: Annotation[] = [];
    const draw = new DrawTool(
      () => ({
        tool: 'arrow',
        style: DEFAULT_STYLES.arrow,
        shortSide: 800,
        toImage: (p: Point) => ({ x: (p.x - dx) / zoom, y: p.y / zoom }),
      }),
      () => {},
      (a) => created.push(a),
    );
    draw.down(at(100, 100));
    draw.move(at(200, 100));
    dx = -200; // view B: panned 200 px left (a wheel scroll)
    draw.viewChanged();
    expect((draw.preview as LineAnnotation).head).toEqual({ x: 400, y: 100 }); // still under the pointer
    zoom = 2; // and zoomed to 200 %
    draw.move(at(300, 100));
    draw.up(at(300, 100));
    expect(created[0]).toMatchObject({ tail: { x: 100, y: 100 }, head: { x: 250, y: 50 } });
  });

  it('F-003 edge case pointercancel ends a drag like Esc: nothing is created, even before the threshold', () => {
    for (const moveTo of [200, 101]) {
      const { draw, created } = setup('rectangle');
      const view = new ViewController();
      view.setArea({ width: 1200, height: 800 }, 24);
      view.setContent({ x: 0, y: 0, width: 1000, height: 800 }, true);
      const input = new InputController(view, () => {}, draw);
      input.down(at(100, 100, { type: 'pen' }));
      input.move(at(moveTo, moveTo, { type: 'pen' }));
      input.cancel(at(moveTo, moveTo, { type: 'pen' }));
      expect(created).toEqual([]);
      expect(draw.active).toBe(false);
      expect(draw.preview).toBeNull();
      // The next gesture draws normally.
      input.down(at(100, 100));
      input.move(at(300, 200));
      input.up(at(300, 200));
      expect(created).toHaveLength(1);
    }
  });

  it('F-003.AC6 RULE-06 pressing or releasing Shift mid-drag updates the preview without a move', () => {
    const { draw, created } = setup('ellipse');
    draw.down(at(100, 100));
    draw.move(at(300, 220));
    expect(draw.preview).toMatchObject({ box: { width: 200, height: 120 } });
    draw.setShift(true);
    expect(draw.preview).toMatchObject({ box: { width: 200, height: 200 } });
    draw.setShift(false);
    expect(draw.preview).toMatchObject({ box: { width: 200, height: 120 } });
    draw.setShift(true);
    draw.up(at(300, 220, { shift: true }));
    expect(created[0]).toMatchObject({ kind: 'ellipse', box: { width: 200, height: 200 } });
  });

  it('F-003 edge case a cancelled one-finger drawing leaves no touch behind: the next one-finger drag draws', () => {
    const { draw, created } = setup('rectangle');
    const view = new ViewController();
    view.setArea({ width: 1200, height: 800 }, 24);
    view.setContent({ x: 0, y: 0, width: 1000, height: 800 }, true);
    const before = view.view;
    const input = new InputController(view, () => {}, draw);
    input.down(at(100, 100, { id: 1, type: 'touch' }));
    input.move(at(200, 200, { id: 1, type: 'touch' }));
    input.cancel(at(200, 200, { id: 1, type: 'touch' }));
    expect(created).toEqual([]);
    input.down(at(100, 100, { id: 2, type: 'touch' }));
    input.move(at(300, 200, { id: 2, type: 'touch' }));
    input.up(at(300, 200, { id: 2, type: 'touch' }));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ kind: 'rectangle', box: { x: 100, y: 100, width: 200, height: 100 } });
    expect(view.view).toEqual(before); // no pan or zoom
  });
});
