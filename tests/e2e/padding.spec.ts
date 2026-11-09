// F-011 Add padding and background — end to end on the production build (Chromium + WebKit). The work area
// is 1200 × 800 (a 272 px style panel beside it, as in crop.spec.ts). A 1000 × 500 image is shown at 100 %,
// centred; with padding M (60 px) the 1120 × 620 canvas still fits at 100 %, so image pixel (x, y) stays
// at (100 + x, 150 + y) in the work area. The canvas settings show in CMP-StylePanel with the select tool
// and nothing selected (SCR-Annotator "canvas-settings"). Exports are decoded in Node (ADR-0019).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { download, downloadButton, expectCleanPng, maxDiff, pngRegion } from './support/export';
import { summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const GREY = [200, 200, 200, 255];
const RED = [214, 40, 40, 255]; // annotation.color.red
const WHITE = [255, 255, 255, 255]; // annotation.color.white
const CLEAR = [0, 0, 0, 0];

const workArea = (page: Page) => page.locator('main.tk-work-area');
const screen = (page: Page) => page.locator('[data-screen="SCR-Annotator"]');
const tool = (page: Page, name: string) => page.locator(`.tk-tools__strip [data-tool="${name}"]`);
const panel = (page: Page) => page.getByRole('complementary', { name: 'Style' });
const paddingGroup = (page: Page) => panel(page).getByRole('group', { name: 'Padding' });
const backgroundGroup = (page: Page) => panel(page).getByRole('group', { name: 'Background' });
const padding = (page: Page, name: string) => paddingGroup(page).getByRole('radio', { name, exact: true });
const background = (page: Page, name: string) => backgroundGroup(page).getByRole('radio', { name, exact: true });
const statusSize = (page: Page) => page.locator('.tk-status-size');
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
const repeat = (px: number[], n: number) => Array.from({ length: n }, () => px).flat();

/** Pastes a generated image (flat grey, or seeded noise) and returns its RGBA pixels. */
async function open(
  page: Page,
  size: { width: number; height: number },
  opts: { noise?: boolean; query?: string; viewport?: { width: number; height: number } } = {},
): Promise<Uint8ClampedArray> {
  await page.setViewportSize(opts.viewport ?? VIEWPORT);
  await page.goto(`/${opts.query ?? ''}`);
  const b64 = await page.evaluate(
    async ({ width, height, noise, grey }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d', { colorSpace: 'srgb' });
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = `rgb(${grey.slice(0, 3).join(',')})`;
      ctx.fillRect(0, 0, width, height);
      let s = 23;
      const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
      if (noise)
        for (let y = 0; y < height; y += 4)
          for (let x = 0; x < width; x += 4) {
            ctx.fillStyle = `rgb(${(rnd() * 255) | 0},${(rnd() * 255) | 0},${(rnd() * 255) | 0})`;
            ctx.fillRect(x, y, 4, 4);
          }
      const dt = new DataTransfer();
      dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'shot.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      if (!noise) return '';
      const data = ctx.getImageData(0, 0, width, height, { colorSpace: 'srgb' }).data;
      let bin = '';
      for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    { ...size, noise: !!opts.noise, grey: GREY },
  );
  await expect(summary(page)).toHaveText(/, 0 \D+$/, { timeout: 20_000 });
  await frame(page);
  return Uint8ClampedArray.from(atob(b64), (ch) => ch.charCodeAt(0));
}

/** Types whole image pixels into one of the crop fields (x, y, width, height) and applies them (D-008). */
async function cropTo(page: Page, f: { x: number; y: number; width: number; height: number }) {
  await tool(page, 'crop').click();
  const fields = panel(page).locator('.tk-geometry__input');
  for (const [i, value] of [f.width, f.height, f.x, f.y].entries()) {
    const field = fields.nth([2, 3, 0, 1][i] ?? 0);
    await field.fill(String(value));
    await field.press('Enter');
    await expect(field).toHaveValue(String(value));
  }
  await tool(page, 'select').click();
}

/** A mouse drag between two work-area points (CSS px), in steps past the RULE-05 threshold. */
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + (from[0] + to[0]) / 2, box.y + (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 4 });
  await page.mouse.up();
  await frame(page);
}

const exported = async (page: Page) => expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);

