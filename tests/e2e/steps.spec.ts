// F-006 Add numbered steps — end to end on the production build (Chromium + WebKit). Same setup as
// draw-shapes.spec.ts: a grey 1000 × 800 image at 100 % in a 1200 × 800 work area, so image pixel
// (x, y) is at (100 + x, y). A badge's number is read by comparing its pixels with references drawn in
// the page in the tool's face (ADR-0009), so the test also proves the face was ready (NFR-08).
// Delete and duplicate (F-006.AC2, AC7) are wired to keys by F-008; their model tests are in
// tests/unit/document.steps.test.ts.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { canvasPixel, summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const IMAGE = { width: 1000, height: 800 };
const GREY = [200, 200, 200, 255];
const HEX = {
  red: '#D62828',
  yellow: '#FFD60A',
  orange: '#F28C28',
  green: '#2DB84D',
  black: '#000000',
  white: '#FFFFFF',
};
const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);

const workArea = (page: Page) => page.locator('main.tk-work-area');
const toolButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('radio', { name });
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
const screen = (x: number, y: number) => ({ x: (AREA.width - IMAGE.width) / 2 + x, y });
const count = (n: number) => `1,000 × 800 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;

async function open(page: Page) {
  await page.setViewportSize(VIEWPORT);
  await page.goto('/');
  await page.evaluate(
    async ({ width, height, grey }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = `rgb(${grey.slice(0, 3).join(',')})`;
      ctx.fillRect(0, 0, width, height);
      const blob = await c.convertToBlob({ type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'grey.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { ...IMAGE, grey: GREY },
  );
  await expect(summary(page)).toHaveText(count(0));
  await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  await frame(page);
}

async function clickImage(page: Page, x: number, y: number) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  const p = screen(x, y);
  await page.mouse.click(box.x + p.x, box.y + p.y);
  await frame(page);
}

async function deselect(page: Page) {
  await workArea(page).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-screen="SCR-Annotator"]')).not.toHaveAttribute('data-state', 'selecting');
  await frame(page);
  await frame(page);
}

/**
 * Which of `candidates` the badge centred on image (cx, cy) shows: the display canvas region is compared
 * with references drawn here over grey in `600 32px Manrope` (a size M step on this image, RULE-04).
 * Returns the best candidate and its mean difference per channel.
 */
async function readStep(page: Page, cx: number, cy: number, colour: string, ink: string, candidates: string[]) {
  const at = screen(cx, cy);
  return page.locator('canvas.tk-canvas').evaluate(
    (el, { at, colour, ink, candidates, grey }) => {
      const c = el as HTMLCanvasElement;
      const k = c.width / c.getBoundingClientRect().width;
      const half = Math.round(36 * k);
      const x0 = Math.round(at.x * k) - half;
      const y0 = Math.round(at.y * k) - half;
      const size = 2 * half;
      const got = c.getContext('2d', { colorSpace: 'srgb' })?.getImageData(x0, y0, size, size).data;
      if (!got) throw new Error('no pixels');
      const score = (label: string, face: string) => {
        const ref = new OffscreenCanvas(size, size);
        const r = ref.getContext('2d', { colorSpace: 'srgb' });
        if (!r) throw new Error('no 2d context');
        r.fillStyle = `rgb(${grey.slice(0, 3).join(',')})`;
        r.fillRect(0, 0, size, size);
        // The badge centre lands at (half, half) of the region, to the sub-pixel.
        r.setTransform(k, 0, 0, k, half + at.x * k - Math.round(at.x * k), half + at.y * k - Math.round(at.y * k));
        r.beginPath();
        r.arc(0, 0, 32, 0, 2 * Math.PI);
        r.fillStyle = colour;
        r.fill();
        r.font = face;
        r.textAlign = 'center';
        r.textBaseline = 'alphabetic';
        r.fillStyle = ink;
        r.fillText(label, 0, 0.36 * 32);
        const want = r.getImageData(0, 0, size, size).data;
        let diff = 0;
        for (let i = 0; i < want.length; i++) diff += Math.abs((want[i] ?? 0) - (got[i] ?? 0));
        return diff / want.length;
      };
      const scored = candidates.map((label) => ({ label, diff: score(label, '600 32px Manrope') }));
      scored.sort((a, b) => a.diff - b.diff);
      const best = scored[0] ?? { label: '', diff: Infinity };
      // The same digit in a fallback face differs clearly more than the tool's face (ADR-0009, NFR-08).
      return { ...best, fallback: score(best.label, '600 32px serif') };
    },
    { at, colour, ink, candidates, grey: GREY },
  );
}

/** The badge's extent on the row through its centre: the run from the first to the last badge pixel. */
async function rowExtent(page: Page, cx: number, cy: number, colour: number[]) {
  const xs: number[] = [];
  for (let x = cx - 40; x <= cx + 40; x++) {
    const p = await canvasPixel(page, screen(x, cy).x, screen(x, cy).y);
    if (near(p, colour, 40)) xs.push(x);
  }
  return xs.length ? (xs.at(-1) ?? 0) - (xs[0] ?? 0) + 1 : 0;
}

/** Pixels inside the badge (within radius 20 of the centre) near `colour`. */
async function inkPixels(page: Page, cx: number, cy: number, colour: number[]) {
  let n = 0;
  for (let dy = -14; dy <= 14; dy += 2)
    for (let dx = -10; dx <= 10; dx += 2) {
      const p = await canvasPixel(page, screen(cx + dx, cy + dy).x, screen(cx + dx, cy + dy).y);
      if (near(p, colour, 30)) n++;
    }
  return n;
}

test.describe('F-006 numbered steps', () => {
  test('F-006.AC1 three clicks with the step tool show badges 1, 2 and 3 in click order', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Step (N)').click();
    await expect(page.locator('[role="status"]')).toContainText('Step tool');
    for (const [x, y] of [
      [200, 200],
      [500, 300],
      [300, 600],
    ] as const)
      await clickImage(page, x, y);
    await expect(summary(page)).toHaveText(count(3));
    await expect(page.locator('[role="status"]')).toContainText('Step added');
    await deselect(page);
    const read = async (x: number, y: number) =>
      (await readStep(page, x, y, HEX.red, HEX.white, ['1', '2', '3', '4'])).label;
    expect(await read(200, 200)).toBe('1');
    expect(await read(500, 300)).toBe('2');
    expect(await read(300, 600)).toBe('3');
  });

  test('F-006.AC3 given steps 1 and 2, another step is 3', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Step (N)').click();
    await clickImage(page, 200, 200);
    await clickImage(page, 400, 200);
    await clickImage(page, 600, 200);
    await deselect(page);
    expect((await readStep(page, 600, 200, HEX.red, HEX.white, ['1', '2', '3', '4'])).label).toBe('3');
  });

  test('F-006.AC4 a yellow step’s number is black and a red one’s white; orange and green are black', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Step (N)').click();
    const swatch = (name: string) =>
      page.getByRole('complementary', { name: 'Style' }).getByRole('radio', { name, exact: true });
    const spots = { Yellow: [200, 200], Red: [400, 200], Orange: [600, 200], Green: [800, 200] } as const;
    for (const [name, [x, y]] of Object.entries(spots)) {
      // With nothing selected the colour becomes the step tool's current style, not the last step's.
      if ((await page.locator('[data-screen="SCR-Annotator"]').getAttribute('data-state')) === 'selecting')
        await deselect(page);
      await swatch(name).check();
      await clickImage(page, x, y);
    }
    await deselect(page);
    const black = rgb(HEX.black);
    const white = rgb(HEX.white);
    expect(await inkPixels(page, 200, 200, black), 'yellow: black digits').toBeGreaterThan(3);
    expect(await inkPixels(page, 200, 200, white), 'yellow: no white digits').toBe(0);
    expect(await inkPixels(page, 400, 200, white), 'red: white digits').toBeGreaterThan(3);
    expect(await inkPixels(page, 400, 200, black), 'red: no black digits').toBe(0);
    expect(await inkPixels(page, 600, 200, black), 'orange: black digits').toBeGreaterThan(3);
    expect(await inkPixels(page, 800, 200, black), 'green: black digits').toBeGreaterThan(3);
    // Each badge shows its number in the pairing colour (a 1, 2, 3, 4 in creation order).
    expect((await readStep(page, 200, 200, HEX.yellow, HEX.black, ['1', '2'])).label).toBe('1');
    expect((await readStep(page, 400, 200, HEX.red, HEX.white, ['1', '2'])).label).toBe('2');
  });

  test('F-006.AC5 on a 1000 × 800 image a step of size M is 64 pixels across', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Step (N)').click();
    await clickImage(page, 500, 400);
    await deselect(page);
    const width = await rowExtent(page, 500, 400, rgb(HEX.red));
    expect(Math.abs(width - 64), `badge width ${width}`).toBeLessThanOrEqual(1);
  });

  test('F-006.AC6 with steps 1 and 2 and focus on the canvas, Enter places step 3 at the centre of the view', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Step (N)').click();
    await clickImage(page, 150, 150);
    await clickImage(page, 300, 150);
    await workArea(page).focus();
    await page.keyboard.press('Enter');
    await expect(summary(page)).toHaveText(count(3));
    await deselect(page);
    // The view's centre is the work area's (600, 400): image (500, 400) at 100 %.
    expect((await readStep(page, 500, 400, HEX.red, HEX.white, ['1', '2', '3', '4'])).label).toBe('3');
  });

  test('NFR-08 ADR-0009 the number is drawn in the tool’s face once the fonts are ready', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.fonts.check('600 32px Manrope', '0123456789'))).toBe(true);
    await toolButton(page, 'Step (N)').click();
    await clickImage(page, 500, 400);
    await deselect(page);
    const r = await readStep(page, 500, 400, HEX.red, HEX.white, ['1']);
    expect(r.diff, 'matches Manrope').toBeLessThan(1);
    expect(r.fallback, 'differs from a fallback face').toBeGreaterThan(r.diff * 2);
  });

  test('NFR-06 axe finds no violations with steps placed and one selected', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Step (N)').click();
    await clickImage(page, 200, 200);
    await clickImage(page, 400, 200);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
