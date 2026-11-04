// MOD-Keys Export group (RULE-19, F-012): Mod+C copies the result when no text is selected on the page,
// Mod+S downloads; both work wherever focus is in the tool. Mod+S also acts while text is edited; Mod+C
// is then the field's own copy. Neither acts while a dialog or menu is open.
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
const modC = key({ key: 'c', code: 'KeyC', mod: true });
const modS = key({ key: 's', code: 'KeyS', mod: true });

describe('MOD-Keys Export (RULE-19)', () => {
  it('F-012.AC1 RULE-19 Mod+C copies the result from the canvas and from any control, kept from the browser', () => {
    for (const focus of ['canvas', 'control'] as const) {
      expect(named(modC, scope({ focus })), focus).toBe('export:copy');
      expect(resolveKey(modC, scope({ focus })).preventDefault).toBe(true);
    }
  });

  it('RULE-19 Mod+C with text selected on the page is the browser’s own copy', () => {
    expect(resolveKey(modC, scope({ pageTextSelected: true }))).toEqual({ preventDefault: false });
  });

  it('RULE-19 Mod+C in a text or number field, or while a dialog or menu is open, does nothing here', () => {
    for (const focus of ['text', 'textAnnotation', 'dialog'] as const)
      expect(resolveKey(modC, scope({ focus })), focus).toEqual({ preventDefault: false });
  });

  it('F-012.R2 RULE-19 Mod+S downloads from the canvas, a control, a text or number field and a text being edited', () => {
    for (const focus of ['canvas', 'control', 'text', 'textAnnotation'] as const) {
      expect(named(modS, scope({ focus })), focus).toBe('export:download');
      expect(resolveKey(modS, scope({ focus })).preventDefault).toBe(true);
    }
  });

  it('RULE-19 Mod+S while a dialog or menu is open does nothing (only Esc acts there)', () => {
    expect(resolveKey(modS, scope({ focus: 'dialog' }))).toEqual({ preventDefault: false });
  });

  it('RULE-19 letters follow the US key position on non-Latin layouts; Shift or Alt make other keys', () => {
    expect(named(key({ key: 'ы', code: 'KeyS', mod: true }))).toBe('export:download');
    expect(named(key({ key: 'с', code: 'KeyC', mod: true }))).toBe('export:copy');
    expect(named(key({ key: 'S', code: 'KeyS', mod: true, shift: true }))).toBeUndefined();
    expect(named(key({ key: 'c', code: 'KeyC', mod: true, alt: true }))).toBeUndefined();
  });
});
