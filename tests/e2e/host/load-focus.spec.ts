// F-001.R9 focus when embedded (RULE-16, D-006) on the multi-origin harness: the click-to-paste hint
// while the host has not moved focus into the tool, and paste once it has — after a click, or after the
// host focuses the tool on its ready signal. Mod+V is pressed for real with an image written to the
// system clipboard where the engine allows it (Chromium); WebKit gives a page no clipboard write in
// automation, so there the paste event is the one the browser fires, dispatched in the focused frame.
import { expect, test, type Frame, type Page } from '@playwright/test';
import { HOST_ALLOWED, TOOL_ALLOWED, hostPageUrl } from '../support/urls';
import { fixture, paste } from '../support/load';
import { toolFrame } from './support';

const PNG = fixture('fmt.png', 'image/png');

/** Puts the PNG on the system clipboard (Chromium) and presses Mod+V; elsewhere dispatches the paste. */
async function pressPaste(page: Page, frame: Frame, browserName: string): Promise<void> {
  if (browserName === 'chromium') {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: HOST_ALLOWED });
    await page.evaluate(async (bytes) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    }, PNG.bytes);
    await page.keyboard.press('ControlOrMeta+v');
  } else {
    expect(await frame.evaluate(() => document.hasFocus())).toBe(true);
    await paste(frame, [PNG]);
  }
}

const summary = (page: Page) => page.frameLocator('#tool').locator('#tk-canvas-summary');

test('F-001.AC16 embedded without host focus: click-to-paste hint; a click then Mod+V loads the image', async ({
  page,
  browserName,
}) => {
  await page.goto(`${hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED)}&focus=0`);
  const frame = await toolFrame(page);
  const tool = page.frameLocator('#tool');
  await expect(tool.locator('.tk-empty__hint')).toHaveText(
    /^Click here, then press (Ctrl\+V|⌘V) to paste, or choose Open image\.$/,
  );
  expect(await frame.evaluate(() => document.hasFocus())).toBe(false);

  await tool.locator('.tk-empty__title').click();
  await expect(tool.locator('.tk-empty__hint')).toHaveText(/^Press (Ctrl\+V|⌘V) to paste a screenshot/);
  await pressPaste(page, frame, browserName);
  await expect(summary(page)).toHaveText('240 × 160 px canvas, 0 annotations');
});

test('F-001.AC17 embedded, the host moves focus in after the ready signal: Mod+V loads without a click', async ({
  page,
  browserName,
}) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED));
  const frame = await toolFrame(page);
  await expect.poll(() => frame.evaluate(() => document.hasFocus())).toBe(true);
  await expect(page.frameLocator('#tool').locator('.tk-empty__hint')).toHaveText(/^Press (Ctrl\+V|⌘V) to paste/);
  await pressPaste(page, frame, browserName);
  await expect(summary(page)).toHaveText('240 × 160 px canvas, 0 annotations');
});
