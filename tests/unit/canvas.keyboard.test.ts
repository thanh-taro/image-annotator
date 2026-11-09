// MOD-Canvas — F-013: Tab / Shift+Tab through the annotations in drawing order (`nextIndex`) and keeping a
// selected annotation in view (`ViewController.reveal`, RULE-19 last sentence). Focus and the list itself
// are checked end to end in tests/e2e/keyboard.spec.ts.
import { describe, expect, it } from 'vitest';
import { nextIndex } from '../../src/canvas/list';
import { ViewController } from '../../src/canvas/view';
import { toScreen, type View } from '../../src/core';

const IDS = ['a', 'b', 'c'];

describe('MOD-Canvas Tab order (RULE-19, CMP-Canvas "Accessibility")', () => {
  it('RULE-19 F-013.R4 Tab from the region with nothing selected selects the first annotation; Shift+Tab leaves', () => {
    expect(nextIndex(IDS, [], null, 1)).toBe(0);
    expect(nextIndex(IDS, [], null, -1)).toBeNull();
  });

  it('RULE-19 Tab and Shift+Tab step from the focused option in drawing order and leave after the last / before the first', () => {
    expect(nextIndex(IDS, ['a'], 'a', 1)).toBe(1);
    expect(nextIndex(IDS, ['b'], 'b', 1)).toBe(2);
    expect(nextIndex(IDS, ['c'], 'c', 1)).toBeNull();
    expect(nextIndex(IDS, ['c'], 'c', -1)).toBe(1);
    expect(nextIndex(IDS, ['a'], 'a', -1)).toBeNull();
  });

  it('RULE-19 with focus on the region, Tab steps after the selection’s last annotation and Shift+Tab before its first', () => {
    expect(nextIndex(IDS, ['b', 'a'], null, 1)).toBe(2);
    expect(nextIndex(IDS, ['c', 'b'], null, -1)).toBe(0);
    expect(nextIndex(IDS, ['a', 'c'], null, 1)).toBeNull();
  });

  it('RULE-19 with no annotations Tab leaves the canvas', () => {
    expect(nextIndex([], [], null, 1)).toBeNull();
    expect(nextIndex([], [], null, -1)).toBeNull();
  });
});

describe('MOD-Canvas keeps a selected annotation in view (RULE-19)', () => {
  const AREA = { width: 400, height: 300 };
  const MARGIN = 24;
  function zoomed(): ViewController {
    const c = new ViewController();
    c.setArea(AREA, MARGIN);
    c.setContent({ x: 0, y: 0, width: 2000, height: 1600 }, true);
    c.actualSize(); // 100 %: the 2000 × 1600 canvas is much larger than the area
    return c;
  }
  const v = (c: ViewController): View => {
    if (!c.view) throw new Error('no view');
    return c.view;
  };

  it('RULE-19 an annotation already in view does not move the view', () => {
    const c = zoomed();
    const before = v(c);
    const tl = { x: AREA.width / 2 - before.x - 10, y: AREA.height / 2 - before.y - 10 };
    c.reveal({ ...tl, width: 20, height: 20 });
    expect(v(c)).toEqual(before);
  });

  it('RULE-19 an annotation outside the view is scrolled in, at the margin, keeping the zoom', () => {
    const c = zoomed();
    c.reveal({ x: 1900, y: 1500, width: 50, height: 40 });
    const after = v(c);
    expect(after.zoom).toBe(100);
    const br = toScreen(after, { x: 1950, y: 1540 });
    expect(br.x).toBeCloseTo(AREA.width - MARGIN);
    expect(br.y).toBeCloseTo(AREA.height - MARGIN);
    c.reveal({ x: 10, y: 20, width: 50, height: 40 });
    const tl = toScreen(v(c), { x: 10, y: 20 });
    expect(tl.x).toBeCloseTo(MARGIN);
    expect(tl.y).toBeCloseTo(MARGIN);
  });

  it('RULE-19 an annotation larger than the view shows its top-left corner', () => {
    const c = zoomed();
    c.reveal({ x: 1000, y: 800, width: 900, height: 700 });
    const tl = toScreen(v(c), { x: 1000, y: 800 });
    expect(tl.x).toBeCloseTo(MARGIN);
    expect(tl.y).toBeCloseTo(MARGIN);
  });
});
