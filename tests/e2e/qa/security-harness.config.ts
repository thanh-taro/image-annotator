// QA security (phase 5): the network-log checks (NFR-01, INV-04, F-017 security m3, NFR-09) on the
// multi-origin harness, isolated from the F-015/F-017 suite: its own build directory (dist-e2e/qa-security)
// and its own four ports (E2E_HOST_PORT_BASE, default 28800), so it can run while other suites do.
//   pnpm exec playwright test -c tests/e2e/qa/security-harness.config.ts
// The spec skips itself under the default config (no harness there).
import { defineConfig, devices } from '@playwright/test';

// Set before anything imports tests/e2e/support/urls.ts (the setup and the workers read it).
process.env['E2E_HOST_PORT_BASE'] ??= '28800';
process.env['E2E_QA_HARNESS'] = '1';

export default defineConfig({
  testDir: '.',
  testMatch: 'security-network.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  globalSetup: './security-harness.setup.ts',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
