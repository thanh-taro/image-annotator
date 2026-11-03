// F-002 Zoom and pan the view — end to end on the production build (Chromium + WebKit). The work area
// is made exactly 1200 × 800 (the AC's area) by the viewport: toolbar 40 + 800 + status bar 28. Images
// are generated in the page and pasted (tests/e2e/support/load.ts dispatches the same event).
// AC7 (export unchanged, no undo step) is covered in tests/unit/canvas.view.test.ts until export
// (F-012) and drawing (F-003) exist to exercise it here.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { canvasBox, canvasPixel, summary } from './support/load';

const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width, height: 40 + AREA.height + 28 };
const RED = [220, 30, 30, 255];
const BLUE = [30, 60, 220, 255];
const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);

const state = (page: Page) => page.locator('[data-screen="SCR-Annotator"]');
const level = (page: Page) => page.locator('.tk-zoom__level');
const statusBar = (page: Page) => page.locator('footer.tk-status-bar');
const button = (page: Page, name: string) => statusBar(page).getByRole('button', { name, exact: true });
const workArea = (page: Page) => page.locator('main.tk-work-area');

async function open(page: Page, query = '') {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`/${query}`);
  await expect(state(page)).toHaveAttribute('data-state', 'empty');
}

/**
 * Pastes a generated PNG: the left half red, the right half blue, and (optionally) a white square
 * `mark` = [x, y, size] in image pixels — a detail to keep under the pointer.
 */
