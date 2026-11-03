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
const name = (k: KeyInfo, s: Scope = scope()) => resolveKey(k, s).action?.name;

describe('MOD-Keys view keys (RULE-19)', () => {
  it('RULE-19 Mod+= zooms in and Mod+- zooms out wherever focus is in the tool', () => {
    for (const focus of ['canvas', 'control'] as const) {
      expect(resolveKey(key({ key: '=', code: 'Equal', mod: true }), scope({ focus }))).toEqual({
        action: { group: 'view', name: 'zoomIn' },
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

  it('RULE-19 arrow keys pan the view with nothing selected on the canvas (F-002.R4)', () => {
    expect(name(key({ key: 'ArrowRight', code: 'ArrowRight' }))).toBe('panRight');
    expect(name(key({ key: 'ArrowLeft', code: 'ArrowLeft' }))).toBe('panLeft');
    expect(name(key({ key: 'ArrowUp', code: 'ArrowUp' }))).toBe('panUp');
    expect(name(key({ key: 'ArrowDown', code: 'ArrowDown' }))).toBe('panDown');
    expect(resolveKey(key({ key: 'ArrowRight' }), scope()).preventDefault).toBe(true);
    // RULE-19: Shift+arrow pans further (200 px instead of 40).
    expect(name(key({ key: 'ArrowRight', shift: true }))).toBe('panRightFar');
    expect(name(key({ key: 'ArrowUp', shift: true }))).toBe('panUpFar');
    // Not on another control, not with a selection (that moves it, F-008), not with the crop tool.
    expect(resolveKey(key({ key: 'ArrowRight' }), scope({ focus: 'control' }))).toEqual({ preventDefault: false });
    expect(name(key({ key: 'ArrowRight' }), scope({ selection: 'one' }))).toBeUndefined();
    expect(name(key({ key: 'ArrowRight' }), scope({ tool: 'crop' }))).toBeUndefined();
  });

  it('RULE-19 Space on the canvas holds the pan mode for Space+drag', () => {
    expect(resolveKey(key({ key: ' ', code: 'Space' }), scope())).toEqual({
      action: { group: 'view', name: 'panHold' },
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
