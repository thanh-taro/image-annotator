// copy.md → typed message catalog, one text per supported language (ADR-0013, ADR-0015 §3, MOD-Copy).
// Adapted from DAFV. Implements: F-018.AC8 — generation (and so the build) fails when a COPY string
// lacks a language, when its placeholders differ between languages, or when its plural forms do not
// match the language's plural categories (Intl.PluralRules).
//
// copy.md format: tables `| ID | en-US | vi-VN | Notes |`, one row per string, the ID cell
// `**COPY-<group>.<name>**`. The first language column is the default (RULE-17). A text with a count
// gives one form per category, `one: … · other: …`; a language with a single category (vi-VN:
// `other`) writes its one form without a prefix. Rows whose Notes say "deprecated" are skipped.
import fs from 'node:fs';
import { abs, emit, GENERATED_HEADER, tableCells } from './lib/util.mjs';

const SOURCE = 'specs/30-experience/copy.md';
const OUT = abs('src/copy/messages.gen.ts');
const LANGUAGE_TAG = /^[a-z]{2}-[A-Z]{2}$/;
const ID_CELL = /^\*\*COPY-([a-z0-9_]+(?:\.[a-z0-9_]+)+)\*\*$/;
const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const FORM_PREFIX = new RegExp(`^(${CATEGORIES.join('|')}):\\s*`);
const FORM_SPLIT = new RegExp(`\\s+·\\s+(?=(?:${CATEGORIES.join('|')}):)`);
/** The placeholder that selects a plural form. */
export const COUNT = 'count';

const placeholders = (text) => [...new Set([...text.matchAll(/\{([a-zA-Z]\w*)\}/g)].map((x) => x[1]))].sort();

/** The plural categories of a language, in CATEGORIES order (Intl.PluralRules, ADR-0015 §5). */
export function pluralCategories(lang) {
  const cats = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
  return CATEGORIES.filter((c) => cats.includes(c));
}

/** `one: a · other: b` → { one: 'a', other: 'b' }; a text without a prefix → null. */
export function parseForms(text) {
  if (!FORM_PREFIX.test(text)) return null;
  const forms = {};
  for (const part of text.split(FORM_SPLIT)) {
    const m = FORM_PREFIX.exec(part);
    if (!m) throw new Error(`malformed plural text: ${text}`);
    if (forms[m[1]] !== undefined) throw new Error(`duplicate plural form ${m[1]}: ${text}`);
    forms[m[1]] = part.slice(m[0].length);
  }
  return forms;
}

/**
 * Parses copy.md into `{ languages, rows: [{ id, texts: { [lang]: string | forms }, params, plural }] }`;
 * throws on any gap (F-018.AC8).
 */
