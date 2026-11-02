// MOD-Copy — generated user-facing strings, active language, number and plural formatting
// (specs/40-technical/modules/MOD-Copy.md, ADR-0013, ADR-0015). A dependency-free leaf: it imports no
// other module. The catalog is generated from copy.md by scripts/gen-copy.mjs (messages.gen.ts).
// Implements: RULE-17 (en-US default), F-018.R6 (numbers and plurals in the active language).
// It never formats anything that goes into the export (INV-05).
import { signal } from '@preact/signals';
import { CATALOG, LANGUAGES, PLURAL_IDS, type Language, type MessageId, type MessageParams } from './messages.gen';

export { LANGUAGES, type Language, type MessageId, type MessageParams } from './messages.gen';

/** RULE-17: the default language. */
export const DEFAULT_LANGUAGE: Language = LANGUAGES[0];

/** The active language; set by MOD-Host (address, then accepted host messages). */
export const language = signal<Language>(DEFAULT_LANGUAGE);

/** A number written for the active language (vi-VN `1.920`, F-018.R6). */
export function formatNumber(value: number, lang: Language = language.value): string {
  return new Intl.NumberFormat(lang).format(value);
}

type Args<K extends MessageId> = MessageParams[K] extends undefined ? [] : [params: MessageParams[K]];

/**
 * The text of a COPY string in the active language, with its placeholders filled. Numbers are
 * formatted for the language; a plural string picks its form by `{count}` (Intl.PluralRules).
 */
export function t<K extends MessageId>(id: K, ...args: Args<K>): string {
  return translate(language.value, id, ...args);
}

/** `t()` for an explicit language (tests and the language switch). */
export function translate<K extends MessageId>(lang: Language, id: K, ...args: Args<K>): string {
  const params = (args[0] ?? {}) as Record<string, string | number>;
  const entry = CATALOG[lang][id];
  let text: string;
  if (typeof entry === 'string') text = entry;
  else {
    const count = Number(params['count']);
    const category = PLURAL_IDS.has(id) ? new Intl.PluralRules(lang).select(count) : 'other';
    text = entry[category] ?? entry.other;
  }
  return text.replace(/\{([a-zA-Z]\w*)\}/g, (whole, name: string) => {
    const v = params[name];
    if (v === undefined) return whole;
    return typeof v === 'number' ? formatNumber(v, lang) : v;
  });
}
