// MOD-Keys — the RULE-19 Tools keys, Enter (place) and Esc built with F-003.
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

describe('MOD-Keys tools, Enter and Esc (RULE-19)', () => {
  it('RULE-19 V R O A L pick select, rectangle, ellipse, arrow and line on the canvas, kept from the browser', () => {
    const expected = {
      v: 'select',
      r: 'rectangle',
      o: 'ellipse',
      a: 'arrow',
      l: 'line',
      p: 'pen',
      x: 'redact',
      c: 'crop',
    };
    for (const [letter, tool] of Object.entries(expected)) {
      const r = resolveKey(key({ key: letter, code: `Key${letter.toUpperCase()}` }), scope());
      expect(r).toEqual({ action: { kind: 'named', group: 'tool', name: tool }, preventDefault: true });
    }
  });

  it('RULE-19 letters follow the typed character on Latin layouts and the US key position otherwise', () => {
    expect(named(key({ key: 'a', code: 'KeyQ' }))).toBe('tool:arrow'); // AZERTY: typed "a"
    expect(named(key({ key: 'ф', code: 'KeyA' }))).toBe('tool:arrow'); // Russian: position of A
  });

  it('RULE-19 tool keys act only while the canvas has focus, and not with Mod, Alt or Shift', () => {
    for (const focus of ['control', 'text', 'dialog'] as const)
      expect(resolveKey(key({ key: 'r', code: 'KeyR' }), scope({ focus }))).toEqual({ preventDefault: false });
    expect(named(key({ key: 'r', code: 'KeyR', mod: true }))).toBeUndefined();
    expect(named(key({ key: 'R', code: 'KeyR', shift: true }))).toBeUndefined();
  });

  it('F-003.AC8 RULE-19 Enter with a drawing tool places, even with something selected; not with select', () => {
    expect(named(key({ key: 'Enter', code: 'Enter' }), scope({ tool: 'arrow' }))).toBe('canvas:place');
    expect(named(key({ key: 'Enter', code: 'Enter' }), scope({ tool: 'arrow', selection: 'one' }))).toBe(
      'canvas:place',
    );
    // RULE-19: kept from the browser with every tool, even with nothing to act on.
    for (const t of ['select', 'crop'] as const)
      expect(resolveKey(key({ key: 'Enter', code: 'Enter' }), scope({ tool: t }))).toEqual({ preventDefault: true });
    expect(named(key({ key: 'Enter', code: 'Enter' }), scope({ tool: 'arrow', focus: 'control' }))).toBeUndefined();
  });

  it('F-004.AC6 RULE-19 P and H pick the pen and highlight; Enter with either places (a dot)', () => {
    expect(named(key({ key: 'p', code: 'KeyP' }))).toBe('tool:pen');
    expect(named(key({ key: 'h', code: 'KeyH' }))).toBe('tool:highlight');
    for (const t of ['pen', 'highlight'] as const)
      expect(resolveKey(key({ key: 'Enter', code: 'Enter' }), scope({ tool: t }))).toEqual({
        action: { kind: 'named', group: 'canvas', name: 'place' },
        preventDefault: true,
      });
  });

  it('RULE-19 Esc on the canvas runs the Esc chain (cancel drag, clear selection, select tool)', () => {
    expect(named(key({ key: 'Escape', code: 'Escape' }))).toBe('edit:escape');
    expect(named(key({ key: 'Escape', code: 'Escape' }), scope({ focus: 'dialog' }))).toBeUndefined();
  });
});
