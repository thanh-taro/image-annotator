// MOD-Host — theme, language, origin-checked messaging, ready signal, offline service worker
// (specs/40-technical/modules/MOD-Host.md, ADR-0010, ADR-0011, ADR-0015). Only this module reaches the
// parent window or the service worker (lint-enforced).
// Phase 3.3 scaffold: language resolution (./language.ts) and the boot script (./boot.js) are real,
// because the shell needs them before first paint; messaging, the ready signal and offline throw
// until F-015, F-017 and F-018 are built.
import { signal } from '@preact/signals';

export { matchLanguage, resolveLanguage } from './language';

export type Theme = 'light' | 'dark';

/** The compiled-in allow-list of host origins (HOST_ORIGINS, vite.config.ts; RULE-16, NFR-09). */
export const HOST_ORIGINS: readonly string[] = __HOST_ORIGINS__;

/** The current theme, as the boot script set it on <html data-theme>. */
export const theme = signal<Theme>(
  typeof document !== 'undefined' && document.documentElement.dataset['theme'] === 'light' ? 'light' : 'dark',
);
/** Embedded in a host frame, or standalone (PRN-05); set by `startHost` (F-015). */
export const embedded = signal(false);
/** Whether the tool has keyboard focus (click-to-paste hint, F-001.R9); set by `startHost`. */
export const hasFocus = signal(true);

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Host ${name}`);
};

/** Origin-checked settings messages and the single ready signal (RULE-16, F-015, F-018). */
export function startHost(): void {
  notImplemented('startHost');
}

/** Registers and seeds the offline service worker after first render (ADR-0011, F-017). */
export function startOffline(_ready: Promise<unknown>): void {
  notImplemented('startOffline');
}
