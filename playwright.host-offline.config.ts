// Copied from DAFV. Dedicated Playwright config for the host-integration (F-015) and offline (F-017) suite (SP-host).
// It builds two tool variants with real deploy headers and starts a multi-origin harness in
// globalSetup, so the tests exercise the actual CSP / frame-ancestors / origin checks and the service
// worker — none of which `vite preview` (the default config's webServer) can provide. Run with:
//   pnpm exec playwright test -c playwright.host-offline.config.ts --project=chromium
import { defineConfig, devices } from '@playwright/test';
import { HOST_PORT_BASE } from './tests/e2e/support/ports';

// One port base for the setup, the workers and the teardown (per worktree; tests/e2e/support/ports.ts).
process.env['E2E_HOST_PORT_BASE'] = String(HOST_PORT_BASE);

const CI = !!process.env['CI'];

export default defineConfig({
  testDir: './tests/e2e/host',
  fullyParallel: false, // the harness servers and fixed origins are shared across the suite
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 45_000,
  reporter: [['list']],
  globalSetup: './tests/e2e/support/global-setup.ts',
  globalTeardown: './tests/e2e/support/global-teardown.ts',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
