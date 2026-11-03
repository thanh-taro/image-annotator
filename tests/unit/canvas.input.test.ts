// MOD-Canvas input controller: Space+drag, two-finger pinch and the hand-off to drawing tools (F-003).
import { describe, expect, it } from 'vitest';
import type { View } from '../../src/core';
import { InputController, type PanCursor, type PointerInput, type ToolInput } from '../../src/canvas/input';
import { ViewController } from '../../src/canvas/view';

function setup(tool: ToolInput | null = null) {
  const view = new ViewController();
  view.setArea({ width: 1200, height: 800 }, 24);
  view.setContent({ x: 0, y: 0, width: 3840, height: 2160 }, true);
  view.actualSize();
  const cursors: PanCursor[] = [];
  const input = new InputController(view, (c) => cursors.push(c), tool);
  return { view, input, cursors };
}

const at = (id: number, x: number, y: number, type = 'mouse', button = 0): PointerInput => ({
  id,
  type,
  button,
  point: { x, y },
});
const v = (c: ViewController): View => c.view as View;

function recordingTool() {
  const calls: string[] = [];
  const tool: ToolInput = {
    down: (p) => (calls.push(`down ${p.id}`), true),
    move: (p) => void calls.push(`move ${p.id}`),
    up: (p) => void calls.push(`up ${p.id}`),
  };
  return { tool, calls };
}

describe('MOD-Canvas input controller', () => {
  it('F-002.AC6 with Space held a drag pans the view and never reaches the tool', () => {
    const { tool, calls } = recordingTool();
    const { view, input, cursors } = setup(tool);
    const x0 = v(view).x;
    input.holdSpace(true);
    expect(input.cursor).toBe('ready');
    expect(input.down(at(1, 700, 400))).toBe(true);
    expect(input.cursor).toBe('active');
    input.move(at(1, 600, 400));
    input.move(at(1, 500, 380));
    input.up(at(1, 500, 380));
    expect(v(view).x).toBe(x0 - 200);
    expect(calls).toEqual([]);
    expect(cursors).toEqual(['ready', 'active', 'ready']);
    input.holdSpace(false);
    expect(input.cursor).toBe('');
  });

  it('F-002.R4 releasing Space ends the pan; later moves do nothing', () => {
    const { view, input } = setup();
    input.holdSpace(true);
    input.down(at(1, 700, 400));
    input.holdSpace(false);
    const x = v(view).x;
    input.move(at(1, 100, 400));
    expect(v(view).x).toBe(x);
  });

  it('F-002 without Space a drag goes to the tool (F-003 builds on this)', () => {
    const { tool, calls } = recordingTool();
    const { view, input } = setup(tool);
    const before = v(view);
    expect(input.down(at(1, 10, 10))).toBe(true);
    input.move(at(1, 20, 20));
    input.up(at(1, 20, 20));
    expect(calls).toEqual(['down 1', 'move 1', 'up 1']);
    expect(v(view)).toBe(before);
  });

  it('F-002.R3/R4 two touch fingers pinch-zoom; the tool loses the first finger', () => {
    const { tool, calls } = recordingTool();
    const { view, input } = setup(tool);
    input.down(at(1, 500, 400, 'touch'));
    input.down(at(2, 700, 400, 'touch'));
    input.move(at(1, 450, 400, 'touch'));
    input.move(at(2, 750, 400, 'touch'));
    expect(v(view).zoom).toBeCloseTo(150);
    input.move(at(1, 400, 400, 'touch')); // no tool move for the first finger any more
    input.up(at(1, 400, 400, 'touch'));
    input.up(at(2, 750, 400, 'touch'));
    expect(calls).toEqual(['down 1']);
  });

  it('F-002 Space with a non-primary button is not a pan', () => {
    const { input } = setup();
    input.holdSpace(true);
    expect(input.down(at(1, 0, 0, 'mouse', 2))).toBe(false);
    expect(input.cursor).toBe('ready');
  });
});
