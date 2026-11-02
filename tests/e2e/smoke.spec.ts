// E2E smoke for the SCR-Annotator frame (phase 3.3 scaffold, adapters/tests.md): the shell loads from
// `pnpm preview` of dist/ with no console errors, no requests to any other host, the boot script's
// theme and language on <html>, the tokens applied, and no axe violations.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type ConsoleMessage, type Request } from '@playwright/test';

for (const theme of ['dark', 'light'] as const) {
  test(`smoke: SCR-Annotator empty frame loads with no console errors and no other hosts (${theme})`, async ({
    page,
    baseURL,
  }) => {
    const errors: string[] = [];
    const requests: string[] = [];
    page.on('console', (m: ConsoleMessage) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e: Error) => errors.push(e.message));
    page.on('request', (r: Request) => requests.push(r.url()));

    await page.goto(`/?theme=${theme}&lang=vi`);
    const frame = page.locator('[data-screen="SCR-Annotator"]');
    await expect(frame).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi-VN');
    await expect(page).toHaveTitle('Image Annotator');
    await expect(page.locator('main')).toHaveAccessibleName('Vùng ảnh');

    // Tokens applied: the work area uses the theme's workArea colour (tokens.json).
    const workArea = await page.locator('.tk-work-area').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(workArea).toBe(theme === 'dark' ? 'rgb(11, 8, 18)' : 'rgb(236, 232, 244)');
    // The frame fills the page without a scrollbar of its own.
    const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.waitForLoadState('networkidle');
    const origin = new URL(baseURL ?? '').origin;
    expect(requests.filter((u) => !u.startsWith('data:') && new URL(u).origin !== origin)).toEqual([]);
    expect(errors).toEqual([]);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
