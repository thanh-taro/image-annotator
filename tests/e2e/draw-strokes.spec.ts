// F-004 Draw strokes and highlights — end to end on the production build (Chromium + WebKit). As in
// draw-shapes.spec.ts, the work area is 1200 × 800 and a 1000 × 800 image is pasted and shown at
// 100 %, so image pixel (x, y) is at (100 + x, y) in the work area. On it (s = 800) the pen's stroke M
// is 5 px and the highlight's width (L) is 3 × 10 = 30 px. Marks are checked by the pixels they paint.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { canvasPixel, summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const IMAGE = { width: 1000, height: 800 };
const GREY = [200, 200, 200, 255];
const RED = [214, 40, 40, 255]; // annotation.color.red #D62828
const YELLOW = [255, 214, 10]; // annotation.color.yellow #FFD60A
/** RULE-09: yellow at 40 % over a pixel. */
const highlighted = (under: number[]) => [...YELLOW.map((v, i) => 0.4 * v + 0.6 * (under[i] ?? 0)), 255];
const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);

/** WCAG relative luminance and contrast ratio of two sRGB pixels. */
const luminance = (p: number[]) => {
  const [r, g, b] = p.slice(0, 3).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const workArea = (page: Page) => page.locator('main.tk-work-area');
const toolButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('radio', { name });
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
const screen = (x: number, y: number) => ({ x: (AREA.width - IMAGE.width) / 2 + x, y });
const pixel = (page: Page, x: number, y: number) => canvasPixel(page, screen(x, y).x, screen(x, y).y);
const count = (n: number) => `1,000 × 800 px canvas, ${n} annotation${n === 1 ? '' : 's'}`;

/** Text-like rows: black bars 12 px wide every 24 px from x = 100 to 600, y = 200 to 230, on white. */
const TEXT_ROW = { y: 200, height: 30, from: 100, to: 600, bar: 12, pitch: 24 };

async function open(page: Page, kind: 'grey' | 'text' = 'grey') {
  await page.setViewportSize(VIEWPORT);
  await page.goto('/');
  await page.evaluate(
    async ({ width, height, grey, kind, row }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = kind === 'text' ? '#fff' : `rgb(${grey.slice(0, 3).join(',')})`;
      ctx.fillRect(0, 0, width, height);
      if (kind === 'text') {
        ctx.fillStyle = '#000';
        for (let x = row.from; x < row.to; x += row.pitch) ctx.fillRect(x, row.y, row.bar, row.height);
      }
      const blob = await c.convertToBlob({ type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'image.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { ...IMAGE, grey: GREY, kind, row: TEXT_ROW },
  );
  await expect(summary(page)).toHaveText(count(0));
  await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  await frame(page);
}

/** A drag through image points, `steps` mouse moves per leg, optionally with Shift held throughout. */
async function dragPath(page: Page, points: [number, number][], { shift = false, steps = 5 } = {}) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  const to = ([x, y]: [number, number]) => ({ x: box.x + screen(x, y).x, y: box.y + screen(x, y).y });
  const [first, ...rest] = points.map(to);
  if (!first) return;
  await page.mouse.move(first.x, first.y);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.down();
  for (const p of rest) await page.mouse.move(p.x, p.y, { steps });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await frame(page);
}

/** Esc on the canvas clears the selection, so the marks' own pixels show (RULE-19). */
async function deselect(page: Page) {
  await workArea(page).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-screen="SCR-Annotator"]')).not.toHaveAttribute('data-state', 'selecting');
  await frame(page);
  await frame(page);
}

test.describe('F-004 draw strokes and highlights', () => {
  test('F-004.AC1 a zig-zag with the pen is one red stroke along the path, curved smoothly through the samples', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Pen (P)').click();
    await dragPath(page, [
      [100, 100],
      [150, 200],
      [200, 100],
      [250, 200],
      [300, 100],
    ]);
    await expect(summary(page)).toHaveText(count(1));
    await expect(page.locator('[role="status"]')).toContainText('Pen added');
    await expect(page.locator('[data-screen="SCR-Annotator"]')).toHaveAttribute('data-state', 'selecting');
    await deselect(page);
    // On each leg of the path, and not between the teeth.
    for (const [x, y] of [
      [125, 150],
      [175, 150],
      [225, 150],
      [275, 150],
    ] as const)
      expect(near(await pixel(page, x, y), RED), `leg ${x},${y}`).toBe(true);
    for (const [x, y] of [
      [150, 130],
      [200, 170],
    ] as const)
      expect(near(await pixel(page, x, y), GREY), `between ${x},${y}`).toBe(true);
    // The samples around the turn at (150, 200) are 10 × 20 px apart: the curve rounds the turn (its tip
    // is at y = 195, so the 5 px stroke covers up to 197.5), where joined segments would reach 200.
    expect(near(await pixel(page, 150, 194), RED), 'on the rounded turn').toBe(true);
    expect(near(await pixel(page, 150, 199), GREY), 'no corner at the sample').toBe(true);
  });

  test('F-004.AC2 a highlight over black text on white is yellow at 40 % and the text stays readable', async ({
    page,
  }) => {
    await open(page, 'text');
    await toolButton(page, 'Highlight (H)').click();
    await dragPath(page, [
      [80, 215],
      [620, 215],
    ]);
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    const paper = await pixel(page, 118, 215); // between two bars
    const ink = await pixel(page, 106, 215); // on a bar
    expect(near(paper, highlighted([255, 255, 255]), 6), `paper ${paper}`).toBe(true);
    expect(near(ink, highlighted([0, 0, 0]), 6), `ink ${ink}`).toBe(true);
    // Readable: the text keeps at least WCAG AA contrast (4.5 : 1) against the highlighted paper.
    expect(contrast(paper, ink)).toBeGreaterThanOrEqual(4.5);
    // Outside the highlight the image is unchanged.
    expect(near(await pixel(page, 118, 250), [255, 255, 255, 255], 2)).toBe(true);
  });

  test('F-004.AC3 dragging back over the same spot in one highlight does not darken it', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Highlight (H)').click();
    await dragPath(
      page,
      [
        [100, 300],
        [400, 300],
        [200, 300],
      ],
      { steps: 10 },
    );
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    const twice = await pixel(page, 300, 300); // covered going right and coming back
    const once = await pixel(page, 150, 300); // covered going right only
    expect(near(once, highlighted(GREY), 4), `once ${once}`).toBe(true);
    expect(near(twice, once, 2), `twice ${twice} vs once ${once}`).toBe(true);
  });

  test('F-004.AC4 with Shift a mostly sideways highlight drag is perfectly horizontal', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Highlight (H)').click();
    await dragPath(
      page,
      [
        [100, 500],
        [250, 480],
        [400, 530],
      ],
      { shift: true },
    );
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    // A 30 px band from y = 485 to 515 along the whole run, square at its ends (x = 85 to 415).
    for (const x of [100, 250, 400])
      for (const y of [487, 500, 513])
        expect(near(await pixel(page, x, y), highlighted(GREY), 6), `band ${x},${y}`).toBe(true);
    for (const x of [100, 250, 400])
      for (const y of [482, 518]) expect(near(await pixel(page, x, y), GREY, 4), `outside ${x},${y}`).toBe(true);
    // It did not follow the pointer up to (250, 480) or down to (400, 530).
    expect(near(await pixel(page, 400, 528), GREY, 4)).toBe(true);
  });

  test('F-004.AC5 a click with the pen places a dot of the stroke size (5 px)', async ({ page }) => {
    await open(page);
    await toolButton(page, 'Pen (P)').click();
    await dragPath(page, [
      [500, 400],
      [501, 401],
    ]);
    await expect(summary(page)).toHaveText(count(1));
    await deselect(page);
    expect(near(await pixel(page, 500, 400), RED)).toBe(true);
    expect(near(await pixel(page, 501, 401), RED, 60)).toBe(true);
    for (const [x, y] of [
      [504, 400],
      [496, 400],
      [500, 404],
      [500, 396],
    ] as const)
      expect(near(await pixel(page, x, y), GREY, 4), `outside ${x},${y}`).toBe(true);
  });

  test('F-004.AC6 with the highlight tool and canvas focus, Enter places a selected highlight dot at the view centre', async ({
    page,
  }) => {
    await open(page);
    const zoomIn = page.locator('footer.tk-status-bar').getByRole('button', { name: 'Zoom in', exact: true });
    for (let i = 0; i < 8 && (await page.locator('.tk-zoom__level').textContent()) !== '200 %'; i++)
      await zoomIn.click();
    await expect(page.locator('.tk-zoom__level')).toHaveText('200 %');
    await workArea(page).focus();
    await page.keyboard.press('h'); // RULE-19 H picks the highlight tool on the canvas
    await expect(toolButton(page, 'Highlight (H)')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowDown'); // pans 40 px: the image centre is no longer the view centre
    await frame(page);
    await page.keyboard.press('Enter');
    await expect(summary(page)).toHaveText(count(1));
    await expect(page.locator('[data-screen="SCR-Annotator"]')).toHaveAttribute('data-state', 'selecting');
    await expect(page.locator('[role="status"]')).toContainText('Highlight added');
    await deselect(page);
    // A 30 px square dot = 60 screen px at 200 %, centred on the view's centre (600, 400).
    const c = { x: AREA.width / 2, y: AREA.height / 2 };
    for (const [dx, dy] of [
      [0, 0],
      [-25, -25],
      [25, 25],
    ] as const)
      expect(near(await canvasPixel(page, c.x + dx, c.y + dy), highlighted(GREY), 6), `dot ${dx},${dy}`).toBe(true);
    for (const [dx, dy] of [
      [0, -36],
      [0, 36],
      [-36, 0],
      [36, 0],
    ] as const)
      expect(near(await canvasPixel(page, c.x + dx, c.y + dy), GREY, 4), `outside ${dx},${dy}`).toBe(true);
  });

  test('NFR-06 the pen and highlight tools are in the tool radio group with their shortcuts; axe finds nothing', async ({
    page,
  }) => {
    await open(page);
    await toolButton(page, 'Pen (P)').click();
    await expect(toolButton(page, 'Pen (P)')).toHaveAttribute('aria-checked', 'true');
    await expect(toolButton(page, 'Pen (P)')).toHaveAttribute('aria-keyshortcuts', 'P');
    await expect(toolButton(page, 'Highlight (H)')).toHaveAttribute('aria-keyshortcuts', 'H');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('CMP-Toolbar narrow at 320 px with an image: the tool row scrolls, the page does not, the last tool is reachable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto('/');
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(400, 300);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(0, 0, 400, 300);
      const blob = await c.convertToBlob({ type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'small.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(summary(page)).toHaveText('400 × 300 px canvas, 0 annotations');
    const sizes = () =>
      page.evaluate(() => {
        const strip = document.querySelector('.tk-tools__strip') as HTMLElement;
        return {
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          strip: strip.scrollWidth - strip.clientWidth,
          scrolled: strip.scrollLeft,
        };
      });
    const before = await sizes();
    expect(before.page).toBeLessThanOrEqual(0);
    expect(before.strip).toBeGreaterThan(0);
    await toolButton(page, 'Select (V)').focus();
    await page.keyboard.press('End'); // the last built tool (F-006)
    await expect(toolButton(page, 'Step (N)')).toBeFocused();
    await expect(toolButton(page, 'Step (N)')).toHaveAttribute('aria-checked', 'true');
    await expect(toolButton(page, 'Step (N)')).toBeInViewport({ ratio: 1 });
    const after = await sizes();
    expect(after.scrolled).toBeGreaterThan(0);
    expect(after.page).toBeLessThanOrEqual(0);
  });
});