async function pasteImage(page: Page, width: number, height: number, mark?: [number, number, number]) {
  await page.evaluate(
    async ({ width, height, mark, red, blue }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = `rgb(${red.slice(0, 3).join(',')})`;
      ctx.fillRect(0, 0, width / 2, height);
      ctx.fillStyle = `rgb(${blue.slice(0, 3).join(',')})`;
      ctx.fillRect(width / 2, 0, width / 2, height);
      if (mark) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mark[0], mark[1], mark[2], mark[2]);
      }
      const blob = await c.convertToBlob({ type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'generated.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { width, height, mark, red: RED, blue: BLUE },
  );
  const w = width.toLocaleString('en-US');
  const h = height.toLocaleString('en-US');
  await expect(summary(page)).toHaveText(`${w} × ${h} px canvas, 0 annotations`);
  await expect(level(page)).toHaveText(/^\d+ %$/);
  await frame(page); // the first paint is on the next animation frame
  await frame(page);
}

const percent = async (page: Page) => Number((await level(page).textContent())?.replace(/\D/g, ''));

/** Waits for the next painted frame. */
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

test.describe('F-002 zoom and pan the view', () => {
  test('smoke: the work area is the 1200 × 800 area of the acceptance criteria', async ({ page }) => {
    await open(page);
    await pasteImage(page, 400, 300);
    expect(await canvasBox(page)).toEqual(AREA);
  });

  test('F-002 edge case: with no image the zoom controls are disabled', async ({ page }) => {
    await open(page);
    for (const name of ['Zoom out', 'Zoom in', 'Fit to view', 'Actual size'])
      await expect(button(page, name)).toBeDisabled();
    await expect(level(page)).toHaveText('–');
  });

  test('F-002.AC1 a 3840 × 2160 image loads whole, with the zoom shown below 100 %', async ({ page }) => {
    await open(page);
    await pasteImage(page, 3840, 2160);
    expect(await percent(page)).toBeLessThan(100);
    // Fit leaves space.6 (24 px): (1200 − 48) / 3840 = 30 %.
    await expect(level(page)).toHaveText('30 %');
    const scale = 0.3;
    const left = (AREA.width - 3840 * scale) / 2;
    const top = (AREA.height - 2160 * scale) / 2;
    expect(near(await canvasPixel(page, left + 2, top + 2), RED)).toBe(true);
    expect(near(await canvasPixel(page, left + 3840 * scale - 2, top + 2160 * scale - 2), BLUE)).toBe(true);
  });

  test('F-002.AC2 a 400 × 300 image loads at 100 %', async ({ page }) => {
    await open(page);
    await pasteImage(page, 400, 300);
    await expect(level(page)).toHaveText('100 %');
  });

  test('F-002.AC3 from 50 % one step in is 67 %; at 800 % zooming in does nothing', async ({ page }) => {
    await open(page);
    await pasteImage(page, 3840, 2160);
    await button(page, 'Zoom in').click();
    await expect(level(page)).toHaveText('50 %');
    await button(page, 'Zoom in').click();
    await expect(level(page)).toHaveText('67 %');
    for (const step of ['100 %', '150 %', '200 %', '300 %', '400 %', '600 %', '800 %']) {
      await button(page, 'Zoom in').click();
      await expect(level(page)).toHaveText(step);
    }
    await button(page, 'Zoom in').click();
    await expect(level(page)).toHaveText('800 %');
    // The image is really drawn at 800 % (WebKit once hung here): about the centre, the red/blue
    // boundary at image x 1920 is at the centre of the area, and one image pixel is 8 screen pixels.
    await frame(page);
    expect(near(await canvasPixel(page, AREA.width / 2 - 6, AREA.height / 2), RED)).toBe(true);
    expect(near(await canvasPixel(page, AREA.width / 2 + 6, AREA.height / 2), BLUE)).toBe(true);
  });

  test('F-002.AC4 Fit to view shows the whole canvas from any zoom; Actual size is 100 %', async ({ page }) => {
    await open(page);
    await pasteImage(page, 3840, 2160);
    for (let i = 0; i < 4; i++) await button(page, 'Zoom in').click();
    await expect(level(page)).toHaveText('150 %');
    await button(page, 'Fit to view').click();
    await expect(level(page)).toHaveText('30 %');
    await frame(page);
    const left = (AREA.width - 3840 * 0.3) / 2;
    const top = (AREA.height - 2160 * 0.3) / 2;
    expect(near(await canvasPixel(page, left + 2, top + 2), RED)).toBe(true);
    expect(near(await canvasPixel(page, AREA.width - left - 2, AREA.height - top - 2), BLUE)).toBe(true);
    await button(page, 'Actual size').click();
    await expect(level(page)).toHaveText('100 %');
  });

  test('F-002.AC5 Ctrl+wheel keeps the detail under the pointer', async ({ page }) => {
    await open(page);
    // A 100 px white square centred on image point (2950, 650): at 30 % it is 30 screen px wide.
    await pasteImage(page, 3840, 2160, [2900, 600, 100]);
    const left = (AREA.width - 3840 * 0.3) / 2;
    const top = (AREA.height - 2160 * 0.3) / 2;
    const pointer = { x: left + 2950 * 0.3, y: 40 + top + 650 * 0.3 }; // page coordinates
    expect(near(await canvasPixel(page, pointer.x, pointer.y - 40), [255, 255, 255, 255])).toBe(true);
    await page.mouse.move(pointer.x, pointer.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    await expect(level(page)).toHaveText('50 %');
    await frame(page);
    // Still under the pointer, and now 50 px wide: 20 px off the pointer is still the square.
    for (const [dx, dy] of [
      [0, 0],
      [-20, 0],
      [20, 0],
      [0, -20],
      [0, 20],
    ])
      expect(
        near(await canvasPixel(page, pointer.x + (dx ?? 0), pointer.y - 40 + (dy ?? 0)), [255, 255, 255, 255]),
      ).toBe(true);
  });

  test('F-002.AC6 Space+drag pans the view and creates or moves no annotation', async ({ page }) => {
    await open(page);
    await pasteImage(page, 3840, 2160);
    await button(page, 'Actual size').click();
    await expect(level(page)).toHaveText('100 %');
    await workArea(page).focus();
    await frame(page);
    // At 100 % about the centre, the red/blue boundary (image x 1920) is at the centre of the area.
    const probe = { x: AREA.width / 2 - 100, y: AREA.height / 2 };
    expect(near(await canvasPixel(page, probe.x, probe.y), RED)).toBe(true);
    await page.keyboard.down('Space');
    await expect(page.locator('canvas.tk-canvas')).toHaveAttribute('data-pan', 'ready');
    await page.mouse.move(700, 440);
    await page.mouse.down();
    await page.mouse.move(600, 440, { steps: 4 });
    await page.mouse.move(500, 440, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    await frame(page);
    expect(near(await canvasPixel(page, probe.x, probe.y), BLUE)).toBe(true); // moved 200 px left
    await expect(level(page)).toHaveText('100 %');
    await expect(summary(page)).toHaveText('3,840 × 2,160 px canvas, 0 annotations');
  });

  test('F-002.AC8 a 16,384 × 1024 image fits below 10 %; out does nothing; in goes to 10 %', async ({ page }) => {
    await open(page);
    await pasteImage(page, 16_384, 1024);
    const fit = await percent(page);
    expect(fit).toBeLessThan(10);
    await frame(page);
    // The whole canvas is visible: both ends of the strip are on screen.
    const scale = (AREA.width - 48) / 16_384;
    const left = (AREA.width - 16_384 * scale) / 2;
    expect(near(await canvasPixel(page, left + 1, AREA.height / 2), RED)).toBe(true);
    expect(near(await canvasPixel(page, AREA.width - left - 1, AREA.height / 2), BLUE)).toBe(true);
    await button(page, 'Zoom out').click();
    await expect(level(page)).toHaveText(`${fit} %`);
    await button(page, 'Zoom in').click();
    await expect(level(page)).toHaveText('10 %');
  });

  test('F-002.AC9 after fitting (30–31 %) one step in is 50 %; one step out instead is 25 %', async ({ page }) => {
    await open(page);
    await pasteImage(page, 3840, 2160);
    await expect(level(page)).toHaveText('30 %');
    await button(page, 'Zoom in').click();
    await expect(level(page)).toHaveText('50 %');
    await button(page, 'Fit to view').click();
    await expect(level(page)).toHaveText('30 %');
    await button(page, 'Zoom out').click();
    await expect(level(page)).toHaveText('25 %');
  });

  test('F-002.AC10 with nothing selected the Right arrow pans the view right', async ({ page }) => {
    await open(page);
    await pasteImage(page, 3840, 2160);
    await button(page, 'Actual size').click();
    await workArea(page).focus();
    await frame(page);
    const probe = { x: AREA.width / 2 - 20, y: AREA.height / 2 };
    expect(near(await canvasPixel(page, probe.x, probe.y), RED)).toBe(true);
    await page.keyboard.press('ArrowRight');
    await frame(page);
    expect(near(await canvasPixel(page, probe.x, probe.y), BLUE)).toBe(true); // content moved left
    await page.keyboard.press('ArrowLeft');
    await frame(page);
    expect(near(await canvasPixel(page, probe.x, probe.y), RED)).toBe(true);
  });

  test('RULE-19 Shift+Right pans the view 200 screen pixels (Right: 40)', async ({ page }) => {
    await open(page);
    await pasteImage(page, 3840, 2160);
    await button(page, 'Actual size').click();
    await workArea(page).focus();
    await frame(page);
    // The red/blue boundary starts at the centre; after 40 + 200 px it is 240 px left of it.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await frame(page);
    expect(near(await canvasPixel(page, AREA.width / 2 - 236, AREA.height / 2), BLUE)).toBe(true);
    expect(near(await canvasPixel(page, AREA.width / 2 - 244, AREA.height / 2), RED)).toBe(true);
  });

  test('NFR-06 keyboard focus on the canvas shows a focus ring over the image', async ({ page }) => {
    await open(page);
    await pasteImage(page, 400, 300);
    await button(page, 'Actual size').click();
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    const clip = { x: box.x + box.width / 2 - 20, y: box.y, width: 40, height: 4 };
    await page.getByRole('button', { name: 'Open image' }).focus();
    const before = await page.screenshot({ clip });
    await page.keyboard.press('Tab'); // keyboard focus: :focus-visible
    await expect(workArea(page)).toBeFocused();
    const after = await page.screenshot({ clip });
    expect(after.equals(before)).toBe(false);
  });

  test('F-002.R3 Safari trackpad pinch (gesture events) zooms at the pointer', async ({ page }) => {
    // A real trackpad pinch cannot be automated: these are the events WebKit sends for one.
    await open(page);
    await pasteImage(page, 3840, 2160);
    await button(page, 'Actual size').click();
    await expect(level(page)).toHaveText('100 %');
    await page.locator('canvas.tk-canvas').evaluate((el) => {
      const send = (type: string, scale: number) => {
        const e = new Event(type, { bubbles: true, cancelable: true });
        Object.assign(e, { scale, clientX: 600, clientY: 440 });
        el.dispatchEvent(e);
        return e.defaultPrevented;
      };
      if (!send('gesturestart', 1) || !send('gesturechange', 2) || !send('gestureend', 2))
        throw new Error('gesture not kept from the page');
    });
    await expect(level(page)).toHaveText('200 %');
  });

  test('RULE-19 Mod+= and Mod+- zoom anywhere in the tool; Shift+1 and Shift+0 on the canvas', async ({ page }) => {
    const mod = 'ControlOrMeta';
    await open(page);
    await pasteImage(page, 3840, 2160);
    await page.getByRole('button', { name: 'Open image' }).focus();
    await page.keyboard.press(`${mod}+Equal`);
    await expect(level(page)).toHaveText('50 %');
    await page.keyboard.press(`${mod}+Minus`);
    await expect(level(page)).toHaveText('25 %');
    await workArea(page).focus();
    await page.keyboard.press('Shift+Digit0');
    await expect(level(page)).toHaveText('100 %');
    await page.keyboard.press('Shift+Digit1');
    await expect(level(page)).toHaveText('30 %');
  });

  test('F-002.R5 the zoom buttons are described by the current level', async ({ page }) => {
    await open(page);
    await pasteImage(page, 3840, 2160);
    await expect(button(page, 'Zoom in')).toHaveAccessibleDescription('30 %');
  });

  test('F-002 narrow layout: Fit and Actual size are in the menu opened from the level', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto('/');
    await pasteImage(page, 3840, 2160);
    await expect(button(page, 'Fit to view')).toBeHidden();
    const menuButton = statusBar(page).getByRole('button', { name: /^Zoom: \d+ %$/ });
    await menuButton.click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText(['Fit to view', 'Actual size']);
    await expect(menu.getByRole('menuitem', { name: 'Fit to view' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(menuButton).toHaveAccessibleName('Zoom: 100 %');
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
    await menuButton.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`NFR-06 F-002 zoom control has no axe violations (${theme})`, async ({ page }) => {
      const audit = () =>
        new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      await open(page, `?theme=${theme}`);
      expect((await audit()).violations).toEqual([]);
      await pasteImage(page, 3840, 2160);
      await button(page, 'Zoom in').click();
      expect((await audit()).violations).toEqual([]);
      await page.setViewportSize({ width: 390, height: 760 });
      await statusBar(page)
        .getByRole('button', { name: /^Zoom: / })
        .click();
      expect((await audit()).violations).toEqual([]);
    });
  }
});
