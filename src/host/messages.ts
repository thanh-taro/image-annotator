// MOD-Host — the host contract's message checks as pure functions (RULE-16, ADR-0010, ADR-0021).
// Implements: F-015.R4 (accept settings only from an allowed origin and the embedding page),
// F-015.R5 (the ready signal is the only outbound message and carries no content).

export type Theme = 'light' | 'dark';

/** An accepted settings message. */
export type Settings = { type: 'taro:theme'; value: Theme };

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
 * one the contract defines (an unknown theme keeps the current one, F-015 edge case).
 */
export function acceptSettings(event: IncomingMessage, allow: readonly string[], parent: unknown): Settings | null {
  if (!allow.includes(event.origin)) return null;
  if (event.source == null || event.source !== parent) return null;
  const data = event.data;
  if (typeof data !== 'object' || data === null) return null;
  const { type, value } = data as { type?: unknown; value?: unknown };
  if (type === 'taro:theme' && (value === 'light' || value === 'dark')) return { type, value };
  return null;
}

/**
 * The target origins for the ready signal, never `'*'`: the embedding page's origin when the
 * browser reports it (`location.ancestorOrigins`) and it is allowed; without that report (Gecko),
 * every allowed origin, since the browser delivers a message only to a matching target.
 */
export function readyTargets(allow: readonly string[], ancestors: readonly string[] | undefined): string[] {
  if (ancestors && ancestors.length > 0) {
    const parentOrigin = ancestors[0];
    return parentOrigin !== undefined && allow.includes(parentOrigin) ? [parentOrigin] : [];
  }
  return [...allow];
}
