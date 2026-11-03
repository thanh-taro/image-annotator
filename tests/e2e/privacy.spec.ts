// F-016 Show the privacy guarantee (CMP-StatusBar, D-009, ADR-0010) on `pnpm preview` of dist/:
// the privacy statement and source link in the status bar at every layout width, the details
// popover and its dismissal, and the source link opening the repository in a new tab with no
// referrer. GitHub is never contacted: the new tab's request is answered by a local route.
// Partly deferred: AC4's "image, annotations and history unchanged" needs a loaded, annotated image
// (F-001, F-003, F-009); until then the test checks that the page keeps its window and session.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const REPO = 'https://github.com/thanh-taro/image-annotator';
const BADGE = 'Runs locally, nothing uploaded';
const BADGE_LABEL = 'Privacy: runs locally, nothing uploaded';
const DETAILS_START = 'Your images are opened and edited only in this browser.';
const SOURCE = 'Source code on GitHub';

const statusBar = (page: Page) => page.locator('.tk-status-bar');
const badge = (page: Page) => statusBar(page).locator('button[aria-haspopup="dialog"]');
const sourceLink = (page: Page) => statusBar(page).getByRole('link', { name: new RegExp(`^${SOURCE}`) });
const details = (page: Page) => page.getByRole('dialog', { name: 'Privacy' });

async function noHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bar: (() => {
      const bar = document.querySelector('.tk-status-bar') as HTMLElement;
      return bar.scrollWidth - bar.clientWidth;
    })(),
  }));
  expect(overflow.page).toBeLessThanOrEqual(0);
  expect(overflow.bar).toBeLessThanOrEqual(0);
}

async function axe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
}

for (const theme of ['dark', 'light'] as const) {
  test(`F-016.AC1 the status area shows the privacy statement (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 760 });
    await page.goto(`/?theme=${theme}`);
    await expect(badge(page)).toBeVisible();
    await expect(badge(page).getByText(BADGE, { exact: true })).toBeVisible();
    await expect(badge(page)).toHaveAccessibleName(BADGE);
    await axe(page);
  });
}

test('F-016.AC1 the statement is in the active language (vi-VN)', async ({ page }) => {
  await page.goto('/?lang=vi');
  await expect(badge(page).getByText('Chạy trên máy, không tải lên', { exact: true })).toBeVisible();
  await expect(badge(page)).toHaveAccessibleName('Chạy trên máy, không tải lên');
  await expect(statusBar(page).getByRole('link', { name: 'Mã nguồn trên GitHub (mở trong thẻ mới)' })).toBeVisible();
  await badge(page).click();
  await expect(page.getByRole('dialog', { name: 'Quyền riêng tư' })).toContainText(
    'Ảnh của bạn chỉ được mở và chỉnh sửa trong trình duyệt này.',
  );
});

test('F-016.AC1 at narrow widths the statement is an icon named with the privacy label', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto('/');
  await expect(badge(page)).toBeVisible();
  await expect(badge(page)).toHaveAccessibleName(BADGE_LABEL);
  // Icon only: the visible words are hidden.
  await expect(badge(page).getByText(BADGE, { exact: true })).toBeHidden();
});

for (const theme of ['dark', 'light'] as const) {
  test(`F-016.AC2 activating the statement shows the details, and Close dismisses them (${theme})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 760 });
    await page.goto(`/?theme=${theme}`);
    await expect(details(page)).toHaveCount(0);
    await expect(badge(page)).toHaveAttribute('aria-expanded', 'false');

    await badge(page).click();
    await expect(details(page)).toBeVisible();
    await expect(badge(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(details(page)).toContainText(DETAILS_START);
    await expect(details(page)).toContainText('use solid redaction for secrets.');
    const notices = details(page).getByRole('link', { name: /^Open-source notices/ });
    await expect(notices).toHaveAttribute('href', '/third-party-notices.txt');
    await expect(notices).toHaveAttribute('target', '_blank');
    await expect(notices).toHaveAttribute('rel', 'noopener noreferrer');
    // The popover stays inside the tool.
    const box = await details(page).boundingBox();
    expect(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1200).toBe(true);
    await axe(page);

    await details(page).getByRole('button', { name: 'Close' }).click();
    await expect(details(page)).toHaveCount(0);
    await expect(badge(page)).toBeFocused();
    await expect(badge(page)).toHaveAttribute('aria-expanded', 'false');
  });
}

