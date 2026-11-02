// MOD-Build — the offline service worker in the build (ADR-0011). Adapted from DAFV: emits
// src/host/sw.ts as the stable, unhashed /sw.js (its headers: scripts/gen-headers.mjs) and checks
// that it is a classic script. There are no lazy chunks to keep out of the seed (ADR-0003), so the
// seed list is simply every file the page loaded (MOD-Host builds it at runtime, F-017).
import { abs } from './util.mjs';

export const SW_SOURCE = 'src/host/sw.ts';
export const SW_FILE = 'sw.js';

/** @returns {import('vite').Plugin} */
export function offline() {
  let build = false;
  return {
    name: 'tk-offline',
    enforce: 'post',
    config: (_config, { command }) => {
      build = command === 'build';
    },
    buildStart() {
      if (build) this.emitFile({ type: 'chunk', id: abs(SW_SOURCE), fileName: SW_FILE });
    },
    generateBundle(_options, bundle) {
      if (!build) return;
      const sw = bundle[SW_FILE];
      if (!sw || sw.type !== 'chunk') throw new Error(`offline: ${SW_FILE} was not emitted`);
      if (/^\s*(import|export)\b/m.test(sw.code)) {
        throw new Error(`offline: ${SW_FILE} must be a classic script (it imports code shared with the page)`);
      }
    },
  };
}
