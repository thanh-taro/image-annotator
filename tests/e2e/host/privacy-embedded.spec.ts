// F-016 in the host frame (edge case "Embedded in a host frame that doesn't allow new tabs"; RULE-16,
// D-006) on the multi-origin harness with the real CSP: the statement and source link show inside
// the portal's frame, and activating the source link, which the frame's sandbox blocks, changes
// nothing in the tool. GitHub is never contacted (a local route answers if a tab ever opens).
import { expect, test } from '@playwright/test';
import { HOST_ALLOWED, TOOL_ALLOWED, hostPageUrl } from '../support/urls';
import { markWindow, settle, stillSameWindow, toolFrame } from './support';

test('F-016.R3 embedded without new-tab permission, the source link is blocked and the tool does nothing else', async ({
  page,
  context,
}) => {
  const contacted: string[] = [];
  await context.route('https://github.com/**', async (route) => {
    contacted.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>repo</title>' });
  });
  const tabs: string[] = [];
  context.on('page', (p) => tabs.push(p.url()));

  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark'));
  const frame = await toolFrame(page);
  await markWindow(frame);
  const tool = page.frameLocator('#tool');
  await expect(tool.getByRole('button', { name: 'Runs locally, nothing uploaded' })).toBeVisible();

  const link = tool.getByRole('link', { name: 'Source code on GitHub (opens in a new tab)' });
  await expect(link).toHaveAttribute('href', 'https://github.com/thanh-taro/image-annotator');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await link.click();
  await settle(page);

  expect(tabs).toEqual([]);
  expect(contacted).toEqual([]);
  expect(await stillSameWindow(frame)).toBe(true);
  expect(frame.url().startsWith(TOOL_ALLOWED)).toBe(true);
});
