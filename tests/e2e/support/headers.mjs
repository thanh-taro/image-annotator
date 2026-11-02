// Parse a Cloudflare `_headers` file and reproduce its header rules in the harness static server
// (ADR-0010), so the e2e tests see the real Content-Security-Policy, frame-ancestors and
// Permissions-Policy a deploy sends — not `vite preview`'s bare responses. Rules apply in order;
// a later matching rule adds/overrides, and `! Name` detaches a header an earlier rule set.
import fs from 'node:fs';

/** Parse `_headers` text into an ordered list of { pattern, test(pathname), directives }. */
export function parseHeaders(text) {
  const rules = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), directives: [] };
      rules.push(current);
      continue;
    }
    const body = line.trim();
    if (!current) continue;
    if (body.startsWith('! ')) {
      current.directives.push({ op: 'unset', name: body.slice(2).trim().toLowerCase() });
      continue;
    }
    const i = body.indexOf(':');
    if (i < 0) continue;
    current.directives.push({ op: 'set', name: body.slice(0, i).trim(), value: body.slice(i + 1).trim() });
  }
  for (const r of rules) r.test = globToTest(r.pattern);
  return rules;
}

function globToTest(pattern) {
  // Cloudflare globs: `*` matches any sequence; exact otherwise. `/*` → everything.
  const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return (pathname) => re.test(pathname);
}

/** The effective header map for a request path, applying every matching rule in file order. */
export function headersFor(rules, pathname) {
  const out = new Map(); // lower-case name → { name, value }
  for (const rule of rules) {
    if (!rule.test(pathname)) continue;
    for (const d of rule.directives) {
      if (d.op === 'unset') out.delete(d.name);
      else out.set(d.name.toLowerCase(), { name: d.name, value: d.value });
    }
  }
  return [...out.values()];
}

export function loadHeaders(path) {
  return parseHeaders(fs.readFileSync(path, 'utf8'));
}
