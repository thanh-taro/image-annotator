// F-015.R7 / F-012 export in the host frame (RULE-16, ADR-0021) on the multi-origin harness: with every
// frame grant the download is saved and the clipboard takes the image (on WebKit too, through the
// promised ClipboardItem); without the clipboard grant, a browser that enforces it (Chromium) refuses the
// copy and the tool offers the download (F-012.R5). WebKit copies without the grant (ADR-0021), so AC10
// runs on Chromium only.
import { expect, test } from '@playwright/test';
import { copied, download, expectCleanPng, recordClipboard } from '../support/export';
import { fixture, paste } from '../support/load';
import { HOST_ALLOWED, TOOL_ALLOWED, hostPageUrl } from '../support/urls';
import { toolFrame } from './support';

const summaryText = '240 × 160 px canvas, 0 annotations';

test('F-015.AC9 F-012.R1 F-012.R2 embedded with every grant: the download is saved and the clipboard holds the image', async ({
  page,
  context,
  browserName,
}) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await recordClipboard(page);
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'en-US'));
  const frame = await toolFrame(page);
  await paste(frame, [fixture('fmt.png', 'image/png')]);
  await expect(frame.locator('#tk-canvas-summary')).toHaveText(summaryText);
  const tool = page.frameLocator('#tool');
  const file = await download(page, () => tool.getByRole('button', { name: 'Download', exact: true }).click());
  expect(file.name).toMatch(/^annotated-\d{8}-\d{6}\.png$/);
  expect([expectCleanPng(file.bytes).width, expectCleanPng(file.bytes).height]).toEqual([240, 160]);
  await tool.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(tool.locator('.tk-notice')).toContainText('Copied to clipboard.');
  const png = expectCleanPng(await copied(frame));
  expect([png.width, png.height]).toEqual([240, 160]);
});

test('F-015.AC10 F-012.R5 embedded without the clipboard grant (Chromium enforces it): COPY-error.clipboard with download', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'WebKit copies without the grant (ADR-0021)');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(
    hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'en-US').replace('/host.html?', '/host.html?clipboard=0&'),
  );
  const frame = await toolFrame(page);
  await paste(frame, [fixture('fmt.png', 'image/png')]);
  await expect(frame.locator('#tk-canvas-summary')).toHaveText(summaryText);
  const tool = page.frameLocator('#tool');
  await tool.getByRole('button', { name: 'Copy', exact: true }).click();
  const notice = tool.locator('.tk-notice');
  await expect(notice).toContainText('The browser blocked copying the image. Download it instead.');
  // The download offered instead works: the frame still has its download grant.
  const file = await download(page, () => notice.getByRole('button', { name: 'Download', exact: true }).click());
  expectCleanPng(file.bytes);
});
