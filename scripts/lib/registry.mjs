// Reads the dependency registry (specs/40-technical/dependencies.md, ADR-0001).
import fs from 'node:fs';
import path from 'node:path';
import { abs, tableCells } from './util.mjs';

export const REGISTRY = 'specs/40-technical/dependencies.md';
const NPM_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/;

/**
 * The SPDX expression of a registry licence cell, without its notes: "OFL-1.1 (copyright + …)" →
 * "OFL-1.1"; "MIT OR Apache-2.0; its sharp pulls …" → "MIT OR Apache-2.0". (Adapted from DAFV, whose
 * licence cells hold the bare id.)
 */
export const spdxOf = (cell) =>
  cell
    .replace(/\(.*?\)/g, '')
    .split(';')[0]
    .trim();

/** All DEP rows: { id, label, names[], range, license (SPDX), licenseNote, kind, purpose, status }. */
export function readRegistry() {
  const md = fs.readFileSync(abs(REGISTRY), 'utf8');
  const rows = [];
  for (const line of md.split('\n')) {
    const c = tableCells(line);
    if (!c || c.length < 7) continue;
    const m = /^\*\*(DEP-\d+)\*\*$/.exec(c[0]);
    if (!m) continue;
    // npm names come from backtick-quoted spans (e.g. "ExcelJS (`exceljs`)") and from the bare,
    // comma-separated label text once parentheticals are stripped; keep only valid npm names.
    const backticked = [...c[1].matchAll(/`([^`]+)`/g)].map((x) => x[1].trim());
    const bare = c[1]
      .replace(/\(.*?\)/g, '')
      .split(',')
      .map((s) => s.trim());
    const names = [...new Set([...backticked, ...bare])].filter(
      (s) => NPM_NAME.test(s) && !/\.(json|md|txt|css|m?js|m?ts|ya?ml|html)$/i.test(s),
    );
    rows.push({
      id: m[1],
      label: c[1],
      names,
      range: c[2],
      license: spdxOf(c[3]),
      licenseNote: c[3],
      kind: c[4],
      purpose: c[5],
      status: c[6],
    });
  }
  return rows;
}

/** Is the row active (not removed/rejected, not a recorded-only alternative/fallback)? */
export const isActive = (r) => !/removed|rejected|spike only|not adopted|alternative|fallback/i.test(r.status);
/** Is the row shipped to the browser (runtime code or asset)? */
export const isShipped = (r) => /^(runtime|asset)/i.test(r.kind) && !/not adopted/i.test(r.kind);

/** Is the row a production transitive that is installed but tree-shaken out of every bundle? */
export const isUnbundled = (r) => /^unbundled/i.test(r.kind);

/** Installed copy of an npm package anywhere in node_modules (top level or pnpm store). */
export function findInstalled(name) {
  const top = abs('node_modules', name, 'package.json');
  if (fs.existsSync(top)) return path.dirname(top);
  const store = abs('node_modules/.pnpm');
  if (!fs.existsSync(store)) return null;
  const prefix = name.replace('/', '+') + '@';
  const hits = fs
    .readdirSync(store)
    .filter((d) => d.startsWith(prefix))
    .sort();
  for (const d of hits.reverse()) {
    const dir = path.join(store, d, 'node_modules', name);
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  }
  return null;
}
