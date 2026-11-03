// MOD-Canvas step tool (F-006): each click places a step centred on it; nothing is drawn by dragging;
// Esc cancels; until the fonts are ready (ADR-0009 §4) the canvas accepts no drawing.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, type Annotation, type Point, type ToolName } from '../../src/core';
import { DRAFT_ID, DrawTool, placeKindOf } from '../../src/canvas/draw';
import { FontGate } from '../../src/canvas/fonts';
import type { PointerInput } from '../../src/canvas/input';

function setup(tool: ToolName = 'step', ready = () => true) {
  const created: Annotation[] = [];
  let prepared = 0;
  const draw = new DrawTool(
    () =>
      ready()
        ? { tool, style: DEFAULT_STYLES.step, shortSide: 800, toImage: (p: Point) => ({ x: p.x / 2, y: p.y / 2 }) }
        : null,
    () => {},
    (a) => created.push(a),
    () => prepared++,
  );
  return { draw, created, prepared: () => prepared };
}

const at = (x: number, y: number): PointerInput => ({ id: 1, type: 'mouse', button: 0, point: { x, y } });

describe('MOD-Canvas step tool', () => {
  it('F-006.AC1 F-006.R1 each click with the step tool places a step centred on it, in click order', () => {
    const { draw, created } = setup();
    for (const [x, y] of [
      [100, 100],
      [300, 120],
      [200, 400],
    ] as const) {
      expect(draw.down(at(x, y))).toBe(true);
      draw.up(at(x, y));
    }
    expect(created).toEqual([
      { id: DRAFT_ID, kind: 'step', style: DEFAULT_STYLES.step, centre: { x: 50, y: 50 }, number: 0 },
      { id: DRAFT_ID, kind: 'step', style: DEFAULT_STYLES.step, centre: { x: 150, y: 60 }, number: 0 },
      { id: DRAFT_ID, kind: 'step', style: DEFAULT_STYLES.step, centre: { x: 100, y: 200 }, number: 0 },
    ]);
  });

  it('F-006.R1 a press that moves before release still places one step, at the press point, with no preview', () => {
    const { draw, created, prepared } = setup();
    draw.down(at(100, 100));
    draw.move(at(160, 180));
    expect(draw.preview).toBeNull();
    draw.up(at(160, 180));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ centre: { x: 50, y: 50 } });
    expect(prepared()).toBe(0); // no drag layers for a step
  });

  it('RULE-19 Esc while the step tool is pressed places nothing', () => {
    const { draw, created } = setup();
    draw.down(at(100, 100));
    expect(draw.cancel()).toBe(true);
    draw.up(at(100, 100));
    expect(created).toEqual([]);
  });

  it('RULE-19 F-006.R4 Enter places the step tool’s default annotation (placeKindOf)', () => {
    expect(placeKindOf('step')).toBe('step');
    expect(placeKindOf('rectangle')).toBe('rectangle');
    expect(placeKindOf('pen')).toBe('stroke');
    expect(placeKindOf('select')).toBeNull();
    expect(placeKindOf('crop')).toBeNull();
  });

  it('ADR-0009 §4 the canvas accepts drawing only once the fonts are ready', async () => {
    let resolve = () => {};
    const gate = new FontGate(new Promise<void>((r) => (resolve = r)));
    let changes = 0;
    gate.onReady(() => changes++);
    const { draw, created } = setup('step', () => gate.ready);
    expect(draw.down(at(10, 10))).toBe(false);
    resolve();
    await gate.settled;
    expect(gate.ready).toBe(true);
    expect(changes).toBe(1);
    expect(draw.down(at(10, 10))).toBe(true);
    draw.up(at(10, 10));
    expect(created).toHaveLength(1);
  });

  it('ADR-0009 §4 a font load that fails still opens the canvas (fallback face) rather than blocking it', async () => {
    const gate = new FontGate(Promise.reject(new Error('no font')));
    await gate.settled;
    expect(gate.ready).toBe(true);
  });
});
