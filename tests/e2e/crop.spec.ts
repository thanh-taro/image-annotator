// F-010 Crop the export frame — end to end on the production build (Chromium + WebKit). The work area is
// 1200 × 800 (a 272 px style panel beside it, as in edit.spec.ts). A 1920 × 1080 image is fitted at 60 %
// (Fit leaves space.6 = 24 px on each side: 1152 / 1920), so image pixel (x, y) is at (24 + 0.6x, 76 + 0.6y)
// in the work area. Frames are read from CMP-StylePanel's crop fields; exports are decoded in Node
// (ADR-0019). Also F-018.AC6 (the crop size in vi-VN) and the crop half of F-007.AC13 (no padding).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { referenceBlur } from '../../src/effects/reference';
import { download, downloadButton, expectCleanPng, maxDiff, pngRegion } from './support/export';
import { canvasPixel, summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const GREY = [200, 200, 200, 255];
const RED = [214, 40, 40, 255];
const HD = { width: 1920, height: 1080 };
/** The fitted view of a 1920 × 1080 image (RULE-12). */
const FIT = { zoom: 0.6, x: 24, y: 76 };

const workArea = (page: Page) => page.locator('main.tk-work-area');
const tool = (page: Page, name: string) => page.locator(`.tk-tools__strip [data-tool="${name}"]`);
const panel = (page: Page) => page.locator('aside.tk-panel');
const fields = (page: Page) => panel(page).locator('.tk-geometry__input');
const FIELD = { x: 0, y: 1, width: 2, height: 3 } as const;
const field = (page: Page, name: keyof typeof FIELD) => fields(page).nth(FIELD[name]);
const chip = (page: Page) => page.locator('.tk-crop-chip');
const zoomLevel = (page: Page) => page.locator('.tk-zoom__level');
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);

/** Pastes a generated image (flat grey, or seeded noise) and returns its RGBA pixels. */
async function open(
  page: Page,
  size: { width: number; height: number },
  opts: { noise?: boolean; query?: string } = {},
): Promise<Uint8ClampedArray> {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`/${opts.query ?? ''}`);
  const b64 = await page.evaluate(
    async ({ width, height, noise, grey }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d', { colorSpace: 'srgb' });
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = `rgb(${grey.slice(0, 3).join(',')})`;
      ctx.fillRect(0, 0, width, height);
      let s = 11;
      const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
      if (noise)
        for (let y = 0; y < height; y += 4)
          for (let x = 0; x < width; x += 4) {
            ctx.fillStyle = `rgb(${(rnd() * 255) | 0},${(rnd() * 255) | 0},${(rnd() * 255) | 0})`;
            ctx.fillRect(x, y, 4, 4);
          }
      const data = ctx.getImageData(0, 0, width, height, { colorSpace: 'srgb' }).data;
      const dt = new DataTransfer();
      dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'shot.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      let bin = '';
      for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    { ...size, noise: !!opts.noise, grey: GREY },
  );
  await expect(summary(page)).toHaveText(/, 0 \D+$/); // en-US or vi-VN
  await frame(page);
  return Uint8ClampedArray.from(atob(b64), (ch) => ch.charCodeAt(0));
}

/** Types whole image pixels into one of the crop fields and applies them with Enter (D-008). */
async function setField(page: Page, name: keyof typeof FIELD, value: number) {
  await field(page, name).fill(String(value));
  await field(page, name).press('Enter');
  await expect(field(page, name)).toHaveValue(String(value));
}

