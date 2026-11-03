// MOD-Host — the tool's typefaces as part of the initial load (ADR-0015 §6, ADR-0011).
// Implements: F-018.R7 (Vietnamese letters render in the tool's own typeface, in every language,
// with no font request after the load, NFR-01). The browser fetches a @font-face only when text
// needs it, so both subsets of both families are requested explicitly at startup; the offline seed
// (F-017) then caches them.

/** One Latin and one Vietnamese letter: covers the unicode-range of both subsets (fonts.css). */
const SAMPLE = 'A\u0110';
const FACES = ['500 1em Manrope', '500 1em "JetBrains Mono"'];

/** Loads every face the UI and text annotations may use; resolves when they are loaded or failed. */
export function loadFonts(): Promise<unknown> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  return Promise.allSettled(FACES.map((face) => document.fonts.load(face, SAMPLE)));
}
