// MOD-Core steps (F-006, RULE-04, RULE-07): numbering, renumbering after a delete, badge geometry,
// hit-testing and the selection box. Pure; pixels are checked end to end in tests/e2e/steps.spec.ts.
import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  DEFAULT_STYLES,
  handlesOf,
  hitTest,
  moved,
  nextStepNumber,
  renumberSteps,
  stepAt,
  stepBadge,
  stepPillWidth,
  type Annotation,
  type StepAnnotation,
} from '../../src/core';

/** These kinds need no text measuring (only text does, ADR-0020). */
const noMeasure = (): number => 0;

const style = DEFAULT_STYLES.step;
const step = (id: string, number: number, x = 100, y = 100): StepAnnotation => ({
  id,
  kind: 'step',
  style,
  centre: { x, y },
  number,
});
const rect: Annotation = {
  id: 'r',
  kind: 'rectangle',
  style: DEFAULT_STYLES.rectangle,
  box: { x: 0, y: 0, width: 10, height: 10 },
};
const numbers = (list: readonly Annotation[]) => list.flatMap((a) => (a.kind === 'step' ? [a.number] : []));

describe('MOD-Core steps', () => {
  it('RULE-07 F-006.R1 the first step is 1 and each next step is one more than the highest', () => {
    expect(nextStepNumber([])).toBe(1);
    expect(nextStepNumber([rect])).toBe(1);
    expect(nextStepNumber([step('a', 1), rect, step('b', 2)])).toBe(3);
  });

  it('RULE-07 F-006.R2 renumbering after a delete keeps creation order and closes the gap', () => {
    const out = renumberSteps([step('a', 1), rect, step('c', 3), step('d', 4)]);
    expect(numbers(out)).toEqual([1, 2, 3]);
    expect(out.map((a) => a.id)).toEqual(['a', 'r', 'c', 'd']);
  });

  it('RULE-07 numbers follow creation order, not drawing order (reordering never renumbers)', () => {
    // Drawing order c, a, b after a bring-forward / send-backward; creation order a(1), b(2), c(3).
    const reordered = [step('c', 3), step('a', 1), step('b', 2)];
    expect(renumberSteps(reordered)).toBe(reordered);
    // With a gap (b deleted): c is still the later one.
    expect(numbers(renumberSteps([step('c', 3), step('a', 1)]))).toEqual([2, 1]);
  });

  it('RULE-07 renumbering changes nothing when the numbers are already 1…n (same array, shared objects)', () => {
    const list = [step('a', 1), rect, step('b', 2)];
    expect(renumberSteps(list)).toBe(list);
    const first = step('a', 1);
    const fixed = renumberSteps([first, step('b', 3)]);
    expect(fixed[0]).toBe(first); // unchanged steps are shared
    expect(numbers(fixed)).toEqual([1, 2]);
  });

  it('F-006.AC5 RULE-04 on a 1000 × 800 image a step of size M is 64 pixels across', () => {
    const badge = stepBadge(step('a', 1), 800);
    expect(badge.textSize).toBe(32);
    expect(badge.width).toBe(64);
    expect(badge.height).toBe(64);
    expect(boundsOf(step('a', 1, 500, 400), 800, noMeasure)).toEqual({ x: 468, y: 368, width: 64, height: 64 });
  });

  it('RULE-04 a step badge is 2 × the text size of its size (S, M, L)', () => {
    const at = (strokeSize: 'S' | 'M' | 'L') => stepBadge({ ...step('a', 1), style: { ...style, strokeSize } }, 2000);
    expect(at('S').width).toBe(100); // max(12, 0.025 · 2000) = 50
    expect(at('M').width).toBe(160); // 80
    expect(at('L').width).toBe(240); // 120
  });

  it('RULE-07 a pill is as wide as its digits’ advances plus one text size, rounded to nearest', () => {
    // Text size M on a 1000 × 800 image is 32 px; Manrope 600 advances (em): 1 = 0.422, 0 = 0.642, 8 = 0.602.
    expect(stepBadge(step('a', 100), 800).width).toBe(87); // (0.422 + 2 × 0.642) × 32 + 32 = 86.59
    expect(stepBadge(step('a', 111), 800).width).toBe(73); // 3 × 0.422 × 32 + 32 = 72.51
    expect(stepBadge(step('a', 888), 800).width).toBe(90); // 3 × 0.602 × 32 + 32 = 89.79
    // Never narrower than the circle.
    expect(stepPillWidth('11', 32, 64)).toBe(64);
    expect(stepPillWidth('1', 100, 200)).toBe(200);
  });

  it('RULE-07 F-006 edge case from 100 on the badge is a pill of the same height, wider than the circle', () => {
    const two = stepBadge(step('a', 99), 800);
    const three = stepBadge(step('a', 100), 800);
    expect(two.width).toBe(two.height);
    expect(three.height).toBe(two.height);
    expect(three.width).toBeGreaterThan(three.height);
    expect(stepBadge(step('a', 1000), 800).width).toBeGreaterThan(three.width);
    expect(three.label).toBe('100');
  });

  it('RULE-07 step numbers are plain digits, centred on the badge', () => {
    const b = stepBadge(step('a', 12, 300, 200), 800);
    expect(b.label).toBe('12');
    expect(b.centre).toEqual({ x: 300, y: 200 });
    // The digits' height (0.72 em) is centred: the baseline sits half of it below the centre.
    expect(b.baseline).toBeCloseTo(200 + 0.36 * 32, 5);
  });

  it('F-006.R1 a click hits the whole badge, and nothing outside it beyond the tolerance', () => {
    const a = step('a', 1, 100, 100);
    expect(hitTest(a, { x: 100, y: 100 }, 0, 800, noMeasure)).toBe(true);
    expect(hitTest(a, { x: 131, y: 100 }, 0, 800, noMeasure)).toBe(true);
    expect(hitTest(a, { x: 125, y: 125 }, 0, 800, noMeasure)).toBe(false); // outside the circle, inside its box
    expect(hitTest(a, { x: 135, y: 100 }, 4, 800, noMeasure)).toBe(true);
    expect(hitTest(a, { x: 140, y: 100 }, 4, 800, noMeasure)).toBe(false);
    const pill = step('p', 100, 100, 100);
    const w = stepBadge(pill, 800).width;
    expect(hitTest(pill, { x: 100 + w / 2 - 1, y: 100 }, 0, 800, noMeasure)).toBe(true);
  });

  it('F-008.R3 a selected step has no handles; its outline is the badge box', () => {
    const a = step('a', 1, 100, 100);
    expect(handlesOf(a, 800)).toEqual([]);
    expect(boundsOf(a, 800, noMeasure)).toEqual({ x: 68, y: 68, width: 64, height: 64 });
  });

  it('F-006.R5 a step moves by its centre (the duplicate offset) and keeps its number', () => {
    expect(moved(step('a', 2, 100, 100), 10, 10)).toEqual(step('a', 2, 110, 110));
  });

  it('F-006.R4 stepAt places a step centred on the point in the given style', () => {
    expect(stepAt({ x: 5, y: 6 }, 'id', style)).toEqual({
      id: 'id',
      kind: 'step',
      style,
      centre: { x: 5, y: 6 },
      number: 0,
    });
  });
});
