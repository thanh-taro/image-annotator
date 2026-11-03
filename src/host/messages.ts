// MOD-Host — the host contract's message checks as pure functions (RULE-16, ADR-0010, ADR-0021).
// Implements: F-015.R4 (accept settings only from an allowed origin and the embedding page),
// F-015.R5 (the ready signal is the only outbound message and carries no content), F-018.R4
// (language messages under the same checks; unsupported values are ignored, RULE-17).
import type { Language } from '../copy';
import { matchLanguage } from './language';

export type Theme = 'light' | 'dark';

/** An accepted settings message. */
export type Settings = { type: 'taro:theme'; value: Theme } | { type: 'taro:language'; value: Language };

/** The only message the tool ever sends the host (RULE-16): no content. */
export const READY_MESSAGE = Object.freeze({ type: 'taro:ready' as const });

/** The parts of a `MessageEvent` the checks read. */
export interface IncomingMessage {
  readonly data: unknown;
  readonly origin: string;
  readonly source: unknown;
}

/**
 * The settings carried by `event`, or null when it must be ignored: its origin is not in the
 * allow-list, it does not come from the embedding page (`parent`), or its type or value is not
 * one the contract defines (an unknown theme keeps the current one, F-015 edge case; an unsupported
 * language is ignored, RULE-17).
 */
export function acceptSettings(event: IncomingMessage, allow: readonly string[], parent: unknown): Settings | null {
  if (!allow.includes(event.origin)) return null;
  if (event.source == null || event.source !== parent) return null;
  const data = event.data;
  if (typeof data !== 'object' || data === null) return null;
  const { type, value } = data as { type?: unknown; value?: unknown };
  if (type === 'taro:theme' && (value === 'light' || value === 'dark')) return { type, value };
  if (type === 'taro:language') {
    const lang = matchLanguage(value);
    return lang ? { type, value: lang } : null;
  }
  return null;
}

/**
 * The target origins for the ready signal, never `'*'`: every allowed origin. `frame-ancestors`
 * already guarantees the parent is one of them, and the browser delivers a message only to a
 * matching target, so the parent's origin need not be known (a host frame with
 * `referrerpolicy="no-referrer"` masks it as "null" in `location.ancestorOrigins`).
 */
export function readyTargets(allow: readonly string[]): string[] {
  return [...allow];
}
