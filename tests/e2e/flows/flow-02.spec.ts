// FLOW-02 How-to steps for docs — one end-to-end pass on the production build (Chromium + WebKit): open a
// file, numbered steps, a highlight, crop, padding on a white background, download (decoded in Node,
// ADR-0019). Implements steps of FLOW-02 (F-001.R3, F-006.R1, F-004.R2, F-004.R3, F-010.R1, F-011.R1,
// F-011.R2, F-012.R2).
import { expect as baseExpect, test, type Page } from '@playwright/test';
import { download, expectCleanPng, pngRegion } from '../support/export';
import { fixturePath } from '../support/load';

test.use({ deviceScaleFactor: 1 });
const expect = baseExpect.configure({ timeout: 15_000 });
const PATIENT = { timeout: 20_000 };

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Tools and actions' });
const tool = (page: Page, name: string) => toolbar(page).getByRole('radio', { name });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Style' });
const summary = (page: Page) => page.locator('#tk-canvas-summary');
const count = (page: Page, n: number) => expect(summary(page)).toHaveText(new RegExp(`, ${n} annotations?$`), PATIENT);

test('FLOW-02 how-to steps: open, steps, highlight, crop, padding on white, download', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1472, height: 868 });
  await page.goto('/?lang=en-US');
  await expect(page.locator('[data-screen="SCR-Annotator"]')).toHaveAttribute('data-state', 'empty');

  // 1. Open file (F-001.R3): the 240 × 160 fixture.
  const chooser = page.waitForEvent('filechooser');
  await toolbar(page).getByRole('button', { name: 'Open image' }).click();
  await (await chooser).setFiles(fixturePath('fmt.png'));
  await expect(summary(page)).toHaveText('240 × 160 px canvas, 0 annotations', PATIENT);

  await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  const area = await page.locator('main.tk-work-area').boundingBox();
  if (!area) throw new Error('no work area');
  const ox = Math.round(area.x + (area.width - 240) / 2);
  const oy = Math.round(area.y + (area.height - 160) / 2);

  // 2. Place steps (F-006.R1): numbered 1, 2, 3.
  await tool(page, 'Step (N)').click();
  for (const [x, y] of [
    [40, 40],
    [120, 40],
    [200, 40],
  ] as const)
    await page.mouse.click(ox + x, oy + y);
  await count(page, 3);
  await expect(
    page
      .getByRole('listbox', { name: 'Annotations' })
      .getByRole('option')
      .filter({ hasText: /^Step [123] at / }),
  ).toHaveCount(3);

  // 3. Highlight a line of text (F-004.R2, F-004.R3).
  await page.keyboard.press('Escape');
  await tool(page, 'Highlight (H)').click();
  await page.mouse.move(ox + 30, oy + 100);
  await page.mouse.down();
  await page.mouse.move(ox + 200, oy + 100, { steps: 6 });
  await page.mouse.up();
  await count(page, 4);

  // 4. Crop to the relevant area (F-010.R1): frame 200 × 120 at 20, 10.
  await page.keyboard.press('Escape');
  await tool(page, 'Crop (C)').click();
  await expect(page.locator('[data-screen="SCR-Annotator"]')).toHaveAttribute('data-state', 'cropping');
  const fields = panel(page).locator('.tk-geometry__input');
  for (const [i, v] of [20, 10, 200, 120].entries()) {
    await fields.nth(i).fill(String(v));
    await fields.nth(i).press('Enter');
  }
  await expect(page.locator('.tk-crop-chip')).toHaveText('200 × 120 px');
  await tool(page, 'Select (V)').click();

  // 5. Padding Medium (0.06 × 200 = 12 px) on a white background (F-011.R1, F-011.R2).
  await panel(page).getByRole('group', { name: 'Padding' }).getByRole('radio', { name: 'Medium', exact: true }).check();
  await panel(page)
    .getByRole('group', { name: 'Background' })
    .getByRole('radio', { name: 'White', exact: true })
    .check();
  await expect(page.locator('.tk-status-size')).toHaveText('224 × 144 px');

  // 6. Download (F-012.R2).
  const file = await download(page, () => toolbar(page).getByRole('button', { name: 'Download', exact: true }).click());
  expect(file.name).toBe('fmt-annotated.png'); // named after the opened file (F-012.R2)
  const png = expectCleanPng(file.bytes);
  expect([png.width, png.height]).toEqual([224, 144]);
  expect(pngRegion(png, 0, 0, 1, 1)).toEqual([255, 255, 255, 255]); // white padding
  expect(pngRegion(png, 223, 143, 1, 1)).toEqual([255, 255, 255, 255]);
});