export function parseCopy(md) {
  const rows = [];
  const seen = new Set();
  let languages = null;
  let columns = null;
  for (const line of md.split('\n')) {
    const cells = tableCells(line);
    if (!cells || cells.length < 2) continue;
    if (cells[0] === 'ID') {
      columns = cells.slice(1).filter((c) => LANGUAGE_TAG.test(c));
      if (columns.length === 0) throw new Error(`${SOURCE}: table header has no language columns`);
      if (cells.slice(1, 1 + columns.length).join() !== columns.join()) {
        throw new Error(`${SOURCE}: language columns must come right after ID`);
      }
      if (languages === null) languages = columns;
      else if (columns.join() !== languages.join()) {
        throw new Error(`${SOURCE}: table languages ${columns.join(', ')} differ from ${languages.join(', ')}`);
      }
      continue;
    }
    const m = ID_CELL.exec(cells[0]);
    if (!m) continue;
    if (!columns) throw new Error(`${SOURCE}: COPY row before any table header`);
    const [, id] = m;
    const notes = cells[1 + columns.length] ?? '';
    if (/\bdeprecated\b/i.test(notes)) continue;
    if (seen.has(id)) throw new Error(`${SOURCE}: duplicate COPY-${id}`);
    seen.add(id);

    const raw = {};
    columns.forEach((lang, i) => {
      const text = cells[1 + i] ?? '';
      if (text === '') throw new Error(`${SOURCE}: COPY-${id} has no ${lang} text`);
      raw[lang] = text;
    });
    const parsed = Object.fromEntries(columns.map((lang) => [lang, parseForms(raw[lang])]));
    const plural = columns.some((lang) => parsed[lang] !== null);
    const texts = {};
    for (const lang of columns) {
      if (!plural) {
        texts[lang] = raw[lang];
        continue;
      }
      const want = pluralCategories(lang);
      // A language with a single category writes its one form without a prefix.
      const forms = parsed[lang] ?? (want.length === 1 ? { [want[0]]: raw[lang] } : null);
      const got = forms ? CATEGORIES.filter((c) => forms[c] !== undefined) : [];
      if (got.join() !== want.join()) {
        throw new Error(
          `${SOURCE}: COPY-${id} ${lang} plural forms [${got.join(', ')}] differ from the language's categories [${want.join(', ')}]`,
        );
      }
      texts[lang] = forms;
    }
    const langParams = (lang) =>
      placeholders(typeof texts[lang] === 'string' ? texts[lang] : Object.values(texts[lang]).join(' '));
    const params = langParams(columns[0]);
    for (const lang of columns.slice(1)) {
      if (langParams(lang).join() !== params.join()) {
        throw new Error(`${SOURCE}: COPY-${id} placeholders differ between ${columns[0]} and ${lang}`);
      }
    }
    if (plural && !params.includes(COUNT)) throw new Error(`${SOURCE}: COPY-${id} has plural forms but no {count}`);
    rows.push({ id, texts, params, plural });
  }
  if (rows.length === 0 || languages === null) throw new Error(`${SOURCE}: no COPY rows found`);
  return { languages, rows };
}

/** The generated TypeScript for a parsed catalog. */
export function renderCopy({ languages, rows }) {
  const paramType = (r) =>
    r.params.length
      ? `{ ${r.params.map((p) => `${p}: ${p === COUNT && r.plural ? 'number' : 'string | number'}`).join('; ')} }`
      : 'undefined';
  const table = (lang) =>
    `  ${JSON.stringify(lang)}: {\n${rows.map((r) => `    ${JSON.stringify(r.id)}: ${JSON.stringify(r.texts[lang])},`).join('\n')}\n  },`;
  return `// ${GENERATED_HEADER(SOURCE, 'scripts/gen-copy.mjs')}
// Deprecated strings are not generated. ${rows.length} messages × ${languages.length} languages.

/** Supported languages, in copy.md column order; the first is the default (RULE-17). */
export const LANGUAGES = ${JSON.stringify(languages)} as const;

export type Language = (typeof LANGUAGES)[number];

/** Plural forms of one text, by Intl.PluralRules category (ADR-0015 §5). */
export type PluralForms = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & { readonly other: string };

/** Every user-facing string per language, keyed by COPY ID without the \`COPY-\` prefix. */
export const CATALOG: { readonly [L in Language]: { readonly [K in MessageId]: string | PluralForms } } = {
${languages.map(table).join('\n')}
};

/** IDs whose text has plural forms, selected by \`{count}\`. */
export const PLURAL_IDS: ReadonlySet<MessageId> = new Set<MessageId>(${JSON.stringify(rows.filter((r) => r.plural).map((r) => r.id))});

export type MessageId =
${rows.map((r) => `  | ${JSON.stringify(r.id)}`).join('\n')};

/** Placeholder parameters per message (\`undefined\` when the text has none). */
export interface MessageParams {
${rows.map((r) => `  ${JSON.stringify(r.id)}: ${paramType(r)};`).join('\n')}
}
`;
}

export function genCopy({ check }) {
  return emit(OUT, renderCopy(parseCopy(fs.readFileSync(abs(SOURCE), 'utf8'))), { check });
}
