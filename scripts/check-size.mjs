// Size gate (NFR-05, architecture.md "Budgets and baselines", MOD-Build). Adapted from DAFV.
// Everything is on the critical path (no lazy chunks, ADR-0003, NFR-01), so every shipped JS/CSS
// file is counted, and the gate fails on any JS chunk that is not loaded at startup: a chunk must be
// referenced by dist/index.html (script / module preload) or be the effects worker. Compressed with
// gzip level 9; 1 KB = 1,000 bytes. WOFF2 is already compressed, so font files count as they are.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { abs } from './lib/util.mjs';

/** architecture.md "Startup" table (compressed). */
export const BUDGET = {
  html: 12_000,
  css: 18_000,
  js: 80_000,
  worker: 8_000,
  fonts: 90_000,
  total: 210_000,
};
/** The effects worker chunk (MOD-Effects), emitted by Vite's `new Worker(new URL(...))`. */
const WORKER_CHUNK = /^assets\/[\w.-]*worker[\w.-]*-[\w-]+\.js$/;
/** Startup font subsets of both faces (ADR-0015 §6; no latin-ext, D-025). */
const STARTUP_FONT = /^assets\/(manrope|jetbrains-mono)-(latin|vietnamese)-wght-normal-[\w-]+\.woff2$/;

const DIST = abs('dist');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('✗ dist/index.html missing: run `pnpm build` first');
  process.exit(1);
}
const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const kb = (n) => `${(n / 1000).toFixed(1)} KB`;
const html = fs.readFileSync(path.join(DIST, 'index.html'));
const refs = new Set(
  [...html.toString().matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="\/([^"]+)"/g)].map((m) => m[1]),
);
const assets = fs.existsSync(path.join(DIST, 'assets'))
  ? fs.readdirSync(path.join(DIST, 'assets')).map((f) => `assets/${f}`)
  : [];

const groups = { html: [['index.html', gz(html)]], css: [], js: [], worker: [], fonts: [] };
const problems = [];
for (const f of assets) {
  const buf = fs.readFileSync(path.join(DIST, f));
  if (f.endsWith('.css')) groups.css.push([f, gz(buf)]);
  else if (f.endsWith('.js')) {
    if (refs.has(f)) groups.js.push([f, gz(buf)]);
    else if (WORKER_CHUNK.test(f)) groups.worker.push([f, gz(buf)]);
    else problems.push(`${f}: JS chunk not loaded at startup (no lazy chunks, ADR-0003)`);
  } else if (STARTUP_FONT.test(f)) groups.fonts.push([f, buf.length]);
  else if (/\.woff2?$/.test(f)) problems.push(`${f}: font file outside the startup subsets (D-025)`);
}
for (const f of [...refs].filter((r) => r.endsWith('.css') && !assets.includes(r))) {
  problems.push(`${f}: referenced stylesheet missing`);
}
// A dynamic import() leaves a trace in the Vite manifest (ADR-0003: none allowed).
const manifestFile = path.join(DIST, '.vite', 'manifest.json');
if (fs.existsSync(manifestFile)) {
  for (const [key, entry] of Object.entries(JSON.parse(fs.readFileSync(manifestFile, 'utf8')))) {
    if (entry.dynamicImports?.length) problems.push(`${key}: dynamic import() (no lazy chunks, ADR-0003)`);
    if (entry.isDynamicEntry) problems.push(`${key}: lazy chunk (no lazy chunks, ADR-0003)`);
  }
}

const sums = Object.fromEntries(Object.entries(groups).map(([g, rows]) => [g, rows.reduce((s, [, n]) => s + n, 0)]));
sums.total = sums.html + sums.css + sums.js + sums.worker + sums.fonts;
for (const [g, rows] of Object.entries(groups)) {
  for (const [f, n] of rows) console.log(`${kb(n).padStart(9)}  ${f}`);
  if (!rows.length && g === 'worker') console.log(`${kb(0).padStart(9)}  (no effects worker chunk yet)`);
}
console.log('');
for (const g of ['html', 'css', 'js', 'worker', 'fonts', 'total']) {
  const over = sums[g] > BUDGET[g];
  if (over) problems.push(`${g}: ${kb(sums[g])} over the ${kb(BUDGET[g])} budget (NFR-05)`);
  console.log(`${over ? '✗' : '✓'} ${g.padEnd(6)} ${kb(sums[g]).padStart(9)} / ${kb(BUDGET[g])}`);
}
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log('size: within the architecture.md budgets; no lazy chunks');
