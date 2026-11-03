// MOD-Keys while a text annotation is edited, and Enter on a text (F-005, RULE-19): only Esc (and Mod+S,
// F-012) keep their meaning while editing; every other key belongs to the text field. Enter with the
// text tool starts a text at the centre; Enter with the select tool and one text selected edits it.
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
const editing = scope({ focus: 'textAnnotation', tool: 'text' });

describe('MOD-Keys text editing (RULE-19)', () => {
  it('F-005.R2 RULE-19 while a text is edited Esc runs the Esc chain (ending the edit)', () => {
    expect(resolveKey(key({ key: 'Escape', code: 'Escape' }), editing)).toEqual({
      action: { kind: 'named', group: 'edit', name: 'escape' },
      preventDefault: true,
    });
  });

  it('F-005.AC9 F-005.AC2 RULE-19 while a text is edited Backspace, Delete, arrows, Mod+A, Enter and letters stay the field’s', () => {
    for (const k of [
      key({ key: 'Backspace', code: 'Backspace' }),
      key({ key: 'Delete', code: 'Delete' }),
      key({ key: 'ArrowLeft', code: 'ArrowLeft' }),
      key({ key: 'ArrowRight', code: 'ArrowRight', shift: true }),
      key({ key: 'a', code: 'KeyA', mod: true }),
      key({ key: 'z', code: 'KeyZ', mod: true }),
      key({ key: 'Enter', code: 'Enter' }),
      key({ key: 't', code: 'KeyT' }),
      key({ key: ' ', code: 'Space' }),
      key({ key: '=', code: 'Equal', mod: true }),
    ])
      expect(resolveKey(k, editing), k.key).toEqual({ preventDefault: false });
  });

  it('F-005.AC13 RULE-19 T picks the text tool; Enter with it places (starts a text at the centre)', () => {
    expect(named(key({ key: 't', code: 'KeyT' }))).toBe('tool:text');
    expect(named(key({ key: 'Enter', code: 'Enter' }), scope({ tool: 'text' }))).toBe('canvas:place');
  });

  it('F-005.R4 RULE-19 Enter with the select tool and one text selected edits it; otherwise it is only kept', () => {
    const enter = key({ key: 'Enter', code: 'Enter' });
    expect(named(enter, scope({ selection: 'one', textSelected: true }))).toBe('canvas:editText');
    expect(resolveKey(enter, scope({ selection: 'one', textSelected: false }))).toEqual({ preventDefault: true });
    expect(resolveKey(enter, scope({ selection: 'many', textSelected: true }))).toEqual({ preventDefault: true });
  });
});
