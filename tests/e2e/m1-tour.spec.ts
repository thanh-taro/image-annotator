// F-015.AC7 (R6): the tool opened standalone does everything M-1 promises. One quick tour through every
// M-1 feature (tests/e2e/support/tour.ts), each step checking its user-visible outcome, ending with a
// downloaded PNG whose pixels show the work. The per-feature suites cover each feature in depth.
import { test } from '@playwright/test';
import { recordClipboard } from './support/export';
import { m1Tour } from './support/tour';

// One device pixel per CSS pixel, so the 100 % view maps image pixels 1:1 to the pointer.
test.use({ deviceScaleFactor: 1 });

test('F-015.AC7 F-015.R6 standalone, every M-1 feature works: a tour ending in an export that shows the work', async ({
  page,
  context,
  browserName,
}) => {
  test.slow();
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await recordClipboard(page);
  await page.setViewportSize({ width: 1472, height: 868 });
  await page.goto('/?lang=en-US');
  await m1Tour(page, page);
});
