// Fixed origins for the host-integration + offline harness (F-015/F-017, SP-host). Two distinct
// browser origins are obtained on one machine by pairing `localhost` with `127.0.0.1` and by using
// distinct ports; frame-ancestors / the compiled allow-list are built against exactly these. The ports
// come from ./ports.ts (per worktree, above WebKit's blocked-port list; E2E_HOST_PORT_BASE overrides).
import { HOST_PORT_BASE } from './ports';

export const PORTS = {
  hostAllowed: HOST_PORT_BASE,
  toolAllowed: HOST_PORT_BASE + 1,
  hostOther: HOST_PORT_BASE + 2,
  toolEmpty: HOST_PORT_BASE + 3,
} as const;

export const HOST_ALLOWED = `http://localhost:${PORTS.hostAllowed}`; // the one configured host origin (may embed)
export const TOOL_ALLOWED = `http://127.0.0.1:${PORTS.toolAllowed}`; // the tool, built with HOST_ORIGINS=HOST_ALLOWED
export const HOST_OTHER = `http://localhost:${PORTS.hostOther}`; // a host origin NOT in the allow-list (refused)
export const TOOL_EMPTY = `http://127.0.0.1:${PORTS.toolEmpty}`; // the tool, built with an empty HOST_ORIGINS list

/**
 * The stub-host page that embeds `tool` in an #tool iframe and relays theme and language messages. The
 * portal passes `theme` and `lang` in the tool's address (RULE-16, RULE-17).
 */
export function hostPageUrl(hostOrigin: string, tool: string, theme?: 'light' | 'dark', lang?: string): string {
  const q = new URLSearchParams();
  if (theme) q.set('theme', theme);
  if (lang !== undefined) q.set('lang', lang);
  const query = q.toString();
  const t = query ? `${tool}/?${query}` : tool;
  return `${hostOrigin}/host.html?tool=${encodeURIComponent(t)}`;
}
