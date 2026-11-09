// F-014 Warn before losing work — standalone, on the production build (Chromium + WebKit; both show the
// leave-page warning from a top-level page, ADR-0021). Browsers show it only after the user has interacted
// with the page, so every case presses a key or clicks first, also the "no warning" ones (otherwise they
// would pass for the wrong reason). The embedded case (AC7) is in host/leave-embedded.spec.ts.
// Also COPY-action.clear (start over) with and without its confirmation (R3).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { copied, copyButton, notice, recordClipboard, toolbar } from './support/export';
import { summary } from './support/load';

const VIEWPORT = { width: 1472, height: 868 };
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const workArea = (page: Page) => page.locator('main.tk-work-area');
const more = (page: Page) => toolbar(page).getByRole('button', { name: 'More actions' });
const menu = (page: Page) => page.getByRole('menu', { name: 'More actions' });
const clearItem = (page: Page) => menu(page).getByRole('menuitem', { name: 'Start over' });
const dialog = (page: Page) => page.getByRole('alertdialog');
const live = (page: Page) => page.locator('.tk-sr[aria-live="polite"]');
const CLEARED = 'Image cleared. Open, paste or drop an image to start';
const summaryText = (n: number) => `400 × 300 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;

/** Pastes a plain 400 × 300 image (a dispatched paste: no user activation). */
async function pasteImage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const c = new OffscreenCanvas(400, 300);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, 400, 300);
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'shot.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(summary(page)).toHaveText(summaryText(0));
}

async function open(page: Page, query = ''): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`/${query}`);
  await pasteImage(page);
}

/** Gives the page a user gesture that changes nothing: Escape on the canvas (select tool, RULE-19). */
async function touch(page: Page): Promise<void> {
  await workArea(page).focus();
  await page.keyboard.press('Escape');
}

/** RULE-19 R then Enter on the canvas: a default rectangle, one undo step (and a user gesture). */
async function annotate(page: Page, n = 1): Promise<void> {
  await workArea(page).focus();
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await expect(summary(page)).toHaveText(summaryText(n));
}

/**
 * Closes the tab, running the page's leave handler: 'warned' if the browser asks (dismissed), else 'closed'.
 * Playwright's WebKit never finishes `close({ runBeforeUnload })` on a page with no `beforeunload` listener at
 * all (the tool registers none without unexported changes), so a listener that never asks is added first.
 */
async function closeTab(page: Page): Promise<'warned' | 'closed'> {
  await page.evaluate(() => addEventListener('beforeunload', () => {}));
  const outcome = new Promise<'warned' | 'closed'>((resolve) => {
    page.on('dialog', (d) => {
      if (d.type() !== 'beforeunload') return;
      resolve('warned');
      void d.dismiss();
    });
    page.once('close', () => resolve('closed'));
  });
  await page.close({ runBeforeUnload: true });
  return outcome;
}

test.describe('F-014 warn before losing work', () => {
  test('F-014.AC1 an annotated image not yet exported: reloading the tab asks whether to leave', async ({ page }) => {
    await open(page);
    await annotate(page);
    const asked = new Promise<string>((resolve) =>
      page.once('dialog', (d) => {
        resolve(d.type());
        void d.accept();
      }),
    );
    await page.reload();
    expect(await asked).toBe('beforeunload');
    // Leaving was accepted: the reloaded tool is empty (nothing is saved, PRN-01).
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
  });

  test('F-014.AC2 after copying with no change since, closing the tab shows no warning', async ({
    page,
    context,
    browserName,
  }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await recordClipboard(page);
    await open(page);
    await annotate(page);
    await copyButton(page).click();
    await copied(page);
    await expect(notice(page)).toContainText('Copied to clipboard.');
    expect(await closeTab(page)).toBe('closed');
  });

  test('F-014.AC3 an image loaded with no annotations: closing the tab shows no warning', async ({ page }) => {
    await open(page);
    await touch(page);
    expect(await closeTab(page)).toBe('closed');
  });

  test('F-014.AC5 after copying, one undo makes closing the tab ask whether to leave', async ({
    page,
    context,
    browserName,
  }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await recordClipboard(page);
    await open(page);
    await annotate(page);
    await copyButton(page).click();
    await copied(page);
    await expect(notice(page)).toContainText('Copied to clipboard.');
    await toolbar(page).getByRole('button', { name: 'Undo' }).click();
    await expect(summary(page)).toHaveText(summaryText(0));
    // RULE-18: back at the loaded state, but an undo since the export is a change.
    expect(await closeTab(page)).toBe('warned');
    expect(page.isClosed()).toBe(false);
  });

  test('F-014.AC4 with unexported changes, COPY-action.clear shows COPY-confirm.clear; confirming returns to the empty state', async ({
    page,
  }) => {
    await open(page);
    await annotate(page);
    await more(page).click();
    await clearItem(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole('heading')).toHaveText('Start over?');
    await expect(dialog(page)).toContainText(
      "Your changes haven't been copied or downloaded. They will be lost, and this can't be undone.",
    );
    // CMP-ConfirmDialog: focus on the safe choice; Esc keeps everything.
    await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(summary(page)).toHaveText(summaryText(1));
    await expect(more(page)).toBeFocused();
    // Confirming starts over: the empty state, nothing to undo (RULE-11), and leaving no longer warns.
    await more(page).click();
    await clearItem(page).click();
    await dialog(page).getByRole('button', { name: 'Start over' }).click();
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
    await expect(page.getByText('Paste, drop or open an image', { exact: false }).first()).toBeVisible();
    await expect(toolbar(page).getByRole('button', { name: 'Undo' })).toBeDisabled();
    // CMP-Canvas: starting over is announced politely (COPY-a11y.cleared).
    await expect(live(page)).toContainText(CLEARED);
    await expect(more(page)).toBeFocused();
    expect(await closeTab(page)).toBe('closed');
  });

  test('F-014.AC6 with no unexported changes, COPY-action.clear shows the empty state at once with no dialog', async ({
    page,
  }) => {
    await open(page);
    await more(page).click();
    await clearItem(page).click();
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
    await expect(live(page)).toContainText(CLEARED);
    // Paste works again in the empty state.
    await pasteImage(page);
  });

  test('F-014 edge case starting over closes the clipboard-error notice, so its Download action is gone', async ({
    page,
  }) => {
    await recordClipboard(page, { refuse: true });
    await open(page);
    await annotate(page);
    await copyButton(page).click();
    await expect(notice(page)).toContainText('The browser blocked copying the image. Download it instead.');
    await more(page).click();
    await clearItem(page).click();
    await dialog(page).getByRole('button', { name: 'Start over' }).click();
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test('F-014 edge case starting over closes the narrow style sheet; the next image shows without it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto('/');
    await pasteImage(page);
    const bar = page.getByRole('button', { name: /^Style options/ });
    await bar.click();
    await expect(bar).toHaveAttribute('aria-expanded', 'true');
    await more(page).click();
    await clearItem(page).click();
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
    await pasteImage(page);
    await expect(page.getByRole('button', { name: /^Style options/ })).toHaveAttribute('aria-expanded', 'false');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`NFR-06 F-014 the clear confirmation has no axe violations (${theme})`, async ({ page }) => {
      await open(page, `?theme=${theme}`);
      await annotate(page);
      await more(page).click();
      await clearItem(page).click();
      await expect(page.locator('[data-state="confirm-clear"]')).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations).toEqual([]);
    });
  }
});
