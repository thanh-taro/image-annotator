// MOD-Build generators: the copy catalog checks (F-018.AC8, ADR-0015 §3) and the HOST_ORIGINS
// parsing behind frame-ancestors and the message allow-list (NFR-09, RULE-16).
import { describe, expect, it } from 'vitest';
import copyMd from '../../specs/30-experience/copy.md?raw';
// @ts-expect-error -- plain ESM build script without type declarations
import { parseCopy, pluralCategories } from '../../scripts/gen-copy.mjs';
// @ts-expect-error -- plain ESM build script without type declarations
import { pageCsp, parseHostOrigins } from '../../scripts/gen-headers.mjs';

const table = (row: string) => `| ID | en-US | vi-VN | Notes |\n|---|---|---|---|\n${row}\n`;

describe('MOD-Build codegen', () => {
  it('F-018.AC8 copy.md parses with every string in both languages', () => {
    const { languages, rows } = parseCopy(copyMd) as { languages: string[]; rows: unknown[] };
    expect(languages).toEqual(['en-US', 'vi-VN']);
    expect(rows.length).toBeGreaterThan(100);
  });

  it('F-018.AC8 generation fails when a language text is missing', () => {
    expect(() => parseCopy(table('| **COPY-a.b** | Hello |  | |'))).toThrow(/no vi-VN text/);
  });

  it('F-018.AC8 generation fails when placeholders differ between languages', () => {
    expect(() => parseCopy(table('| **COPY-a.b** | Hi {name} | Chào {ten} | |'))).toThrow(/placeholders differ/);
  });

  it('F-018.AC8 generation fails when plural forms do not match the language categories', () => {
    expect(pluralCategories('en-US')).toEqual(['one', 'other']);
    expect(pluralCategories('vi-VN')).toEqual(['other']);
    expect(() => parseCopy(table('| **COPY-a.b** | other: {count} items | {count} mục | |'))).toThrow(
      /en-US plural forms \[other\] differ/,
    );
    expect(() =>
      parseCopy(
        table('| **COPY-a.b** | one: {count} item · other: {count} items | one: {count} mục · other: {count} mục | |'),
      ),
    ).toThrow(/vi-VN plural forms/);
  });

  it('smoke: deprecated copy rows are skipped', () => {
    const { rows } = parseCopy(table('| **COPY-a.b** | A | B | deprecated |\n| **COPY-a.c** | A | B | |'));
    expect(rows.map((r: { id: string }) => r.id)).toEqual(['a.c']);
  });

  it('NFR-09 HOST_ORIGINS refuses wildcards, paths and plain http to other hosts', () => {
    expect(parseHostOrigins('https://tarokit.app http://localhost:4290')).toEqual([
      'https://tarokit.app',
      'http://localhost:4290',
    ]);
    expect(() => parseHostOrigins('https://*.tarokit.app')).toThrow();
    expect(() => parseHostOrigins('https://tarokit.app/x')).toThrow();
    expect(() => parseHostOrigins('http://tarokit.app')).toThrow();
  });

  it("NFR-09 an empty allow-list makes frame-ancestors 'none'", () => {
    expect(pageCsp([])).toMatch(/frame-ancestors 'none'$/);
    expect(pageCsp(['https://tarokit.app'])).toMatch(/connect-src 'none'/);
  });
});
