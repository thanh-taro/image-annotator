// MOD-Keys — the RULE-19 Edit keys built with F-008: Delete/Backspace, Mod+D, Mod+A, ] and [, arrow keys
// moving the selection and Alt+arrows resizing a single one. Only while the canvas has focus.
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
const scope = (s: Partial<Scope> = {}): Scope => ({ focus: 'canvas', tool: 'select', selection: 'one', ...s });
const named = (k: KeyInfo, s: Scope = scope()) => {
  const r = resolveKey(k, s);
  return r.action?.kind === 'named' ? `${r.action.group}:${r.action.name}` : undefined;
};

describe('MOD-Keys edit keys (RULE-19)', () => {
  it('F-008.AC6 RULE-19 Delete and Backspace delete; Mod+D duplicates; Mod+A selects all; ] and [ reorder', () => {
    expect(named(key({ key: 'Delete', code: 'Delete' }))).toBe('edit:delete');
    expect(named(key({ key: 'Backspace', code: 'Backspace' }))).toBe('edit:delete');
    expect(named(key({ key: 'd', code: 'KeyD', mod: true }))).toBe('edit:duplicate');
    expect(named(key({ key: 'a', code: 'KeyA', mod: true }), scope({ selection: 'none' }))).toBe('edit:selectAll');
    expect(named(key({ key: ']', code: 'BracketRight' }))).toBe('edit:bringForward');
    expect(named(key({ key: '[', code: 'BracketLeft' }))).toBe('edit:sendBackward');
    // Kept from the browser (Mod+D bookmarks, Backspace goes back) while the canvas has focus.
    expect(resolveKey(key({ key: 'd', code: 'KeyD', mod: true }), scope()).preventDefault).toBe(true);
    expect(resolveKey(key({ key: 'Backspace' }), scope({ selection: 'none' })).preventDefault).toBe(true);
  });

  it('F-019.R5 RULE-19 Esc in a panel field (its text unchanged) runs the Esc chain', () => {
    expect(resolveKey(key({ key: 'Escape', code: 'Escape' }), scope({ focus: 'text' }))).toEqual({
      action: { kind: 'named', group: 'edit', name: 'escape' },
      preventDefault: true,
    });
  });

  it('F-008.AC16 RULE-19 in a panel field Backspace, arrows and Enter are the field’s own', () => {
    for (const k of ['Backspace', 'Delete', 'ArrowLeft', 'Enter'])
      expect(resolveKey(key({ key: k, code: k }), scope({ focus: 'text' }))).toEqual({ preventDefault: false });
    expect(resolveKey(key({ key: 'a', code: 'KeyA', mod: true }), scope({ focus: 'control' }))).toEqual({
      preventDefault: false,
    });
  });

  it('F-008.AC9 RULE-19 arrow keys move the selection 1 image pixel, 10 with Shift', () => {
    expect(resolveKey(key({ key: 'ArrowRight', code: 'ArrowRight', shift: true }), scope()).action).toEqual({
      kind: 'nudge',
      group: 'edit',
      dx: 10,
      dy: 0,
    });
    expect(resolveKey(key({ key: 'ArrowUp', code: 'ArrowUp' }), scope({ selection: 'many' })).action).toEqual({
      kind: 'nudge',
      group: 'edit',
      dx: 0,
      dy: -1,
    });
  });

  it('F-008.AC10 RULE-19 Alt+arrows resize a single selection by its right or bottom edge (Shift: 10)', () => {
    expect(resolveKey(key({ key: 'ArrowRight', code: 'ArrowRight', alt: true }), scope()).action).toEqual({
      kind: 'resize',
      group: 'edit',
      dx: 1,
      dy: 0,
    });
    expect(resolveKey(key({ key: 'ArrowUp', alt: true, shift: true }), scope()).action).toEqual({
      kind: 'resize',
      group: 'edit',
      dx: 0,
      dy: -10,
    });
    // With several selected they do nothing, and are still kept from the browser.
    expect(resolveKey(key({ key: 'ArrowLeft', alt: true }), scope({ selection: 'many' }))).toEqual({
      preventDefault: true,
    });
  });
});
