// Fixed origins for the host-integration + offline harness (F-015/F-017, SP-host). Two distinct
// browser origins are obtained on one machine by pairing `localhost` with `127.0.0.1` and by using
// distinct ports; frame-ancestors / the compiled allow-list are built against exactly these. Ports are
// in the 429x range on purpose: WebKit refuses to connect to some otherwise-free ports it treats as
// unsafe (e.g. 4190 = ManageSieve), which would hang navigation.
export const HOST_ALLOWED = 'http://localhost:4290'; // the one configured host origin (may embed)
export const TOOL_ALLOWED = 'http://127.0.0.1:4291'; // the tool, built with HOST_ORIGINS=HOST_ALLOWED
export const HOST_OTHER = 'http://localhost:4292'; // a host origin NOT in the allow-list (refused)
export const TOOL_EMPTY = 'http://127.0.0.1:4293'; // the tool, built with an empty HOST_ORIGINS list

export const PORTS = { hostAllowed: 4290, toolAllowed: 4291, hostOther: 4292, toolEmpty: 4293 } as const;

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
