// MOD-Build — the offline service worker in the build (ADR-0011). Adapted from DAFV:
// - emits src/host/sw.ts as the stable, unhashed /sw.js (its headers: scripts/gen-headers.mjs) and
//   checks that it is a classic script;
// - lists every hashed file of the build (JS, CSS, the typefaces) in a `tk-assets` <meta> of
//   index.html, so the page can name files that are not page resources in every engine (the effects
//   worker) and the worker stores a page only once all of them are cached (F-017.R1);
// - compiles the page's registration in for production builds only (`__TK_OFFLINE__`).
// There are no lazy chunks (ADR-0003), so the list is the whole build.
import { abs } from './util.mjs';

export const SW_SOURCE = 'src/host/sw.ts';
export const SW_FILE = 'sw.js';
/** The <meta> naming every hashed file of the build (MOD-Host offline.ts and offline-policy.ts read it). */
export const ASSETS_META = 'tk-assets';

/** The build's hashed files (bundle keys), as absolute paths: everything under assets/ but source maps. */
export function assetList(fileNames) {
  return fileNames
    .filter((f) => /^assets\/[^/]+$/.test(f) && !f.endsWith('.map'))
    .sort()
    .map((f) => '/' + f);
}

/** @returns {import('vite').Plugin} */
export function offline() {
  let build = false;
  return {
    name: 'tk-offline',
    enforce: 'post',
    config: (_config, { command }) => {
      build = command === 'build';
      return { define: { __TK_OFFLINE__: JSON.stringify(build) } };
    },
    buildStart() {
      if (build) this.emitFile({ type: 'chunk', id: abs(SW_SOURCE), fileName: SW_FILE });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!build || !ctx.bundle) return html;
        const tag = `<meta name="${ASSETS_META}" content="${assetList(Object.keys(ctx.bundle)).join(' ')}" />`;
        return html.replace('</head>', `  ${tag}\n  </head>`);
      },
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
