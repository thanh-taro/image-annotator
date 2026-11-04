// MOD-Keys History group (RULE-19, F-009.R1): Mod+Z undoes, Mod+Shift+Z redoes, Ctrl+Y redoes on
// Windows/Linux. They work wherever focus is in the tool and are kept from the browser even with
// nothing to undo; in a text or number field and while a text annotation is edited they are the
// field's own undo and redo; while a dialog or menu is open they do nothing.
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
const named = (k: KeyInfo, s: Scope = scope()) => {
  const r = resolveKey(k, s);
  return r.action?.kind === 'named' ? `${r.action.group}:${r.action.name}` : undefined;
};

const modZ = (mac = false) => key({ key: 'z', code: 'KeyZ', mod: true, mac });
const modShiftZ = (mac = false) => key({ key: 'Z', code: 'KeyZ', mod: true, shift: true, mac });
const ctrlY = key({ key: 'y', code: 'KeyY', mod: true });

describe('MOD-Keys History (RULE-19)', () => {
  it('F-009.R1 RULE-19 Mod+Z undoes and Mod+Shift+Z redoes, on the canvas and on any control, kept from the browser', () => {
    for (const mac of [false, true])
      for (const focus of ['canvas', 'control'] as const) {
        expect(named(modZ(mac), scope({ focus })), `${focus} mac=${mac}`).toBe('history:undo');
        expect(named(modShiftZ(mac), scope({ focus })), `${focus} mac=${mac}`).toBe('history:redo');
        expect(resolveKey(modZ(mac), scope({ focus })).preventDefault).toBe(true);
        expect(resolveKey(modShiftZ(mac), scope({ focus })).preventDefault).toBe(true);
      }
  });

  it('RULE-19 Ctrl+Y redoes on Windows/Linux; Cmd+Y on macOS is not redo', () => {
    expect(named(ctrlY)).toBe('history:redo');
    expect(named(ctrlY, scope({ focus: 'control' }))).toBe('history:redo');
    expect(named(key({ key: 'y', code: 'KeyY', mod: true, mac: true }))).toBeUndefined();
  });

  it('RULE-19 letters follow the key position on non-Latin layouts (Mod+Z on a Cyrillic layout)', () => {
    expect(named(key({ key: 'я', code: 'KeyZ', mod: true }))).toBe('history:undo');
    expect(named(key({ key: 'Я', code: 'KeyZ', mod: true, shift: true }))).toBe('history:redo');
  });

  it('F-009 edge case RULE-19 in a text annotation being edited, or a text or number field, undo and redo are the field’s own', () => {
    for (const focus of ['textAnnotation', 'text'] as const)
      for (const k of [modZ(), modShiftZ(), ctrlY])
        expect(resolveKey(k, scope({ focus })), `${focus} ${k.key}`).toEqual({ preventDefault: false });
  });

  it('RULE-19 while a dialog or menu is open, the history keys do nothing', () => {
    for (const k of [modZ(), modShiftZ(), ctrlY])
      expect(resolveKey(k, scope({ focus: 'dialog' }))).toEqual({ preventDefault: false });
  });

  it('RULE-19 Alt with the history keys is not undo or redo', () => {
    expect(named(key({ key: 'z', code: 'KeyZ', mod: true, alt: true }))).toBeUndefined();
  });
});
