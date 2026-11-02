// MOD-Host — language resolution (RULE-17, ADR-0015 §1) as pure functions, shared by the app and
// mirrored in the classic boot script (src/host/boot.js); both are covered by the same unit cases.
// Implements: RULE-17 (matching and the order address → browser → en-US).
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../copy';

/**
 * A language value as a supported language: equal ignoring case, else the same primary language
 * (`vi`, `vi-vn` → vi-VN; `en-GB` → en-US); anything else is unsupported (null).
 */
export function matchLanguage(value: unknown): Language | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const v = value.trim().toLowerCase();
  const exact = LANGUAGES.find((l) => l.toLowerCase() === v);
  if (exact) return exact;
  const primary = v.split(/[-_]/)[0];
  return LANGUAGES.find((l) => l.toLowerCase().split('-')[0] === primary) ?? null;
}

/**
 * The starting language: the supported value in the address, else the first matching browser
 * preference, else en-US (RULE-17). Host messages override it later (not handled here).
 */
export function resolveLanguage(addressValue: string | null, preferred: readonly string[]): Language {
  const fromAddress = matchLanguage(addressValue);
  if (fromAddress) return fromAddress;
  for (const p of preferred) {
    const m = matchLanguage(p);
    if (m) return m;
  }
  return DEFAULT_LANGUAGE;
}
