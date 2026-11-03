// MOD-Canvas drawing tool with the pen and highlight tools (F-004): one gesture becomes one path
// annotation holding the pointer's sampled points (coalesced events included); RULE-05 dots, RULE-06
// Shift for highlights, RULE-19 Esc, view changes mid-drag, and a second finger cancelling the stroke.
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, type Annotation, type Point, type ToolName } from '../../src/core';
import { DRAFT_ID, DrawTool, drawKindOf } from '../../src/canvas/draw';
import { InputController, type PointerInput } from '../../src/canvas/input';
import { ViewController } from '../../src/canvas/view';

type Path = Extract<Annotation, { points: readonly Point[] }>;

function setup(tool: ToolName = 'pen', zoom = 1) {
  const created: Annotation[] = [];
  let previews = 0;
  let pan = 0;
  const draw = new DrawTool(
    () => ({
      tool,
      style: tool === 'highlight' ? DEFAULT_STYLES.highlight : DEFAULT_STYLES.pen,
      shortSide: 800,
      toImage: (p: Point) => ({ x: (p.x - pan) / zoom, y: p.y / zoom }),
    }),
    () => previews++,
    (a) => created.push(a),
  );
  return { draw, created, previews: () => previews, panBy: (dx: number) => (pan += dx) };
}

const at = (x: number, y: number, extra: Partial<PointerInput> = {}): PointerInput => ({
  id: 1,
  type: 'mouse',
  button: 0,
  point: { x, y },
  ...extra,
});

const pointsOf = (a: Annotation | null | undefined) => (a as Path | null | undefined)?.points;