test('F-016.AC2 the keyboard opens the details and Esc dismisses them, returning focus', async ({ page }) => {
  await page.goto('/');
  await badge(page).focus();
  await page.keyboard.press('Enter');
  await expect(details(page)).toBeVisible();
  // Focus moves into the details.
  expect(await details(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(details(page)).toHaveCount(0);
  await expect(badge(page)).toBeFocused();
});

test('F-016.AC2 activating the statement again or clicking outside dismisses the details', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 760 });
  await page.goto('/');
  await badge(page).click();
  await expect(details(page)).toBeVisible();
  await badge(page).click();
  await expect(details(page)).toHaveCount(0);

  await badge(page).click();
  await expect(details(page)).toBeVisible();
  await page.locator('.tk-work-area').click({ position: { x: 200, y: 200 } });
  await expect(details(page)).toHaveCount(0);
});

test('F-016.AC2 at 320 px the details fit the tool with gutters', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/');
  await badge(page).click();
  await expect(details(page)).toBeVisible();
  const box = await details(page).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(16 - 0.5);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320 - 16 + 0.5);
  await noHorizontalScroll(page);
  await axe(page);
});

for (const width of [320, 390, 900, 1200]) {
  test(`F-016.AC3 the source link is next to the statement with no horizontal scroll (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 760 });
    await page.goto('/');
    const link = sourceLink(page);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', REPO);
    await expect(link).toHaveAccessibleName(`${SOURCE} (opens in a new tab)`);
    // Next to the statement: same row, directly after it.
    const [b, l] = await Promise.all([badge(page).boundingBox(), link.boundingBox()]);
    expect(b && l).toBeTruthy();
    expect(Math.abs(b!.y + b!.height / 2 - (l!.y + l!.height / 2))).toBeLessThanOrEqual(1);
    expect(l!.x).toBeGreaterThanOrEqual(b!.x + b!.width - 0.5);
    expect(l!.x - (b!.x + b!.width)).toBeLessThanOrEqual(16);
    expect(l!.x + l!.width).toBeLessThanOrEqual(width);
    await noHorizontalScroll(page);
  });
}

test('F-016.AC4 the source link opens the repository in a new tab with no referrer and keeps the session', async ({
  page,
  context,
}) => {
  // Never reach the real site: answer the repository request locally and record its headers.
  const seen: { url: string; referer: string | undefined }[] = [];
  await context.route('https://github.com/**', async (route) => {
    seen.push({ url: route.request().url(), referer: route.request().headers()['referer'] });
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>repo</title>' });
  });
  await page.goto('/');
  await page.evaluate(() => ((window as unknown as { __mark?: number }).__mark = 42));
  const before = page.url();

  const [tab] = await Promise.all([context.waitForEvent('page'), sourceLink(page).click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toBe(REPO);
  expect(seen.map((s) => s.url)).toEqual([REPO]);
  expect(seen[0]!.referer).toBeUndefined();
  expect(await tab.evaluate(() => document.referrer)).toBe('');
  expect(await tab.evaluate(() => window.opener)).toBeNull();

  // The tool's own page is untouched: same window, same address, still showing the tool.
  expect(page.url()).toBe(before);
  expect(await page.evaluate(() => (window as unknown as { __mark?: number }).__mark)).toBe(42);
  await expect(page.locator('[data-screen="SCR-Annotator"]')).toBeVisible();
});
