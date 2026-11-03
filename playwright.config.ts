// End-to-end tests (ADR-0012, ADR-0014): the production build on Chromium and WebKit, with axe
// (adapters/tests.md). Copied from DAFV. Run `pnpm build` first. Test titles start with the spec ID
// they verify (or `smoke:` for harness checks).
import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env['CI'];
const PORT = Number(process.env['E2E_PORT'] ?? 4173);

export default defineConfig({
  testDir: './tests/e2e',
  // The host-integration (F-015) and offline (F-017) specs under tests/e2e/host need the multi-origin
  // harness started by playwright.host-offline.config.ts (real CSP / frame-ancestors / service worker),
  // which `vite preview` cannot provide. They would fail here with ERR_CONNECTION_REFUSED, so the default
  // run excludes them; run them with `pnpm test:e2e:host` (docs/local-dev.md, adapters/tests.md).
  testIgnore: '**/host/**',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 30_000,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  // Serves the production build (dist/). Build it first: `pnpm build` (adapters/tests.md).
  webServer: {
    command: `pnpm preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
