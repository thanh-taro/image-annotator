// dist/ scan (ADR-0001 rule 6, MOD-Build): the one gate that proves what actually SHIPS.
// From the hidden source maps it collects every third-party package whose code reached a shipped
// JS/CSS chunk, and fails when any of them is not a registered runtime/asset row or carries a
// license outside the shipped allow-list. Font files must trace to a shipped font asset package;
// unknown binary file types fail. This is what makes "nothing copyleft ships at runtime" true.
// Adapted from DAFV: fonts must also be one of the startup subsets (latin, vietnamese; no latin-ext,
// D-025, ADR-0015 §6), and the script runs on its own as `pnpm check:dist` (MOD-Build).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abs } from './lib/util.mjs';
import { findInstalled, isActive, isShipped, readRegistry } from './lib/registry.mjs';

const CODE_MAP = /\.(?:js|css)\.map$/;
const NODE_MODULES = /node_modules\/((?:@[^/]+\/)?[^/@][^/]*)/g;
const FONT_EXT = /\.(woff2?|ttf|otf|eot)$/i;
/** The only font subsets the tool ships (ADR-0015 §6, D-025). */
const FONT_SUBSET = /-(latin|vietnamese)-wght-normal-[\w-]+\.woff2$/;
const KNOWN_EXT = new Set(['.js', '.css', '.map', '.html', '.txt', '.json', '.svg', '.webmanifest', '.ico']);

/** Every file under a directory, as paths relative to it. */
function walk(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

const SHIPPED_LICENSES = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Apache-2.0',
  'Unlicense',
  'CC0-1.0',
  'BlueOak-1.0.0',
  'Python-2.0',
]);
const FONT_LICENSES = new Set(['OFL-1.1']);

/** @returns {{ shipped: Map<string,string>, problems: string[] }} */
export function scanDist(distDir, registry) {
  const problems = [];
  const files = walk(distDir);
  const registered = new Map(registry.flatMap((r) => r.names.map((n) => [n, r])));

  // Packages whose code reached a shipped chunk, read from the hidden source maps.
  const shipped = new Map();
  for (const f of files.filter((f) => CODE_MAP.test(f))) {
    let map;
    try {
      map = JSON.parse(fs.readFileSync(path.join(distDir, f), 'utf8'));
    } catch {
      problems.push(`unreadable source map: ${f}`);
      continue;
    }
    for (const src of map.sources ?? []) {
      for (const m of String(src).matchAll(NODE_MODULES)) {
        const name = m[1];
        if (name === '.pnpm') continue; // pnpm store directory, not a package
        if (!shipped.has(name)) {
          const dir = findInstalled(name);
          const version = dir ? JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version : '?';
          shipped.set(name, version);
        }
      }
    }
  }

  for (const [name, version] of shipped) {
    const r = registered.get(name);
    if (!r || !isShipped(r)) {
      problems.push(`${name}@${version} ships but is not a registered runtime/asset row`);
      continue;
    }
    const ok = SHIPPED_LICENSES.has(r.license) || (FONT_LICENSES.has(r.license) && /asset/i.test(r.kind));
    if (!ok) problems.push(`${name}@${version} ships with license ${r.license} (not in the shipped allow-list)`);
  }

  // Registered font asset packages (OFL), by their family name (`@fontsource-variable/manrope` →
  // `manrope`): every shipped font file must trace to one of them (the font files are emitted with
  // the family as a filename prefix, e.g. `manrope-latin-wght-normal-*.woff2`).
  const fontFamilies = registry
    .filter((r) => /asset/i.test(r.kind) && FONT_LICENSES.has(r.license))
    .flatMap((r) => r.names)
    .map((n) => n.split('/').pop() ?? n);

  // Non-code files that actually ship (source maps and the Vite manifest are stripped on deploy).
  for (const f of files) {
    if (CODE_MAP.test(f) || f.startsWith('.vite' + path.sep) || f === '.vite') continue;
    const ext = path.extname(f).toLowerCase();
    if (FONT_EXT.test(f)) {
      const base = path.basename(f);
      if (!fontFamilies.some((fam) => base.startsWith(fam + '-')))
        problems.push(`font file ships without a registered font asset package: ${f}`);
      else if (!FONT_SUBSET.test(base)) problems.push(`font subset not allowed (latin + vietnamese only, D-025): ${f}`);
    } else if (ext && !KNOWN_EXT.has(ext)) {
      problems.push(`unexpected shipped file type: ${f}`);
    }
  }

  problems.push(...noticesProblems(distDir, files, shipped));
  return { shipped, problems };
}

/** ADR-0025.3: the hashed notices file under assets/. */
export const NOTICES_FILE = /^assets\/third-party-notices-[\w-]+\.txt$/;

/**
 * ADR-0001 rule 6 and ADR-0025.3: exactly one notices file ships, as a hashed file under /assets/ that
 * the page's `tk-assets` list names (so the offline copy holds it, F-017.R1) and the page links to; it
 * names every third-party package that ships. No unhashed copy at the old `/third-party-notices.txt`.
 */
export function noticesProblems(distDir, files, shipped) {
  const problems = [];
  const posix = files.map((f) => f.split(path.sep).join('/'));
  if (posix.includes('third-party-notices.txt'))
    problems.push('third-party-notices.txt ships unhashed (ADR-0025.3: only under assets/)');
  const notices = posix.filter((f) => NOTICES_FILE.test(f));
  if (notices.length !== 1) {
    problems.push(`expected one assets/third-party-notices-<hash>.txt, found ${notices.length}`);
    return problems;
  }
  const url = '/' + notices[0];
  const html = fs.existsSync(path.join(distDir, 'index.html'))
    ? fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
    : '';
  const listed = /<meta name="tk-assets" content="([^"]*)"/.exec(html)?.[1]?.split(/\s+/) ?? [];
  if (!listed.includes(url)) problems.push(`${url} is not listed in the page's tk-assets (ADR-0025.3)`);
  const linked = posix
    .filter((f) => /^assets\/[^/]+\.js$/.test(f))
    .some((f) => fs.readFileSync(path.join(distDir, f), 'utf8').includes(url));
  if (!linked) problems.push(`no shipped script links to ${url} (F-016 privacy details)`);
  const text = fs.readFileSync(path.join(distDir, notices[0]), 'utf8');
  for (const [name] of shipped)
    if (!text.includes(`${name} `)) problems.push(`${url} does not name ${name}, which ships (ADR-0001)`);
  return problems;
}

// CLI: `pnpm check:dist` (after `pnpm build`).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = abs('dist');
  if (!fs.existsSync(dist)) {
    console.error('✗ dist/ missing: run `pnpm build` first');
    process.exit(1);
  }
  const { shipped, problems } = scanDist(dist, readRegistry().filter(isActive));
  const list = [...shipped].map(([n, v]) => `${n}@${v}`).sort();
  console.log(`dist: ${shipped.size} third-party packages ship — ${list.length ? list.join(', ') : '(none)'}`);
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log("dist: only the tool's own files and registered runtime/asset packages");
}
