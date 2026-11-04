// MOD-Canvas select tool (F-008): clicks, Shift+click, the marquee, moving the selection and dragging
// handles, Alt+drag with a drawing tool, and the RULE-05 4-pixel rule for every press.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, shapeBox, type Annotation, type Point, type ToolName } from '../../src/core';
import type { PointerInput } from '../../src/canvas/input';
import { SelectTool } from '../../src/canvas/select';

const rect = (id: string, x: number, y: number, width = 100, height = 50): Annotation => ({
  id,
  kind: 'rectangle',
  style: { ...DEFAULT_STYLES.rectangle, fill: 'solid' },
  box: { x, y, width, height },
});
const arrow: Annotation = {
  id: 'a',
  kind: 'arrow',
  style: DEFAULT_STYLES.arrow,
  tail: { x: 100, y: 400 },
  head: { x: 300, y: 400 },
};
const text: Annotation = { id: 't', kind: 'text', style: DEFAULT_STYLES.text, anchor: { x: 600, y: 600 }, text: 'Hi' };

/** A select tool over `annotations` at 100 % (screen = image pixels) with a mutable selection. */
function setup(annotations: Annotation[], opts: { tool?: ToolName; selection?: string[]; zoom?: number } = {}) {
  const state = { selection: opts.selection ?? [], commits: [] as Annotation[][], prepares: 0 };
  const zoom = opts.zoom ?? 1;
  const tool = new SelectTool(
    () => ({
      tool: opts.tool ?? 'select',
      annotations,
      selection: state.selection,
      shortSide: 800,
      measure: (_f, line) => line.length * 10,
      tolerance: 6 / zoom,
      handleHalf: 12 / zoom,
      toImage: (p: Point) => ({ x: p.x / zoom, y: p.y / zoom }),
    }),
    {
      select: (ids) => (state.selection = [...ids]),
      commit: (changes) => state.commits.push([...changes]),
      preview: () => {},
      prepare: () => state.prepares++,
    },
  );
  return { tool, state };
}

const at = (x: number, y: number, extra: Partial<PointerInput> = {}): PointerInput => ({
  id: 1,
  type: 'mouse',
  button: 0,
  point: { x, y },
  ...extra,
});

function drag(tool: SelectTool, from: Point, to: Point, extra: Partial<PointerInput> = {}) {
  const pressed = tool.down(at(from.x, from.y, extra));
  tool.move(at((from.x + to.x) / 2, (from.y + to.y) / 2, extra));
  tool.move(at(to.x, to.y, extra));
  tool.up(at(to.x, to.y, extra));
  return pressed;
}

