// MOD-Document edit operations (F-008): update (move, resize, set fields) and reorder (bring forward,
// send backward), each one step with structural sharing and no step when nothing changes (RULE-11).
import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLES, type Annotation } from '../../src/core';
import { add, edit, reorder, startSession, update, type Doc } from '../../src/document';

const image = { width: 1000, height: 800, sourceName: null, sourceType: 'png' as const };
const rect = (id: string, x = 100): Annotation => ({
  id,
  kind: 'rectangle',
  style: DEFAULT_STYLES.rectangle,
  box: { x, y: 100, width: 50, height: 50 },
});
const step = (id: string): Annotation => ({
  id,
  kind: 'step',
  style: DEFAULT_STYLES.step,
  centre: { x: 1, y: 1 },
  number: 0,
});
const order = (d: Doc) => d.annotations.map((a) => a.id);

function session(ids: readonly string[]) {
  const s = startSession(image);
  for (const id of ids) s.history.apply(add(id.startsWith('s') ? step(id) : rect(id)), [id]);
  return s;
}

describe('MOD-Document update and reorder', () => {
  it('F-008.R2 RULE-11 update replaces one annotation’s geometry, shares the others; the same values are no step', () => {
    const s = session(['A', 'B']);
    const d = s.doc;
    const next = update('A', { box: { x: 110, y: 100, width: 50, height: 50 } })(d);
    expect(next.annotations[0]).toMatchObject({ box: { x: 110 } });
    expect(next.annotations[1]).toBe(d.annotations[1]);
    expect(Object.isFrozen(next.annotations[0])).toBe(true);
    expect(update('A', { box: { x: 100, y: 100, width: 50, height: 50 } })(d)).toBe(d);
    expect(update('nope', { box: { x: 1, y: 1, width: 1, height: 1 } })(d)).toBe(d);
  });

  it('F-008.R7 RULE-11 moving a multi-selection is one step; undo restores every annotation', () => {
    const s = session(['A', 'B']);
    const before = s.doc;
    s.history.apply(edit([rect('A', 200), rect('B', 300)]), ['A', 'B']);
    expect(s.doc.annotations.map((a) => (a.kind === 'rectangle' ? a.box.x : 0))).toEqual([200, 300]);
    expect(s.history.undo()?.doc).toBe(before);
  });

  it('F-008.AC7 sending the top of two overlapping annotations backward draws the other on top', () => {
    const s = session(['A', 'B']);
    s.history.apply(reorder(['B'], 'backward'), ['B']);
    expect(order(s.doc)).toEqual(['B', 'A']);
    // At the bottom already: no change, no step.
    const d = s.doc;
    expect(reorder(['B'], 'backward')(d)).toBe(d);
  });

  it('F-008.R5 bring forward moves each selected annotation one place up past an unselected one', () => {
    const d = session(['A', 'B', 'C', 'D']).doc;
    expect(order(reorder(['A', 'C'], 'forward')(d))).toEqual(['B', 'A', 'D', 'C']);
    expect(order(reorder(['A', 'B'], 'forward')(d))).toEqual(['C', 'A', 'B', 'D']);
    expect(order(reorder(['B', 'D'], 'backward')(d))).toEqual(['B', 'A', 'D', 'C']);
    expect(reorder(['D'], 'forward')(d)).toBe(d);
  });

  it('RULE-07 reordering steps keeps their numbers (creation order, not drawing order)', () => {
    const d = session(['s1', 's2']).doc;
    const next = reorder(['s2'], 'backward')(d);
    expect(next.annotations.map((a) => (a.kind === 'step' ? `${a.id}:${a.number}` : ''))).toEqual(['s2:2', 's1:1']);
  });
});