describe('MOD-Canvas pen and highlight tools', () => {
  it('F-004.AC1 F-004.R1 F-004.R4 a zig-zag drag with the pen is one stroke through every sampled point', () => {
    const { draw, created } = setup('pen');
    const zigzag = [
      [100, 100],
      [150, 200],
      [200, 100],
      [250, 200],
      [300, 100],
    ] as const;
    draw.down(at(...zigzag[0]));
    for (const [x, y] of zigzag.slice(1)) draw.move(at(x, y));
    draw.up(at(...zigzag[4]));
    expect(created).toEqual([
      {
        id: DRAFT_ID,
        kind: 'stroke',
        style: DEFAULT_STYLES.pen,
        points: zigzag.map(([x, y]) => ({ x, y })),
      },
    ]);
  });

  it('F-004.R1 the coalesced samples of each move are kept, in order, in image pixels', () => {
    const { draw, created } = setup('pen', 2);
    draw.down(at(100, 100));
    // One pointermove that carries three coalesced samples (getCoalescedEvents), the last being its own.
    draw.move(
      at(130, 100, {
        samples: [
          { x: 110, y: 100 },
          { x: 120, y: 104 },
          { x: 130, y: 100 },
        ],
      }),
    );
    draw.up(at(130, 100));
    expect(pointsOf(created[0])).toEqual([
      { x: 50, y: 50 },
      { x: 55, y: 50 },
      { x: 60, y: 52 },
      { x: 65, y: 50 },
    ]);
  });

  it('F-004.R1 the path includes the samples before the 4 px threshold; repeated samples are not stored twice', () => {
    const { draw, created } = setup('pen');
    draw.down(at(100, 100));
    draw.move(at(102, 100)); // under the threshold: no preview yet, but the sample is part of the path
    expect(draw.preview).toBeNull();
    draw.move(at(110, 100));
    expect(pointsOf(draw.preview)).toEqual([
      { x: 100, y: 100 },
      { x: 102, y: 100 },
      { x: 110, y: 100 },
    ]);
    draw.move(at(110, 100));
    draw.up(at(110, 100));
    expect(pointsOf(created[0])).toHaveLength(3);
  });

  it('F-004.AC2 F-004.R2 the highlight tool draws a highlight in its current style (yellow, L)', () => {
    const { draw, created } = setup('highlight');
    draw.down(at(100, 100));
    draw.move(at(200, 104));
    draw.move(at(300, 98));
    draw.up(at(300, 98));
    expect(created[0]).toMatchObject({ kind: 'highlight', style: { color: 'yellow', strokeSize: 'L' } });
    expect(pointsOf(created[0])).toHaveLength(3);
  });

  it('F-004.AC3 dragging back over the same spot keeps one highlight annotation with the whole path', () => {
    const { draw, created } = setup('highlight');
    draw.down(at(100, 100));
    draw.move(at(300, 100));
    draw.move(at(150, 100));
    draw.up(at(150, 100));
    expect(created).toHaveLength(1);
    expect(pointsOf(created[0])).toEqual([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 150, y: 100 },
    ]);
  });

  it('F-004.AC4 F-004.R3 RULE-06 with Shift a mostly sideways highlight is perfectly horizontal', () => {
    const { draw, created } = setup('highlight');
    draw.down(at(100, 100, { shift: true }));
    draw.move(at(180, 112, { shift: true }));
    draw.move(at(260, 93, { shift: true }));
    draw.move(at(400, 130, { shift: true }));
    draw.up(at(400, 130, { shift: true }));
    expect(pointsOf(created[0])).toEqual([
      { x: 100, y: 100 },
      { x: 400, y: 100 },
    ]);
  });

  it('F-004.R3 RULE-06 pressing Shift mid-drag straightens the preview at once; releasing it brings the path back', () => {
    const { draw, created } = setup('highlight');
    draw.down(at(100, 100));
    draw.move(at(200, 120));
    draw.move(at(300, 110));
    draw.setShift(true);
    expect(pointsOf(draw.preview)).toEqual([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ]);
    draw.setShift(false);
    expect(pointsOf(draw.preview)).toHaveLength(3);
    draw.up(at(300, 110));
    expect(pointsOf(created[0])).toHaveLength(3);
  });

  it('RULE-06 Shift does not constrain the pen', () => {
    const { draw, created } = setup('pen');
    draw.down(at(100, 100, { shift: true }));
    draw.move(at(200, 150, { shift: true }));
    draw.move(at(300, 120, { shift: true }));
    draw.up(at(300, 120, { shift: true }));
    expect(pointsOf(created[0])).toHaveLength(3);
  });

  it('F-004.AC5 RULE-05 a pen click (under 4 screen pixels) places a dot of the stroke size at the press point', () => {
    const { draw, created, previews } = setup('pen', 2);
    draw.down(at(1000, 800));
    draw.move(at(1003, 801));
    draw.up(at(1003, 801));
    expect(previews()).toBe(0);
    expect(created).toEqual([
      { id: DRAFT_ID, kind: 'stroke', style: DEFAULT_STYLES.pen, points: [{ x: 500, y: 400 }] },
    ]);
  });

  it('RULE-05 a highlight click places a highlight dot', () => {
    const { draw, created } = setup('highlight');
    draw.down(at(40, 50));
    draw.up(at(41, 50));
    expect(created).toEqual([
      { id: DRAFT_ID, kind: 'highlight', style: DEFAULT_STYLES.highlight, points: [{ x: 40, y: 50 }] },
    ]);
  });

  it('RULE-19 Esc during a stroke creates nothing', () => {
    const { draw, created } = setup('pen');
    draw.down(at(0, 0));
    draw.move(at(50, 50));
    expect(draw.preview).not.toBeNull();
    expect(draw.cancel()).toBe(true);
    draw.move(at(80, 80));
    draw.up(at(80, 80));
    expect(created).toEqual([]);
  });

  it('F-004.R1 a scroll mid-stroke adds the point now under the pointer, so the stroke stays under it', () => {
    const { draw, created, panBy } = setup('pen');
    draw.down(at(100, 100));
    draw.move(at(200, 100));
    panBy(-50); // the view scrolls 50 px left under a still pointer
    draw.viewChanged();
    expect(pointsOf(draw.preview)?.at(-1)).toEqual({ x: 250, y: 100 });
    draw.up(at(200, 100));
    expect(pointsOf(created[0])).toEqual([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 250, y: 100 },
    ]);
  });

  it('F-004 edge case a second finger cancels the stroke and pinches instead', () => {
    const { draw, created } = setup('pen');
    const view = new ViewController();
    view.setArea({ width: 1200, height: 800 }, 24);
    view.setContent({ x: 0, y: 0, width: 1000, height: 800 }, true);
    const input = new InputController(view, () => {}, draw);
    input.down(at(100, 100, { id: 1, type: 'touch' }));
    input.move(at(200, 200, { id: 1, type: 'touch' }));
    expect(draw.preview).not.toBeNull();
    input.down(at(400, 400, { id: 2, type: 'touch' }));
    expect(draw.preview).toBeNull();
    input.up(at(200, 200, { id: 1, type: 'touch' }));
    input.up(at(400, 400, { id: 2, type: 'touch' }));
    expect(created).toEqual([]);
    // One finger draws again afterwards.
    input.down(at(100, 100, { id: 3, type: 'touch' }));
    input.move(at(200, 120, { id: 3, type: 'touch' }));
    input.up(at(200, 120, { id: 3, type: 'touch' }));
    expect(created[0]).toMatchObject({ kind: 'stroke' });
  });

  it('F-004.R1 F-004.R2 the pen and highlight tools draw strokes and highlights; select draws nothing', () => {
    expect(drawKindOf('pen')).toBe('stroke');
    expect(drawKindOf('highlight')).toBe('highlight');
    expect(drawKindOf('rectangle')).toBe('rectangle');
    expect(drawKindOf('select')).toBeNull();
    expect(drawKindOf('crop')).toBeNull();
  });
});
