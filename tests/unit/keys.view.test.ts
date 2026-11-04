// MOD-Keys — the View keys of RULE-19 and the arrow-key pan (F-002.R4). The rest of the map is F-013.
import { describe, expect, it } from 'vitest';
import { resolveKey, type KeyInfo, type Scope } from '../../src/keys';

const key = (k: Partial<KeyInfo> & { key: string }): KeyInfo => ({
  code: '',
  mod: false,
  shift: false,
  alt: false,
  mac: false,
  ...k,
});
const scope = (s: Partial<Scope> = {}): Scope => ({ focus: 'canvas', tool: 'select', selection: 'none', ...s });
const name = (k: KeyInfo, s: Scope = scope()) => {
  const a = resolveKey(k, s).action;
  return a?.kind === 'named' ? a.name : a?.kind;
};
const pan = (k: KeyInfo, s: Scope = scope()) => resolveKey(k, s).action;

describe('MOD-Keys view keys (RULE-19)', () => {
  it('RULE-19 Mod+= zooms in and Mod+- zooms out wherever focus is in the tool', () => {
    for (const focus of ['canvas', 'control'] as const) {
      expect(resolveKey(key({ key: '=', code: 'Equal', mod: true }), scope({ focus }))).toEqual({
        action: { kind: 'named', group: 'view', name: 'zoomIn' },
        preventDefault: true,
      });
      expect(name(key({ key: '-', code: 'Minus', mod: true }), scope({ focus }))).toBe('zoomOut');
    }
    // Mod++ (Shift+= on US layouts, its own key elsewhere) is the browser's zoom-in too.
    expect(name(key({ key: '+', code: 'Equal', mod: true, shift: true }))).toBe('zoomIn');
  });

  it('RULE-19 Shift+1 fits and Shift+0 shows 100 % only while the canvas has focus, by key position', () => {
    expect(name(key({ key: '!', code: 'Digit1', shift: true }))).toBe('fit');
    expect(name(key({ key: ')', code: 'Digit0', shift: true }))).toBe('actualSize');
    expect(name(key({ key: '%', code: 'Digit1', shift: true }))).toBe('fit'); // another layout's Shift+1
    expect(resolveKey(key({ key: '!', code: 'Digit1', shift: true }), scope({ focus: 'control' }))).toEqual({
      preventDefault: false,
    });
  });

  it('RULE-19 arrow keys pan the view 40 px (Shift: 200) with nothing selected on the canvas (F-002.R4)', () => {
    const view = (dx: number, dy: number) => ({ kind: 'pan', group: 'view', dx, dy });
    expect(pan(key({ key: 'ArrowRight', code: 'ArrowRight' }))).toEqual(view(40, 0));
    expect(pan(key({ key: 'ArrowLeft', code: 'ArrowLeft' }))).toEqual(view(-40, 0));
    expect(pan(key({ key: 'ArrowUp', code: 'ArrowUp' }))).toEqual(view(0, -40));
    expect(pan(key({ key: 'ArrowDown', code: 'ArrowDown' }))).toEqual(view(0, 40));
    expect(pan(key({ key: 'ArrowRight', shift: true }))).toEqual(view(200, 0));
    expect(pan(key({ key: 'ArrowUp', shift: true }))).toEqual(view(0, -200));
    expect(resolveKey(key({ key: 'ArrowRight' }), scope()).preventDefault).toBe(true);
    // Not on another control, not with a selection (that moves it, F-008), not with the crop tool.
    expect(resolveKey(key({ key: 'ArrowRight' }), scope({ focus: 'control' }))).toEqual({ preventDefault: false });
    expect(name(key({ key: 'ArrowRight' }), scope({ selection: 'one' }))).toBe('nudge'); // F-008: moves it
    expect(name(key({ key: 'ArrowRight' }), scope({ tool: 'crop' }))).toBeUndefined();
  });

  it('RULE-19 Alt+arrows on the canvas are kept from the browser even with nothing to resize', () => {
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
      expect(resolveKey(key({ key: k, code: k, alt: true }), scope())).toEqual({ preventDefault: true });
    expect(resolveKey(key({ key: 'ArrowLeft', alt: true }), scope({ focus: 'control' }))).toEqual({
      preventDefault: false,
    });
  });

  it('RULE-19 Space on the canvas holds the pan mode for Space+drag', () => {
    expect(resolveKey(key({ key: ' ', code: 'Space' }), scope())).toEqual({
      action: { kind: 'named', group: 'view', name: 'panHold' },
      preventDefault: true,
    });
    expect(resolveKey(key({ key: ' ', code: 'Space' }), scope({ focus: 'control' }))).toEqual({
      preventDefault: false,
    });
  });

  it('RULE-19 no view key acts while text is edited or a dialog or menu is open', () => {
    for (const focus of ['text', 'dialog'] as const) {
      expect(resolveKey(key({ key: '=', mod: true }), scope({ focus }))).toEqual({ preventDefault: false });
      expect(resolveKey(key({ key: 'ArrowRight' }), scope({ focus }))).toEqual({ preventDefault: false });
      expect(resolveKey(key({ key: ' ', code: 'Space' }), scope({ focus }))).toEqual({ preventDefault: false });
    }
  });
});
