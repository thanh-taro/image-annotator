// F-014.R1 / AC7 embedded (RULE-16, ADR-0021) on the multi-origin harness: the stub host grants leave-page
// dialogs (`allow-modals`, the portal's `dialogs` permission), so with unexported changes closing the tab
// asks whether to leave; without them it doesn't (R2). WebKit never shows the warning from an embedded page,
// whatever the sandbox (ADR-0021): accepted for M-1 (D-028), so these run on Chromium only.
import { expect, test, type Page } from '@playwright/test';
import { fixture, paste } from '../support/load';
import { HOST_ALLOWED, TOOL_ALLOWED, hostPageUrl } from '../support/urls';
import { toolFrame } from './support';

const summaryText = (n: number) => `240 × 160 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;

/** Closes the tab, running the leave handlers: 'warned' if the browser asks (dismissed), else 'closed'. */
async function closeTab(page: Page): Promise<'warned' | 'closed'> {
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

/** Opens the stub host with the tool embedded and pastes an image into it. */
async function openEmbedded(page: Page) {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'light', 'en-US'));
  const frame = await toolFrame(page);
  await paste(frame, [fixture('fmt.png', 'image/png')]);
  const tool = page.frameLocator('#tool');
  await expect(tool.locator('#tk-canvas-summary')).toHaveText(summaryText(0));
  return tool;
}

test.describe('F-014 embedded leave-page warning', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName === 'webkit',
      'WebKit never shows the leave-page warning from an embedded page (ADR-0021, D-028)',
    );
  });

  test('F-014.AC7 embedded in a host that allows leave-page dialogs, with unexported changes, closing the tab asks', async ({
    page,
  }) => {
    const tool = await openEmbedded(page);
    // A user gesture inside the frame (browsers ask only after one) that adds a rectangle (RULE-19 R, Enter).
    await tool.locator('main.tk-work-area').focus();
    await page.keyboard.press('r');
    await page.keyboard.press('Enter');
    await expect(tool.locator('#tk-canvas-summary')).toHaveText(summaryText(1));
    expect(await closeTab(page)).toBe('warned');
    expect(page.isClosed()).toBe(false);
  });

  test('F-014.R2 embedded, an image with no unexported changes: closing the tab shows no warning', async ({ page }) => {
    const tool = await openEmbedded(page);
    await tool.locator('main.tk-work-area').focus();
    await page.keyboard.press('Escape'); // a gesture that changes nothing
    expect(await closeTab(page)).toBe('closed');
  });
});
