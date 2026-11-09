// MOD-Canvas crop tool (F-010.R1): edges and corners resize, inside moves, outside draws a new frame;
// RULE-05 clicks change nothing; Esc cancels; only the released frame is committed (one step, RULE-11).
import { describe, expect, it } from 'vitest';
import type { Frame, Point, ToolName } from '../../src/core';
import type { PointerInput } from '../../src/canvas/input';
import { CropTool } from '../../src/canvas/crop';

const HD = { width: 1920, height: 1080 };

/** A crop tool at `zoom` (screen = image × zoom) over a mutable frame. */
function setup(opts: { frame?: Frame; tool?: ToolName; zoom?: number } = {}) {
  const state = { frame: opts.frame ?? { x: 0, y: 0, ...HD }, commits: [] as Frame[], previews: 0, prepares: 0 };
  const zoom = opts.zoom ?? 1;
  const tool = new CropTool(
    () => ({
      tool: opts.tool ?? 'crop',
      frame: state.frame,
      image: HD,
      gripHalf: 12 / zoom,
      toImage: (p: Point) => ({ x: p.x / zoom, y: p.y / zoom }),
    }),
    {
      commit: (f) => {
        state.commits.push(f);
        state.frame = f;
      },
      preview: () => state.previews++,
      prepare: () => state.prepares++,
    },
  );
  return { tool, state };
}

const at = (x: number, y: number): PointerInput => ({ id: 1, type: 'mouse', button: 0, point: { x, y } });

function drag(tool: CropTool, from: Point, to: Point) {
  const pressed = tool.down(at(from.x, from.y));
  tool.move(at((from.x + to.x) / 2, (from.y + to.y) / 2));
  tool.move(at(to.x, to.y));
  tool.up(at(to.x, to.y));
  return pressed;
}

describe('MOD-Canvas crop tool', () => {
  it('F-010.AC1 dragging the left edge 200 image pixels right gives 1720 × 1080 (at 50 %)', () => {
    const { tool, state } = setup({ zoom: 0.5 });
    expect(drag(tool, { x: 0, y: 270 }, { x: 100, y: 270 })).toBe(true);
    expect(state.commits).toEqual([{ x: 200, y: 0, width: 1720, height: 1080 }]);
  });

  it('F-010.AC6 dragging a corner towards 5 × 5 stops at 16 × 16', () => {
    const { tool, state } = setup({ frame: { x: 100, y: 100, width: 400, height: 300 } });
    drag(tool, { x: 500, y: 400 }, { x: 105, y: 105 });
    expect(state.commits.at(-1)).toEqual({ x: 100, y: 100, width: 16, height: 16 });
  });

  it('F-010.AC8 dragging inside a 1000 × 500 frame 100 image pixels right moves it and keeps its size', () => {
    const { tool, state } = setup({ frame: { x: 200, y: 200, width: 1000, height: 500 } });
    drag(tool, { x: 600, y: 400 }, { x: 700, y: 400 });
    expect(state.commits).toEqual([{ x: 300, y: 200, width: 1000, height: 500 }]);
  });

  it('F-010.R1 dragging outside the frame draws a new one', () => {
    const { tool, state } = setup({ frame: { x: 200, y: 200, width: 300, height: 300 } });
    drag(tool, { x: 900, y: 600 }, { x: 1300, y: 900 });
    expect(state.commits).toEqual([{ x: 900, y: 600, width: 400, height: 300 }]);
  });

  it('F-010.R1 while dragging, the preview follows and the frame is committed only on release', () => {
    const { tool, state } = setup();
    tool.down(at(0, 500));
    expect(state.prepares).toBe(1); // NFR-02: the drag layer is prepared at the press
    tool.move(at(50, 500));
    expect(tool.preview).toEqual({ x: 50, y: 0, width: 1870, height: 1080 });
    expect(state.commits).toEqual([]);
    tool.up(at(50, 500));
    expect(tool.preview).toBeNull();
    expect(state.commits).toHaveLength(1);
  });

  it('RULE-05 a press that moves under 4 screen pixels changes nothing', () => {
    const { tool, state } = setup({ frame: { x: 200, y: 200, width: 300, height: 300 } });
    drag(tool, { x: 900, y: 600 }, { x: 902, y: 601 });
    drag(tool, { x: 350, y: 350 }, { x: 352, y: 350 });
    expect(state.commits).toEqual([]);
  });

  it('RULE-19 Esc cancels the current drag: the frame is unchanged', () => {
    const { tool, state } = setup();
    tool.down(at(0, 500));
    tool.move(at(80, 500));
    expect(tool.cancel()).toBe(true);
    expect(tool.preview).toBeNull();
    tool.up(at(80, 500));
    expect(state.commits).toEqual([]);
    expect(tool.cancel()).toBe(false);
  });

  it('F-010 only the crop tool crops', () => {
    const { tool } = setup({ tool: 'select' });
    expect(tool.down(at(0, 500))).toBe(false);
    expect(tool.gripAt({ x: 0, y: 500 })).toBeNull();
  });

  it('CMP-Canvas the grip under the pointer (for its cursor)', () => {
    const { tool } = setup({ frame: { x: 200, y: 200, width: 300, height: 300 } });
    expect(tool.gripAt({ x: 200, y: 350 })).toBe('w');
    expect(tool.gripAt({ x: 500, y: 500 })).toBe('se');
    expect(tool.gripAt({ x: 350, y: 350 })).toBe('move');
    expect(tool.gripAt({ x: 50, y: 50 })).toBe('new');
  });

  it('F-010.AC11 D-033 dragging inside a whole-image frame draws a new 800 × 600 frame, as one step', () => {
    const { tool, state } = setup();
    expect(tool.gripAt({ x: 400, y: 300 })).toBe('new');
    drag(tool, { x: 400, y: 300 }, { x: 1200, y: 900 });
    expect(state.commits).toEqual([{ x: 400, y: 300, width: 800, height: 600 }]);
  });
});
