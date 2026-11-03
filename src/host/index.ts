// MOD-Host — theme, language, origin-checked messaging, ready signal, offline service worker
// (specs/40-technical/modules/MOD-Host.md, ADR-0010, ADR-0011, ADR-0015, ADR-0021). Only this module
// reaches the parent window or the service worker (lint-enforced).
// Implements: F-015.R1/R2/R4/R5 (RULE-16), F-018.R1/R2/R4/R7 (RULE-17, ADR-0015). Offline (F-017)
// still throws until it is built.
import { signal } from '@preact/signals';
import { language, t, type Language } from '../copy';
import { acceptSettings, READY_MESSAGE, readyTargets, type Settings, type Theme } from './messages';

export { loadFonts } from './fonts';
export { matchLanguage, resolveLanguage } from './language';
export type { Theme } from './messages';

/** The compiled-in allow-list of host origins (HOST_ORIGINS, vite.config.ts; RULE-16, NFR-09). */
export const HOST_ORIGINS: readonly string[] = __HOST_ORIGINS__;

/** The current theme, as the boot script set it on <html data-theme>. */
export const theme = signal<Theme>(
  typeof document !== 'undefined' && document.documentElement.dataset['theme'] === 'light' ? 'light' : 'dark',
);
/** Embedded in a host frame, or standalone (PRN-05); set by `startHost`. */
export const embedded = signal(false);
/** Whether the tool has keyboard focus (click-to-paste hint, F-001.R9); set by `startHost`. */
export const hasFocus = signal(true);

let started = false;
/** True once the theme came from the host (address or message): the device preference no longer applies. */
let hostOwnsTheme = false;

function addressParams(): URLSearchParams {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
}

// Implements: F-015.R1 (switch live, no reload; the theme never touches annotations or the export, INV-05).
function setTheme(next: Theme): void {
  theme.value = next;
  if (document.documentElement.dataset['theme'] !== next) document.documentElement.dataset['theme'] = next;
}

// Implements: F-018.R2 (switch live: components re-render from the signal with their state intact;
// nothing is announced and focus does not move), ADR-0015 §7 (title on every switch).
function setLanguage(next: Language): void {
  if (language.value === next && document.documentElement.lang === next) return; // same value twice: no-op
  language.value = next;
  document.documentElement.lang = next;
  document.title = t('app.title');
}

function apply(settings: Settings): void {
  if (settings.type === 'taro:theme') {
    hostOwnsTheme = true;
    setTheme(settings.value);
  } else {
    setLanguage(settings.value);
  }
}

/**
 * Starts the host contract after first render: follows the device preference while the host has
 * not set a theme, tracks focus, accepts origin-checked settings messages and posts the single
 * ready signal (RULE-16, F-015). Never moves focus (F-001.R9).
 */
export function startHost(): void {
  if (started) return;
  started = true;

  // Implements: F-015.R2 (standalone, or a host that never sends a theme: follow the device).
  const fromAddress = addressParams().get('theme');
  hostOwnsTheme = fromAddress === 'light' || fromAddress === 'dark';
  const light = matchMedia('(prefers-color-scheme: light)');
  light.addEventListener('change', (e) => {
    if (!hostOwnsTheme) setTheme(e.matches ? 'light' : 'dark');
  });

  hasFocus.value = document.hasFocus();
  window.addEventListener('focus', () => (hasFocus.value = true));
  window.addEventListener('blur', () => (hasFocus.value = false));

  embedded.value = window.parent !== window;
  if (!embedded.value) return;

  // Implements: F-015.R4 (allowed origin and the embedding page only, ADR-0010).
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    const settings = acceptSettings(event, HOST_ORIGINS, window.parent);
    if (settings) apply(settings);
  });

  // Implements: F-015.R5 (one ready signal, no content, never to '*').
  for (const origin of readyTargets(HOST_ORIGINS)) window.parent.postMessage(READY_MESSAGE, origin);
}

/** Registers and seeds the offline service worker after first render (ADR-0011, F-017). */
export function startOffline(_ready: Promise<unknown>): void {
  throw new Error('not implemented: MOD-Host startOffline');
}
