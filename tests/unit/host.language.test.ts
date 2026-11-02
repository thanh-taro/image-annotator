// MOD-Host language resolution (RULE-17, ADR-0015 §1) and the boot script that mirrors it
// (RULE-16 theme, ADR-0010): the same cases run against both.
import { describe, expect, it } from 'vitest';
import bootSource from '../../src/host/boot.js?raw';
import { matchLanguage, resolveLanguage } from '../../src/host/language';

/** Runs the classic boot script against a fake page and returns what it set on <html>. */
function boot(search: string, languages: readonly string[], prefersLight = false) {
  const attrs: Record<string, string> = {};
  const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
  const run = new Function('location', 'matchMedia', 'document', 'navigator', bootSource) as (
    ...args: unknown[]
  ) => void;
  run({ search }, () => ({ matches: prefersLight }), document, { languages, language: languages[0] });
  return attrs;
}

const CASES: [address: string | null, preferred: string[], expected: string][] = [
  ['vi-VN', ['en-US'], 'vi-VN'],
  ['vi', ['en-US'], 'vi-VN'],
  ['VI-vn', [], 'vi-VN'],
  ['en-GB', ['vi-VN'], 'en-US'],
  ['fr', ['vi'], 'vi-VN'],
  [null, ['de-DE', 'vi-VN'], 'vi-VN'],
  [null, ['de-DE'], 'en-US'],
  ['', [], 'en-US'],
];

describe('MOD-Host language', () => {
  it('RULE-17 matches ignoring case, else by primary language', () => {
    expect(matchLanguage('vi-vn')).toBe('vi-VN');
    expect(matchLanguage('en-GB')).toBe('en-US');
    expect(matchLanguage('fr')).toBeNull();
    expect(matchLanguage(42)).toBeNull();
  });

  for (const [address, preferred, expected] of CASES) {
    it(`RULE-17 address ${JSON.stringify(address)}, browser ${JSON.stringify(preferred)} → ${expected} (app and boot script)`, () => {
      expect(resolveLanguage(address, preferred)).toBe(expected);
      const search = address === null ? '' : `?lang=${encodeURIComponent(address)}`;
      expect(boot(search, preferred.length ? preferred : ['xx'])['lang']).toBe(expected);
    });
  }

  it('RULE-16 the boot script takes the theme from the address, else the device preference', () => {
    expect(boot('?theme=light', ['en-US'])['data-theme']).toBe('light');
    expect(boot('?theme=dark', ['en-US'], true)['data-theme']).toBe('dark');
    expect(boot('?theme=blue', ['en-US'], true)['data-theme']).toBe('light');
    expect(boot('', ['en-US'])['data-theme']).toBe('dark');
  });
});
