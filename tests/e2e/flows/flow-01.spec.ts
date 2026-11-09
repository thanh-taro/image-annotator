// FLOW-01 Bug report with redaction — one end-to-end pass on the production build (Chromium + WebKit):
// paste a screenshot, arrow (A) and rectangle (R), text label (T), solid redaction (X), copy (Mod+C), then
// the clipboard PNG holds the work (decoded in Node, ADR-0019). Implements steps of FLOW-01 (F-001.R1,
// F-003.R1, F-003.R2, F-005.R1, F-007.R1, F-007.R2, F-012.R1, F-012.R4).
import { expect as baseExpect, test, type Page } from '@playwright/test';
import { copied, expectCleanPng, pngRegion, recordClipboard } from '../support/export';

test.use({ deviceScaleFactor: 1 });
const expect = baseExpect.configure({ timeout: 15_000 });
const PATIENT = { timeout: 20_000 };
const SHOT = { width: 800, height: 500 };

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Tools and actions' });
const tool = (page: Page, name: string) => toolbar(page).getByRole('radio', { name });
const summary = (page: Page) => page.locator('#tk-canvas-summary');
const count = (page: Page, n: number) => expect(summary(page)).toHaveText(new RegExp(`, ${n} annotations?$`), PATIENT);

test('FLOW-01 bug report: paste, arrow and rectangle, text, solid redaction, copy', async ({
  page,
  context,
  browserName,
}) => {
  test.slow();
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await recordClipboard(page);
  await page.setViewportSize({ width: 1472, height: 868 });
  await page.goto('/?lang=en-US');
  await expect(page.locator('[data-screen="SCR-Annotator"]')).toHaveAttribute('data-state', 'empty');

  // 1. Paste (F-001.R1): flat grey screenshot with a striped patch to redact.
  await page.evaluate(async (s) => {
    const c = new OffscreenCanvas(s.width, s.height);
    const ctx = c.getContext('2d', { colorSpace: 'srgb' });
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = 'rgb(200,200,200)';
    ctx.fillRect(0, 0, s.width, s.height);
    for (let x = 20; x < 620; x += 4) {
      ctx.fillStyle = '#000';
      ctx.fillRect(x, 290, 2, 100);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 2, 290, 2, 100);
    }
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'shot.png', { type: 'image/png' }));
    (document.activeElement ?? document).dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, SHOT);
  await expect(summary(page)).toHaveText('800 × 500 px canvas, 0 annotations', PATIENT);

  // Calibrate: 100 % view, origin of the image on screen.
  await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  const area = await page.locator('main.tk-work-area').boundingBox();
  if (!area) throw new Error('no work area');
  const ox = Math.round(area.x + (area.width - SHOT.width) / 2);
  const oy = Math.round(area.y + (area.height - SHOT.height) / 2);
  const drag = async (a: [number, number], b: [number, number]) => {
    await page.mouse.move(ox + a[0], oy + a[1]);
    await page.mouse.down();
    await page.mouse.move(ox + b[0], oy + b[1], { steps: 6 });
    await page.mouse.up();
  };
  const work = page.locator('main.tk-work-area');

  // 2. Arrow (A) and rectangle (R), by their keys (F-003.R1, F-003.R2).
  await work.focus();
  await page.keyboard.press('a');
  await expect(tool(page, 'Arrow (A)')).toHaveAttribute('aria-checked', 'true');
  await drag([500, 60], [700, 140]);
  await count(page, 1);
  await page.keyboard.press('Escape');
  await page.keyboard.press('r');
  await expect(tool(page, 'Rectangle (R)')).toHaveAttribute('aria-checked', 'true');
  await drag([60, 60], [260, 160]);
  await count(page, 2);
  await page.keyboard.press('Escape');

  // 3. Text label (T) (F-005.R1).
  await page.keyboard.press('t');
  await expect(tool(page, 'Text (T)')).toHaveAttribute('aria-checked', 'true');
  await page.mouse.click(ox + 300, oy + 200);
  const editor = page.getByRole('textbox', { name: 'Text', exact: true });
  await expect(editor).toBeFocused();
  await page.keyboard.insertText('Wrong total');
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await count(page, 3);
  await page.keyboard.press('Escape');

  // 4. Redact (X), solid by default (F-007.R1, F-007.R2).
  await page.keyboard.press('x');
  await expect(tool(page, 'Redact (X)')).toHaveAttribute('aria-checked', 'true');
  await expect(
    page.getByRole('complementary', { name: 'Style' }).getByRole('radio', { name: /^Solid \(secure\)/ }),
  ).toBeChecked();
  await drag([40, 300], [200, 380]);
  await count(page, 4);
  await expect(toolbar(page)).toContainText('1 redaction');

  // 5. Copy (Mod+C, F-012.R1, F-012.R4): the notice names the redaction; the clipboard PNG holds the work.
  await page.keyboard.press('Escape');
  await work.focus();
  await page.keyboard.press('ControlOrMeta+c');
  await expect(page.locator('.tk-notice')).toContainText('Copied, with 1 redaction applied.', PATIENT);
  const png = expectCleanPng(await copied(page));
  expect([png.width, png.height]).toEqual([SHOT.width, SHOT.height]);
  const px = (x: number, y: number) => pngRegion(png, x, y, 1, 1);
  expect(px(120, 340)).toEqual([0, 0, 0, 255]); // solid redaction covers the stripes (INV-02)
  expect(px(700, 450)).toEqual([200, 200, 200, 255]);
});
