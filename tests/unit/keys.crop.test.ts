// MOD-Keys — RULE-19 arrow keys with the crop tool (F-010.R6): they act on the frame, never pan.
import { describe, expect, it } from 'vitest';
import { resolveKey, type KeyInfo, type Scope } from '../../src/keys';

const key = (k: Partial<KeyInfo> & { key: string }): KeyInfo => ({
  code: k.key,
  mod: false,
  shift: false,
  alt: false,
  mac: false,
  ...k,
});
const scope = (s: Partial<Scope> = {}): Scope => ({ focus: 'canvas', tool: 'crop', selection: 'none', ...s });

describe('MOD-Keys crop frame keys (RULE-19)', () => {
  it('F-010.AC7 RULE-19 Alt+Shift+Left resizes the frame 10 image pixels narrower by its right edge', () => {
    expect(resolveKey(key({ key: 'ArrowLeft', alt: true, shift: true }), scope())).toEqual({
      action: { kind: 'frameResize', group: 'edit', dx: -10, dy: 0 },
      preventDefault: true,
    });
    expect(resolveKey(key({ key: 'ArrowDown', alt: true }), scope()).action).toEqual({
      kind: 'frameResize',
      group: 'edit',
      dx: 0,
      dy: 1,
    });
  });

  it('F-010.R6 RULE-19 arrows move the frame 1 image pixel (Shift: 10), with or without a selection, never pan', () => {
    for (const selection of ['none', 'one', 'many'] as const) {
      expect(resolveKey(key({ key: 'ArrowRight' }), scope({ selection })).action).toEqual({
        kind: 'frameMove',
        group: 'edit',
        dx: 1,
        dy: 0,
      });
    }
    expect(resolveKey(key({ key: 'ArrowUp', shift: true }), scope()).action).toEqual({
      kind: 'frameMove',
      group: 'edit',
      dx: 0,
      dy: -10,
    });
  });

  it('RULE-19 only while the canvas has focus: on a panel field the arrows are the field’s own', () => {
    expect(resolveKey(key({ key: 'ArrowLeft', alt: true }), scope({ focus: 'text' }))).toEqual({
      preventDefault: false,
    });
    expect(resolveKey(key({ key: 'ArrowLeft' }), scope({ focus: 'control' }))).toEqual({ preventDefault: false });
  });
});
