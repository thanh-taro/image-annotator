// MOD-Host message checks as pure functions (RULE-16, ADR-0010, ADR-0015 §2): which settings
// messages are accepted, and where the single ready signal may go.
import { describe, expect, it } from 'vitest';
import { acceptSettings, READY_MESSAGE, readyTargets } from '../../src/host/messages';

const HOST = 'https://tarokit.app';
const ALLOW = [HOST] as const;
const parent = { name: 'parent' };
const sibling = { name: 'sibling' };

const msg = (data: unknown, origin = HOST, source: unknown = parent) => ({ data, origin, source });

describe('MOD-Host settings messages', () => {
  it('RULE-16 accepts a theme message from an allowed origin and the embedding page', () => {
    expect(acceptSettings(msg({ type: 'taro:theme', value: 'dark' }), ALLOW, parent)).toEqual({
      type: 'taro:theme',
      value: 'dark',
    });
  });

  it('F-015.AC5 ignores a settings message from an origin not in the allowed list', () => {
    expect(
      acceptSettings(msg({ type: 'taro:theme', value: 'dark' }, 'https://evil.example'), ALLOW, parent),
    ).toBeNull();
    expect(acceptSettings(msg({ type: 'taro:theme', value: 'dark' }, 'null'), ALLOW, parent)).toBeNull();
  });

  it('F-015.AC5 ignores a settings message from anything other than the embedding page', () => {
    expect(acceptSettings(msg({ type: 'taro:theme', value: 'dark' }, HOST, sibling), ALLOW, parent)).toBeNull();
    expect(acceptSettings(msg({ type: 'taro:theme', value: 'dark' }, HOST, null), ALLOW, parent)).toBeNull();
  });

  it('RULE-16 an empty allow-list accepts nothing (standalone only)', () => {
    expect(acceptSettings(msg({ type: 'taro:theme', value: 'dark' }), [], parent)).toBeNull();
  });

  it('F-015 edge case: an unknown theme value is ignored (the current theme stays)', () => {
    for (const value of ['blue', 'Dark', '', null, 1])
      expect(acceptSettings(msg({ type: 'taro:theme', value }), ALLOW, parent)).toBeNull();
  });

  it('F-018.R4 a language message is matched per RULE-17; an unsupported value is ignored', () => {
    expect(acceptSettings(msg({ type: 'taro:language', value: 'vi' }), ALLOW, parent)).toEqual({
      type: 'taro:language',
      value: 'vi-VN',
    });
    expect(acceptSettings(msg({ type: 'taro:language', value: 'en-GB' }), ALLOW, parent)).toEqual({
      type: 'taro:language',
      value: 'en-US',
    });
    for (const value of ['fr-FR', '', null, 42])
      expect(acceptSettings(msg({ type: 'taro:language', value }), ALLOW, parent)).toBeNull();
    expect(
      acceptSettings(msg({ type: 'taro:language', value: 'vi-VN' }, 'https://evil.example'), ALLOW, parent),
    ).toBeNull();
  });

  it('RULE-16 other message shapes are ignored', () => {
    for (const data of [null, 'taro:theme', { type: 'taro:ready' }, { type: 'taro:other', value: 'dark' }, [1]])
      expect(acceptSettings(msg(data), ALLOW, parent)).toBeNull();
  });
});

describe('MOD-Host ready signal', () => {
  it('F-015.R5 the ready signal carries no content', () => {
    expect(READY_MESSAGE).toEqual({ type: 'taro:ready' });
  });

  it('RULE-16 the ready signal goes only to the allowed parent origin, never "*"', () => {
    expect(readyTargets(ALLOW)).toEqual([HOST]);
    // Each allowed origin; the browser drops the ones that do not match the parent.
    expect(readyTargets(['https://a.example', HOST])).toEqual(['https://a.example', HOST]);
    expect(readyTargets([])).toEqual([]);
  });

  it('RULE-16 the ready signal is still sent when the parent origin is masked as "null"', () => {
    // A host frame with referrerpolicy="no-referrer" makes location.ancestorOrigins[0] "null"
    // (Chromium). The targets do not depend on it, so the allowed parent still gets taro:ready.
    const targets = readyTargets(ALLOW);
    expect(targets).toEqual([HOST]);
    expect(targets).not.toContain('null');
    expect(targets).not.toContain('*');
  });
});