async function frameIs(page: Page, x: number, y: number, width: number, height: number) {
  await expect(field(page, 'x')).toHaveValue(String(x));
  await expect(field(page, 'y')).toHaveValue(String(y));
  await expect(field(page, 'width')).toHaveValue(String(width));
  await expect(field(page, 'height')).toHaveValue(String(height));
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

/** A point of the 1920 × 1080 image in the fitted crop view. */
const fit = (x: number, y: number): [number, number] => [FIT.x + x * FIT.zoom, FIT.y + y * FIT.zoom];

const dimmed = async (page: Page, x: number, y: number) => {
  const [sx, sy] = fit(x, y);
  const px = await canvasPixel(page, sx, sy);
  return px.slice(0, 3).every((v, i) => v < (GREY[i] ?? 0) - 40);
};

test.describe('F-010 crop the export frame', () => {
  test('F-010.AC1 dragging the left edge 200 image pixels right gives 1720 × 1080, the left 200 pixels dimmed', async ({
    page,
  }) => {
    await open(page, HD);
    await tool(page, 'crop').click();
    await expect(page.locator('[data-screen="SCR-Annotator"]')).toHaveAttribute('data-state', 'cropping');
    await expect(zoomLevel(page)).toHaveText('60 %');
    await drag(page, fit(0, 540), fit(200, 540));
    await frameIs(page, 200, 0, 1720, 1080);
    await expect(chip(page)).toHaveText('1,720 × 1,080 px');
    await expect(panel(page).locator('.tk-crop__size')).toHaveText('1,720 × 1,080 px');
    // COPY-crop.size announced once, exactly, when the change is made (not per drag frame).
    const announced = page.locator('[role="status"] > div').filter({ hasText: /^1,720 × 1,080 px$/ });
    await expect(announced).toHaveCount(1);
    await expect(page.locator('[role="status"] > div').filter({ hasText: /^[\d,]+ × [\d,]+ px$/ })).toHaveCount(1);
    await expect.poll(() => dimmed(page, 100, 540)).toBe(true);
    expect(await dimmed(page, 190, 540)).toBe(true);
    expect(near(await canvasPixel(page, ...fit(400, 540)), GREY)).toBe(true);
    // CMP-StatusBar: the canvas (export) size once a crop exists.
    await expect(page.locator('.tk-status-size')).toHaveText('1,720 × 1,080 px');
  });

  test('F-010.AC2 a frame smaller than the image, no padding: the export is exactly the frame’s size and content', async ({
    page,
  }) => {
    const pixels = await open(page, { width: 400, height: 300 }, { noise: true });
    await tool(page, 'crop').click();
    await setField(page, 'width', 200);
    await setField(page, 'height', 100);
    await setField(page, 'x', 120);
    await setField(page, 'y', 60);
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    expect([png.width, png.height]).toEqual([200, 100]);
    const expected: number[] = [];
    for (let y = 60; y < 160; y++)
      for (let x = 120; x < 320; x++)
        expected.push(...Array.from(pixels.slice((y * 400 + x) * 4, (y * 400 + x) * 4 + 4)));
    expect(maxDiff(pngRegion(png, 0, 0, 200, 100), expected)).toBeLessThanOrEqual(1);
  });

  test('F-010.AC3 an arrow partly outside the frame stays editable, and the export cuts it at the frame edge', async ({
    page,
  }) => {
    await open(page, { width: 400, height: 300 });
    await tool(page, 'crop').click();
    await setField(page, 'width', 200);
    await setField(page, 'height', 100);
    await setField(page, 'x', 100);
    await setField(page, 'y', 100);
    // Outside the crop tool the view shows the canvas only: 200 × 100 at 100 %, centred (frame at 500, 350).
    await tool(page, 'arrow').click();
    await expect(zoomLevel(page)).toHaveText('100 %');
    await drag(page, [550, 400], [750, 400]); // image (150, 150) → (350, 150): its head is outside the frame
    await tool(page, 'select').click();
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    await page.mouse.click(box.x + 600, box.y + 400);
    const end = panel(page).getByRole('group', { name: 'End' }).getByRole('textbox', { name: 'X' });
    await expect(end).toHaveValue('350'); // selected and editable, outside the frame
    await end.fill('320');
    await end.press('Enter');
    await expect(end).toHaveValue('320');
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    expect([png.width, png.height]).toEqual([200, 100]);
    // The shaft reaches the frame's right edge (cut there), at row 50 of the export (image y 150).
    expect(maxDiff(pngRegion(png, 199, 50, 1, 1), RED)).toBeLessThanOrEqual(24);
    expect(maxDiff(pngRegion(png, 199, 10, 1, 1), GREY)).toBeLessThanOrEqual(1);
  });

  test('F-010.AC4 COPY-action.crop_reset covers the whole image again', async ({ page }) => {
    await open(page, HD);
    await tool(page, 'crop').click();
    await setField(page, 'width', 800);
    await panel(page).getByRole('button', { name: 'Reset crop' }).click();
    await frameIs(page, 0, 0, 1920, 1080);
    await expect(page.locator('.tk-status-size')).toHaveCount(0);
  });

  test('F-010.AC5 cropped and cropped again: one undo restores the first crop', async ({ page }) => {
    await open(page, HD);
    await tool(page, 'crop').click();
    await drag(page, fit(0, 540), fit(200, 540));
    await frameIs(page, 200, 0, 1720, 1080);
    await drag(page, fit(1920, 540), fit(1820, 540));
    await frameIs(page, 200, 0, 1620, 1080);
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+Z');
    await frameIs(page, 200, 0, 1720, 1080);
  });

  test('F-010.AC11 D-033 dragging inside a whole-image frame draws a new 800 × 600 frame, as one undo step', async ({
    page,
  }) => {
    await open(page, HD);
    await tool(page, 'crop').click();
    await frameIs(page, 0, 0, 1920, 1080);
    await drag(page, fit(400, 300), fit(1200, 900));
    await frameIs(page, 400, 300, 800, 600);
    await expect(chip(page)).toHaveText('800 × 600 px');
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+Z');
    await frameIs(page, 0, 0, 1920, 1080);
  });

  test('F-010.AC6 dragging a corner towards 5 × 5 stops at 16 × 16', async ({ page }) => {
    await open(page, HD);
    await tool(page, 'crop').click();
    await drag(page, fit(1920, 1080), fit(5, 5));
    await frameIs(page, 0, 0, 16, 16);
  });

  test('F-010.AC7 with canvas focus, Alt+Shift+Left moves the frame’s right edge 10 image pixels left', async ({
    page,
  }) => {
    await open(page, HD);
    await tool(page, 'crop').click();
    await workArea(page).focus();
    await page.keyboard.press('Alt+Shift+ArrowLeft');
    await frameIs(page, 0, 0, 1910, 1080);
    await page.keyboard.press('ArrowRight'); // RULE-19: arrows move the frame, never pan
    await frameIs(page, 1, 0, 1910, 1080);
    await expect(zoomLevel(page)).toHaveText('60 %');
  });

  test('F-010.AC8 dragging inside a 1000 × 500 frame 100 image pixels right moves it and keeps its size', async ({
    page,
  }) => {
    await open(page, HD);
    await tool(page, 'crop').click();
    await setField(page, 'width', 1000);
    await setField(page, 'height', 500);
    await setField(page, 'x', 200);
    await setField(page, 'y', 200);
    await drag(page, fit(700, 450), fit(800, 450));
    await frameIs(page, 300, 200, 1000, 500);
  });

  test('F-010.AC9 typing 800 in the width field makes the frame 800 pixels wide', async ({ page }) => {
    await open(page, HD);
    await tool(page, 'crop').click();
    await setField(page, 'width', 800);
    await frameIs(page, 0, 0, 800, 1080);
    await expect(chip(page)).toHaveText('800 × 1,080 px');
  });

  test('F-010.AC10 RULE-12 a fitted 800 × 600 crop: the crop tool fits the whole image with the outside dimmed; back, the canvas is fitted', async ({
    page,
  }) => {
    await open(page, HD);
    await tool(page, 'crop').click();
    await setField(page, 'width', 800);
    await setField(page, 'height', 600);
    await setField(page, 'x', 560);
    await setField(page, 'y', 240);
    await tool(page, 'select').click();
    await expect(zoomLevel(page)).toHaveText('100 %'); // the 800 × 600 canvas fitted (never above 100 %)
    await expect(summary(page)).toHaveText('800 × 600 px canvas, 0 annotations');
    await tool(page, 'crop').click();
    await expect(zoomLevel(page)).toHaveText('60 %');
    await expect.poll(() => dimmed(page, 100, 100)).toBe(true);
    expect(near(await canvasPixel(page, ...fit(960, 540)), GREY)).toBe(true);
    await tool(page, 'select').click();
    await expect(zoomLevel(page)).toHaveText('100 %');
    // Outside the crop tool only the canvas shows: the frame centred at 100 %, nothing dimmed.
    expect(near(await canvasPixel(page, 600, 400), GREY)).toBe(true);
  });

  test('F-018.AC6 the crop size is written the Vietnamese way in vi-VN (1.920 × 1.080) and the US way in en-US', async ({
    page,
  }) => {
    for (const [query, text] of [
      ['?lang=vi-VN', '1.920 × 1.080 px'],
      ['', '1,920 × 1,080 px'],
    ] as const) {
      await open(page, { width: 2000, height: 1200 }, { query });
      await tool(page, 'crop').click();
      await setField(page, 'width', 1920);
      await setField(page, 'height', 1080);
      await expect(chip(page)).toHaveText(text);
      await expect(panel(page).locator('.tk-crop__size')).toHaveText(text);
      await expect(page.locator('.tk-status-size')).toHaveText(text);
    }
  });

  test('F-007.AC13 (crop, no padding) a blur spanning the frame’s left edge reads no image pixel outside the frame', async ({
    page,
  }) => {
    const pixels = await open(page, { width: 1000, height: 500 }, { noise: true });
    await tool(page, 'crop').click();
    await setField(page, 'width', 400);
    await setField(page, 'height', 200);
    await setField(page, 'x', 300);
    await setField(page, 'y', 150);
    await tool(page, 'redact').click();
    await panel(page).getByRole('group', { name: 'Redaction type' }).getByRole('radio', { name: /^Blur/ }).check();
    // The 400 × 200 canvas at 100 %, centred: image (x, y) at (400 + x − 300, 300 + y − 150).
    await drag(page, [350, 320], [500, 400]); // image box 250…400 × 170…250, across the left edge
    await expect(summary(page)).toHaveText('400 × 200 px canvas, 1 annotation');
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    expect([png.width, png.height]).toEqual([400, 200]);
    const F = { x: 300, y: 150, width: 400, height: 200 };
    const ref = referenceBlur(
      { data: pixels, width: 1000, height: 500 },
      F,
      { x: 250, y: 170, width: 150, height: 80 },
      10,
      [],
    );
    expect(ref && [ref.x, ref.y, ref.width, ref.height]).toEqual([300, 170, 100, 80]);
    expect(maxDiff(pngRegion(png, 0, 20, 100, 80), ref?.data ?? [])).toBeLessThanOrEqual(1);
  });

  test('F-010.R5 F-007.R3 RULE-10 a blur drawn before the crop is recomputed for the new frame (review m4)', async ({
    page,
  }) => {
    const pixels = await open(page, { width: 1000, height: 500 }, { noise: true });
    // The 1000 × 500 image at 100 %, centred: image (x, y) at (100 + x, 150 + y).
    await tool(page, 'redact').click();
    await panel(page).getByRole('group', { name: 'Redaction type' }).getByRole('radio', { name: /^Blur/ }).check();
    await drag(page, [350, 320], [500, 400]); // image box 250…400 × 170…250
    await expect(summary(page)).toHaveText('1,000 × 500 px canvas, 1 annotation');
    await tool(page, 'crop').click();
    await setField(page, 'width', 400);
    await setField(page, 'height', 200);
    await setField(page, 'x', 300);
    await setField(page, 'y', 150);
    await expect(summary(page)).toHaveText('400 × 200 px canvas, 1 annotation');
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    expect([png.width, png.height]).toEqual([400, 200]);
    const ref = referenceBlur(
      { data: pixels, width: 1000, height: 500 },
      { x: 300, y: 150, width: 400, height: 200 },
      { x: 250, y: 170, width: 150, height: 80 },
      10,
      [],
    );
    expect(ref && [ref.x, ref.y, ref.width, ref.height]).toEqual([300, 170, 100, 80]);
    expect(maxDiff(pngRegion(png, 0, 20, 100, 80), ref?.data ?? [])).toBeLessThanOrEqual(1);
  });

  for (const theme of ['light', 'dark'] as const)
    test(`NFR-06 F-010 the cropping state has no axe violations (${theme})`, async ({ page }) => {
      await open(page, HD, { query: `?theme=${theme}` });
      await tool(page, 'crop').click();
      await setField(page, 'width', 1200);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
});
