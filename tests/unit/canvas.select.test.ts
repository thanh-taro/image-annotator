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
  const state = {
    selection: opts.selection ?? [],
    commits: [] as Annotation[][],
    prepares: 0,
    previews: 0,
    events: [] as string[],
  };
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
      commit: (changes) => {
        state.commits.push([...changes]);
        state.events.push('commit');
      },
      preview: () => {
        state.previews++;
        state.events.push('preview');
      },
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

  it('F-008.R1 D-032 Shift + dragging a selection box adds what it touches to the current selection', () => {
    const { tool, state } = setup([rect('r1', 100, 100), rect('r2', 300, 100), rect('r3', 700, 500)], {
      selection: ['r3'],
    });
    drag(tool, { x: 250, y: 50 }, { x: 450, y: 200 }, { shift: true });
    expect(state.selection).toEqual(['r3', 'r2']);
    // Touching one already selected keeps it once.
    drag(tool, { x: 50, y: 50 }, { x: 450, y: 200 }, { shift: true });
    expect(state.selection).toEqual(['r3', 'r2', 'r1']);
    // Without Shift the box replaces the selection.
    drag(tool, { x: 50, y: 50 }, { x: 250, y: 200 });
    expect(state.selection).toEqual(['r1']);
  });

  it('F-008 edge case (review M2) a selected 100 × 20 box pressed at its centre moves; a press just outside its edge resizes', () => {
    const thin = rect('r', 0, 0, 100, 20);
    const { tool, state } = setup([thin], { selection: ['r'] });
    // (50, 10) is within 12 px of the n and s handles, but on the body: a move.
    drag(tool, { x: 50, y: 10 }, { x: 80, y: 40 });
    expect(state.commits[0]?.[0]).toMatchObject({ box: { x: 30, y: 30, width: 100, height: 20 } });
    // Just below the s edge (outside the body): the s handle.
    const { tool: t2, state: s2 } = setup([thin], { selection: ['r'] });
    expect(t2.handleAt({ x: 50, y: 31 })).toBe('s');
    drag(t2, { x: 50, y: 31 }, { x: 50, y: 51 });
    expect(s2.commits[0]?.[0]).toMatchObject({ box: { x: 0, y: 0, width: 100, height: 40 } });
    // An outline (no fill): a press inside its box is still on its body, so it moves.
    const hollow = { ...thin, style: DEFAULT_STYLES.rectangle } as Annotation;
    const { tool: t3, state: s3 } = setup([hollow], { selection: ['r'] });
    drag(t3, { x: 50, y: 10 }, { x: 60, y: 10 });
    expect(s3.commits[0]?.[0]).toMatchObject({ box: { x: 10, y: 0, width: 100, height: 20 } });
  });

  it('F-008 edge case (review M2) a short selected arrow moves from its body; a long one keeps its end handles', () => {
    const short = { ...arrow, tail: { x: 100, y: 400 }, head: { x: 130, y: 400 } } as Annotation;
    const { tool, state } = setup([short], { selection: ['a'] });
    expect(tool.handleAt({ x: 128, y: 400 })).toBeUndefined(); // on the arrow: its body
    expect(tool.handleAt({ x: 140, y: 400 })).toBe('head'); // past its end
    drag(tool, { x: 115, y: 400 }, { x: 115, y: 450 });
    expect(state.commits[0]?.[0]).toMatchObject({ tail: { x: 100, y: 450 }, head: { x: 130, y: 450 } });
    const { tool: t2 } = setup([arrow], { selection: ['a'] });
    expect(t2.handleAt({ x: 298, y: 400 })).toBe('head');
  });

  it('F-008.AC18 D-044 a thin highlight’s bottom-right handle sits at its mark’s corner and scales it, not moves it', () => {
    // s = 800: the default highlight is 30 px wide; its points rise 2 px from left to right.
    const thin: Annotation = {
      id: 'h',
      kind: 'highlight',
      style: DEFAULT_STYLES.highlight,
      points: [
        { x: 100, y: 302 },
        { x: 200, y: 301 },
        { x: 300, y: 300 },
      ],
    };
    const { tool, state } = setup([thin], { selection: ['h'] });
    // The se handle is at the drawn mark's corner (315, 317); a press on it (on its edge) is the handle's.
    expect(tool.handleAt({ x: 315, y: 317 })).toBe('se');
    expect(tool.handleAt({ x: 318, y: 320 })).toBe('se');
    // Inside the mark, the small body still moves (F-008 edge case).
    expect(tool.handleAt({ x: 310, y: 312 })).toBeUndefined();
    drag(tool, { x: 315, y: 317 }, { x: 375, y: 357 });
    const b = shapeBox(state.commits[0]?.[0] as Annotation);
    expect(b).toEqual({ x: 100, y: 300, width: 260, height: 42 });
  });

  it('F-008.R3 D-044 a selected pen stroke’s and a vertical highlight’s handles sit on their drawn mark’s edge', () => {
    const pen: Annotation = {
      id: 'p',
      kind: 'stroke',
      style: DEFAULT_STYLES.pen,
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 160 },
      ],
    };
    // The default pen is 5 px wide: its se handle is at (202.5, 162.5).
    const { tool, state } = setup([pen], { selection: ['p'] });
    expect(tool.handleAt({ x: 203, y: 163 })).toBe('se');
    drag(tool, { x: 203, y: 163 }, { x: 253, y: 183 });
    expect(shapeBox(state.commits[0]?.[0] as Annotation)).toEqual({ x: 100, y: 100, width: 150, height: 80 });
    const tall: Annotation = {
      id: 'v',
      kind: 'highlight',
      style: DEFAULT_STYLES.highlight,
      points: [
        { x: 400, y: 100 },
        { x: 400, y: 300 },
      ],
    };
    const { tool: t2, state: s2 } = setup([tall], { selection: ['v'] });
    // Only n and s, at the ends of the mark (15 px past the end points); never scaled across.
    expect(t2.handleAt({ x: 400, y: 315 })).toBe('s');
    expect(t2.handleAt({ x: 415, y: 200 })).toBeUndefined();
    drag(t2, { x: 400, y: 316 }, { x: 430, y: 356 });
    expect(shapeBox(s2.commits[0]?.[0] as Annotation)).toEqual({ x: 400, y: 100, width: 0, height: 240 });
  });

  it('F-008.R6 RULE-19 (review m5) Alt+press with the crop tool is not the select tool’s', () => {
    const { tool } = setup([rect('r', 100, 100)], { tool: 'crop' });
    expect(tool.down(at(150, 120, { alt: true }))).toBe(false);
  });

  it('ADR-0022 (review m3) a move that ends where it began still asks for a repaint, so the drag layers go', () => {
    const { tool, state } = setup([rect('r', 100, 100)], { selection: ['r'] });
    tool.down(at(150, 120));
    tool.move(at(200, 120));
    tool.move(at(150, 120));
    tool.up(at(150, 120));
    expect(state.events.slice(-2)).toEqual(['commit', 'preview']);
    expect(tool.pending).toBeNull();
  });
});
