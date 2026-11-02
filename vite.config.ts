// Build configuration (ADR-0003, MOD-Build). Copied from DAFV and adapted: no lazy chunks, the
// effects module worker (`worker.format: 'es'`), the inline boot script and the offline worker.
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
// @ts-expect-error -- plain ESM build script without type declarations
import { readBootScript } from './scripts/lib/boot.mjs';
// @ts-expect-error -- plain ESM build script without type declarations
import { hostOrigins } from './scripts/gen-headers.mjs';
// @ts-expect-error -- plain ESM build script without type declarations
import { offline } from './scripts/lib/offline.mjs';

/** Inlines the boot script (MOD-Host) at the top of <head>; its hash is in public/_headers. */
function bootScript(): Plugin {
  return {
    name: 'tk-boot-script',
    transformIndexHtml(html) {
      return html.replace('<!--boot-->', `<script>${readBootScript() as string}</script>`);
    },
  };
}

export default defineConfig({
  plugins: [preact(), bootScript(), offline() as Plugin],
  define: {
    __HOST_ORIGINS__: JSON.stringify(hostOrigins()),
  },
  build: {
    target: 'es2022',
    // The polyfill uses fetch, which `connect-src 'none'` blocks; all targets support modulepreload.
    modulePreload: { polyfill: false },
    manifest: true,
    // Hidden maps feed the dist licence scan (scripts/check-dist.mjs); .assetsignore keeps them off the host.
    sourcemap: 'hidden',
    assetsInlineLimit: 0,
  },
  worker: { format: 'es' },
  preview: { port: 4173, strictPort: true },
  server: { port: 5173, strictPort: true },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/property/**/*.test.ts'],
    environment: 'node',
  },
});