describe('MOD-Canvas select tool', () => {
  it('F-008.AC1 dragging a selection box around two of three annotations selects exactly those two', () => {
    const { tool, state } = setup([rect('r1', 100, 100), rect('r2', 300, 100), rect('r3', 700, 500)]);
    drag(tool, { x: 50, y: 50 }, { x: 450, y: 200 });
    expect(state.selection).toEqual(['r1', 'r2']);
    expect(state.commits).toEqual([]);
  });

  it('F-008.R1 a click selects; Shift+click adds and removes; a click on empty canvas clears', () => {
    const { tool, state } = setup([rect('r1', 100, 100), rect('r2', 300, 100)]);
    drag(tool, { x: 120, y: 120 }, { x: 121, y: 120 });
    expect(state.selection).toEqual(['r1']);
    drag(tool, { x: 320, y: 120 }, { x: 320, y: 120 }, { shift: true });
    expect(state.selection).toEqual(['r1', 'r2']);
    drag(tool, { x: 120, y: 120 }, { x: 120, y: 120 }, { shift: true });
    expect(state.selection).toEqual(['r2']);
    drag(tool, { x: 600, y: 600 }, { x: 602, y: 601 });
    expect(state.selection).toEqual([]);
  });

  it('F-008.AC17 RULE-05 a press that moves 3 px selects and moves nothing; 10 px moves it from the press point', () => {
    const { tool, state } = setup([rect('r', 100, 100)]);
    drag(tool, { x: 150, y: 120 }, { x: 153, y: 120 });
    expect(state.selection).toEqual(['r']);
    expect(state.commits).toEqual([]);
    drag(tool, { x: 150, y: 120 }, { x: 160, y: 120 });
    expect(state.commits).toHaveLength(1);
    expect(state.commits[0]?.[0]).toMatchObject({ id: 'r', box: { x: 110, y: 100 } });
  });

  it('F-008.R2 dragging a selected annotation moves the whole selection, as one change', () => {
    const { tool, state } = setup([rect('r1', 100, 100), rect('r2', 300, 100)], { selection: ['r1', 'r2'] });
    drag(tool, { x: 150, y: 120 }, { x: 170, y: 150 });
    expect(state.commits).toHaveLength(1);
    expect(state.commits[0]?.map((a) => shapeBox(a))).toEqual([
      { x: 120, y: 130, width: 100, height: 50 },
      { x: 320, y: 130, width: 100, height: 50 },
    ]);
    expect(state.selection).toEqual(['r1', 'r2']);
  });

  it('F-008.R2 dragging an unselected annotation selects it and moves only it', () => {
    const { tool, state } = setup([rect('r1', 100, 100), rect('r2', 300, 100)], { selection: ['r1'] });
    drag(tool, { x: 350, y: 120 }, { x: 360, y: 120 });
    expect(state.selection).toEqual(['r2']);
    expect(state.commits[0]?.map((a) => a.id)).toEqual(['r2']);
  });

  it('F-008.AC2 dragging the head handle of a selected arrow moves only the head', () => {
    const { tool, state } = setup([arrow], { selection: ['a'] });
    drag(tool, { x: 300, y: 400 }, { x: 350, y: 450 });
    expect(state.commits[0]?.[0]).toMatchObject({ tail: { x: 100, y: 400 }, head: { x: 350, y: 450 } });
  });

  it('F-008.AC3 dragging a rectangle’s corner handle with Shift keeps its aspect ratio', () => {
    const { tool, state } = setup([rect('r', 100, 100, 100, 50)], { selection: ['r'] });
    drag(tool, { x: 200, y: 150 }, { x: 300, y: 160 }, { shift: true });
    const b = shapeBox(state.commits[0]?.[0] as Annotation);
    expect(b.width / b.height).toBeCloseTo(2);
  });

  it('F-008.AC11 a selected text has no handles: a press on its corner moves it instead', () => {
    const { tool, state } = setup([text], { selection: ['t'] });
    expect(tool.handleAt({ x: 600, y: 600 })).toBeUndefined();
    drag(tool, { x: 605, y: 605 }, { x: 625, y: 605 });
    expect(state.commits[0]?.[0]).toMatchObject({ anchor: { x: 620, y: 600 } });
  });

  it('F-008.AC8 F-008.R6 with a drawing tool a plain press is not the select tool’s; with Alt it moves the annotation', () => {
    const { tool, state } = setup([rect('r', 100, 100)], { tool: 'arrow' });
    expect(tool.down(at(150, 120))).toBe(false);
    tool.up(at(150, 120));
    expect(drag(tool, { x: 150, y: 120 }, { x: 250, y: 120 }, { alt: true })).toBe(true);
    expect(state.commits[0]?.[0]).toMatchObject({ box: { x: 200, y: 100 } });
    // Alt on empty canvas leaves the press to the drawing tool.
    expect(tool.down(at(600, 600, { alt: true }))).toBe(false);
  });

  it('ADR-0022 NFR-02 a press on an annotation prepares the drag layers before the 4 px threshold', () => {
    const { tool, state } = setup([rect('r', 100, 100)]);
    tool.down(at(150, 120));
    expect(state.prepares).toBe(1);
    expect(tool.pending).toEqual(['r']);
    tool.up(at(150, 120));
    expect(tool.pending).toBeNull();
  });

  it('RULE-19 Esc cancels a move: nothing is committed', () => {
    const { tool, state } = setup([rect('r', 100, 100)]);
    tool.down(at(150, 120));
    tool.move(at(200, 120));
    expect(tool.preview?.get('r')).toMatchObject({ box: { x: 150 } });
    expect(tool.cancel()).toBe(true);
    tool.up(at(200, 120));
    expect(state.commits).toEqual([]);
    expect(tool.preview).toBeNull();
  });
});
