// Host/offline harness smoke (phase 3.3 scaffold; SP-host, ADR-0010): the release build served with its
// generated headers on one local origin, a stub host page on a second one. It proves the harness works:
// the CSP-hashed boot script runs under the real CSP, the stub host can embed the allowed build, other
// origins and the empty-list build are refused, and the server-side request log sees only the tool's
// own files. The F-015 / F-017 / F-018 acceptance tests are written against this harness in phase 4.
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { HOST_ALLOWED, HOST_OTHER, TOOL_ALLOWED, TOOL_EMPTY, hostPageUrl } from '../support/urls';

const SHELL = '[data-screen="SCR-Annotator"]';

function consoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e: Error) => errors.push(e.message));
  return errors;
}

async function requestLog(page: Page, toolOrigin: string): Promise<{ path: string }[]> {
  const res = await page.request.get(`${toolOrigin}/__log/dump`);
  return (await res.json()) as { path: string }[];
}

test.beforeEach(async ({ page }) => {
  await page.request.get(`${TOOL_ALLOWED}/__log/reset`);
});

test('smoke: standalone under the production headers, the boot script runs and nothing else is fetched', async ({
  page,
}) => {
  const errors = consoleErrors(page);
  const response = await page.goto(`${TOOL_ALLOWED}/?theme=light&lang=vi-VN`);
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("connect-src 'none'");
  expect(csp).toContain(`frame-ancestors ${HOST_ALLOWED}`);
  await expect(page.locator(SHELL)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi-VN');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
  const paths = (await requestLog(page, TOOL_ALLOWED)).map((r) => r.path);
  expect(paths[0]).toBe('/');
  // The page, its hashed assets, and the browser's own favicon probe — all the tool's own origin.
  for (const p of paths.slice(1)) expect(p).toMatch(/^\/(assets\/[\w.-]+|favicon\.ico)$/);
});

test('smoke: the stub host on a second origin embeds the allowed build', async ({ page }) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'en-US'));
  const tool = page.frameLocator('#tool');
  await expect(tool.locator(SHELL)).toBeVisible();
  await expect(tool.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(tool.locator('html')).toHaveAttribute('lang', 'en-US');
});

test('smoke: an origin outside HOST_ORIGINS, and any origin for the empty-list build, cannot embed', async ({
  page,
}) => {
  await page.goto(hostPageUrl(HOST_OTHER, TOOL_ALLOWED, 'dark'));
  await page.waitForTimeout(500);
  await expect(page.frameLocator('#tool').locator(SHELL)).toHaveCount(0);

  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_EMPTY, 'dark'));
  await page.waitForTimeout(500);
  await expect(page.frameLocator('#tool').locator(SHELL)).toHaveCount(0);

  await page.goto(`${TOOL_EMPTY}/`);
  await expect(page.locator(SHELL)).toBeVisible();
});