test.describe('F-011 padding and background', () => {
  test('F-011.AC1 padding M on a 1000 × 500 image makes a 1120 × 620 canvas with 60 pixels on each side', async ({
    page,
  }) => {
    await open(page, { width: 1000, height: 500 });
    // SCR-Annotator "canvas-settings": the select tool, nothing selected.
    await expect(screen(page)).toHaveAttribute('data-state', 'canvas-settings');
    await expect(panel(page)).toHaveAttribute('data-variant', 'canvas');
    await expect(padding(page, 'None')).toBeChecked();
    await expect(background(page, 'Transparent')).toBeChecked();
    await expect(statusSize(page)).toHaveCount(0);
    await padding(page, 'Medium').check();
    await expect(summary(page)).toHaveText('1,120 × 620 px canvas, 0 annotations');
    await expect(statusSize(page)).toHaveText('1,120 × 620 px');
    const png = await exported(page);
    expect([png.width, png.height]).toEqual([1120, 620]);
    // 60 transparent pixels on each side; the image starts right after them.
    expect(pngRegion(png, 59, 310, 1, 1)).toEqual(CLEAR);
    expect(maxDiff(pngRegion(png, 60, 310, 1, 1), GREY)).toBeLessThanOrEqual(1);
    expect(maxDiff(pngRegion(png, 1059, 60, 1, 1), GREY)).toBeLessThanOrEqual(1);
    expect(pngRegion(png, 1060, 559, 1, 1)).toEqual(CLEAR);
    expect(pngRegion(png, 500, 560, 1, 1)).toEqual(CLEAR);
  });

  test('F-011.AC2 the padding of an export is white on a white background and transparent on a transparent one', async ({
    page,
  }) => {
    await open(page, { width: 1000, height: 500 });
    await padding(page, 'Medium').check();
    await background(page, 'White').check();
    await expect(background(page, 'White')).toBeChecked();
    const white = await exported(page);
    expect([white.width, white.height]).toEqual([1120, 620]);
    expect(pngRegion(white, 0, 0, 60, 1)).toEqual(repeat(WHITE, 60));
    expect(pngRegion(white, 1060, 619, 60, 1)).toEqual(repeat(WHITE, 60));
    expect(maxDiff(pngRegion(white, 60, 60, 1, 1), GREY)).toBeLessThanOrEqual(1);
    await background(page, 'Transparent').check();
    const clear = await exported(page);
    expect(pngRegion(clear, 0, 0, 60, 1)).toEqual(repeat(CLEAR, 60));
    expect(pngRegion(clear, 1060, 619, 60, 1)).toEqual(repeat(CLEAR, 60));
  });

  test('F-011.AC3 an arrow dragged from the padding into the image is exported whole', async ({ page }) => {
    await open(page, { width: 1000, height: 500 });
    await padding(page, 'Medium').check();
    await background(page, 'White').check();
    await tool(page, 'arrow').click();
    // Image (−40, 250) in the padding → image (300, 250).
    await drag(page, [100 - 40, 150 + 250], [100 + 300, 150 + 250]);
    await expect(summary(page)).toHaveText('1,120 × 620 px canvas, 1 annotation');
    const png = await exported(page);
    // Export x = image x + 60, y = image y + 60: the tail in the padding, the shaft and the head over the image.
    expect(maxDiff(pngRegion(png, 24, 310, 1, 1), RED)).toBeLessThanOrEqual(24);
    expect(maxDiff(pngRegion(png, 40, 310, 1, 1), RED)).toBeLessThanOrEqual(24);
    expect(maxDiff(pngRegion(png, 200, 310, 1, 1), RED)).toBeLessThanOrEqual(24);
    expect(maxDiff(pngRegion(png, 350, 310, 1, 1), RED)).toBeLessThanOrEqual(24);
    expect(maxDiff(pngRegion(png, 24, 330, 1, 1), WHITE)).toBeLessThanOrEqual(1); // beside it: the background
  });

  test('F-011.AC4 a 400 × 200 crop with padding M on white exports 448 × 248: the frame, 24 white pixels around it', async ({
    page,
  }) => {
    const pixels = await open(page, { width: 1000, height: 500 }, { noise: true });
    await cropTo(page, { x: 300, y: 150, width: 400, height: 200 });
    await padding(page, 'Medium').check();
    await background(page, 'White').check();
    await expect(summary(page)).toHaveText('448 × 248 px canvas, 0 annotations');
    // RULE-13: the padding never moves or resizes the frame.
    await tool(page, 'crop').click();
    await expect(panel(page).locator('.tk-crop__size')).toHaveText('400 × 200 px');
    await tool(page, 'select').click();
    const png = await exported(page);
    expect([png.width, png.height]).toEqual([448, 248]);
    expect(pngRegion(png, 0, 0, 448, 24)).toEqual(repeat(WHITE, 448 * 24));
    expect(pngRegion(png, 0, 224, 448, 24)).toEqual(repeat(WHITE, 448 * 24));
    expect(pngRegion(png, 0, 24, 24, 200)).toEqual(repeat(WHITE, 24 * 200));
    expect(pngRegion(png, 424, 24, 24, 200)).toEqual(repeat(WHITE, 24 * 200));
    const expected: number[] = [];
    for (let y = 150; y < 350; y++)
      for (let x = 300; x < 700; x++)
        expected.push(...Array.from(pixels.slice((y * 1000 + x) * 4, (y * 1000 + x) * 4 + 4)));
    expect(maxDiff(pngRegion(png, 24, 24, 400, 200), expected)).toBeLessThanOrEqual(1);
  });

  test('F-011.AC5 undo removes the padding that was added', async ({ page }) => {
    await open(page, { width: 1000, height: 500 });
    await padding(page, 'Large').check();
    await expect(summary(page)).toHaveText('1,240 × 740 px canvas, 0 annotations');
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(summary(page)).toHaveText('1,000 × 500 px canvas, 0 annotations');
    await expect(padding(page, 'None')).toBeChecked();
    await expect(statusSize(page)).toHaveCount(0);
  });

  test('F-011.AC6 on a 4096 × 4096 image S, M and L are unavailable, with COPY-canvas.padding_unavailable', async ({
    page,
  }) => {
    test.slow();
    await open(page, { width: 4096, height: 4096 });
    await expect(padding(page, 'None')).toBeEnabled();
    for (const name of ['Small', 'Medium', 'Large']) await expect(padding(page, name)).toBeDisabled();
    const note = 'Larger padding would make the image too big to export.';
    await expect(panel(page).getByText(note)).toBeVisible();
    await expect(paddingGroup(page)).toHaveAccessibleDescription(note);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('F-011.AC7 resetting a 1000 × 1000 crop of a 3600 × 3600 image steps padding L down to M; one undo restores both', async ({
    page,
  }) => {
    test.slow();
    await open(page, { width: 3600, height: 3600 });
    await cropTo(page, { x: 0, y: 0, width: 1000, height: 1000 });
    await padding(page, 'Large').check();
    await expect(summary(page)).toHaveText('1,240 × 1,240 px canvas, 0 annotations');
    await tool(page, 'crop').click();
    await panel(page).getByRole('button', { name: 'Reset crop' }).click();
    await expect(panel(page).locator('.tk-crop__size')).toHaveText('3,600 × 3,600 px');
    await tool(page, 'select').click();
    await expect(summary(page)).toHaveText('4,032 × 4,032 px canvas, 0 annotations');
    await expect(padding(page, 'Medium')).toBeChecked();
    await expect(padding(page, 'Large')).toBeDisabled();
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+Z');
    await expect(summary(page)).toHaveText('1,240 × 1,240 px canvas, 0 annotations');
    await expect(padding(page, 'Large')).toBeChecked();
  });

  test('CMP-StylePanel narrow: the summary bar reads "Canvas · Padding None", then the chosen size', async ({
    page,
  }) => {
    await open(page, { width: 1000, height: 500 }, { viewport: { width: 390, height: 844 } });
    const bar = page.locator('.tk-panel__bar');
    await expect(bar).toHaveAccessibleName('Style options: Canvas · Padding None');
    await bar.click();
    await page.locator('#tk-style-sheet').getByRole('radio', { name: 'Medium', exact: true }).check();
    await expect(bar).toHaveAccessibleName('Style options: Canvas · Padding Medium');
    await expect(summary(page)).toHaveText('1,120 × 620 px canvas, 0 annotations');
  });

  for (const theme of ['light', 'dark'] as const)
    test(`NFR-06 F-011 the canvas-settings state has no axe violations (${theme})`, async ({ page }) => {
      await open(page, { width: 1000, height: 500 }, { query: `?theme=${theme}` });
      await padding(page, 'Medium').check();
      await background(page, 'White').check();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
});
