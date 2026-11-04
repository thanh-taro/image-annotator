// F-007 Redact — end to end on the production build (Chromium + WebKit). The work area is 1200 × 800
// (as in draw-shapes.spec.ts). A synthetic screenshot (seeded noise, light rows and dark "email" text) is
// generated in the page and pasted; it is shown at 100 % with device pixel ratio 1, so the display canvas
// shows image pixel (x, y) at a fixed offset, drawn 1:1 by MOD-Render `paint` — the same function the
// export uses (ADR-0004, NFR-08). The blur is compared with the slow reference of ADR-0006
// (src/effects/reference.ts) computed here in Node from the image's own pixels.
// The exported file (F-012) is checked too: downloaded, decoded in Node (ADR-0019) and compared with the
// same reference. AC9's "sent behind" and AC10's "brought to front" use the order controls (F-008). Still
// waiting: AC13 (crop and padding, F-010/F-011) — the named `test.fixme` placeholder at the end.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { referenceBlur, referencePixelate } from '../../src/effects/reference';
import { download, downloadButton, expectCleanPng, pngRegion } from './support/export';
import { summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const BLACK = [0, 0, 0, 255]; // annotation.color.black
const RED = [214, 40, 40, 255]; // annotation.color.red

interface Shot {
  readonly width: number;
  readonly height: number;
  /** Where image pixel (0, 0) is in the work area at 100 % (the canvas is centred when it fits). */
  readonly at: { readonly x: number; readonly y: number };
}

const workArea = (page: Page) => page.locator('main.tk-work-area');
const toolButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('radio', { name });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Style' });
const kindGroup = (page: Page) => panel(page).getByRole('group', { name: 'Redaction type' });
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

/**
 * Generates and pastes a synthetic screenshot, returning its RGBA pixels (base64) as drawn: seeded
 * coloured noise, three light rows, and an "email" in dark text on each row.
 */
async function open(
  page: Page,
  width: number,
  height: number,
  query = '',
): Promise<{ shot: Shot; pixels: Uint8ClampedArray }> {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`/${query}`);
  const b64 = await page.evaluate(
    async ({ width, height }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d', { colorSpace: 'srgb' });
      if (!ctx) throw new Error('no 2d context');
      let s = 7;
      const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
      for (let y = 0; y < height; y += 4)
        for (let x = 0; x < width; x += 4) {
          ctx.fillStyle = `rgb(${(rnd() * 255) | 0},${(rnd() * 255) | 0},${(rnd() * 255) | 0})`;
          ctx.fillRect(x, y, 4, 4);
        }
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#f4f4f6';
        ctx.fillRect(20, 40 + i * 80, width - 40, 40);
        ctx.fillStyle = '#111';
        ctx.font = '16px sans-serif';
        ctx.fillText(`jane.doe${i}@example.com`, 40, 66 + i * 80);
      }
      const data = ctx.getImageData(0, 0, width, height, { colorSpace: 'srgb' }).data;
      const blob = await c.convertToBlob({ type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      let bin = '';
      for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    { width, height },
  );
  const w = width.toLocaleString('en-US');
  const h = height.toLocaleString('en-US');
  await expect(summary(page)).toHaveText(`${w} × ${h} px canvas, 0 annotations`);
  if ((await page.locator('.tk-zoom__level').textContent()) !== '100 %')
    await page.locator('footer.tk-status-bar').getByRole('button', { name: 'Actual size', exact: true }).click();
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  await frame(page);
  const at = { x: Math.max(0, (AREA.width - width) / 2), y: Math.max(0, (AREA.height - height) / 2) };
  return { shot: { width, height, at }, pixels: Uint8ClampedArray.from(atob(b64), (ch) => ch.charCodeAt(0)) };
}

/** Drags in image pixels; `hold` keeps the pointer down at the end for that long before releasing. */
async function dragImage(page: Page, shot: Shot, from: [number, number], to: [number, number]) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  await page.mouse.move(box.x + shot.at.x + from[0], box.y + shot.at.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + shot.at.x + (from[0] + to[0]) / 2, box.y + shot.at.y + (from[1] + to[1]) / 2, {
    steps: 4,
  });
  await page.mouse.move(box.x + shot.at.x + to[0], box.y + shot.at.y + to[1], { steps: 4 });
}

/** RGBA of the display canvas over an image-pixel box, row-major. */
async function region(page: Page, shot: Shot, x: number, y: number, w: number, h: number): Promise<number[]> {
  return page.locator('canvas.tk-canvas').evaluate(
    (el, r) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d', { colorSpace: 'srgb' });
      return Array.from(ctx?.getImageData(r.x, r.y, r.w, r.h).data ?? []);
    },
    { x: shot.at.x + x, y: shot.at.y + y, w, h },
  );
}

async function deselect(page: Page) {
  await workArea(page).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-screen="SCR-Annotator"]')).not.toHaveAttribute('data-state', 'selecting');
  await frame(page);
  await frame(page);
}

/** Largest per-channel difference between two RGBA lists. */
const maxDiff = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  return m;
};
const allEqual = (px: number[], rgba: number[]) => px.every((v, i) => v === rgba[i % 4]);

/** RULE-10 blur M on s = 300 is r = max(10, 6) = 10. */
const BLUR_M_300 = 10;

test.describe('F-007 redact', () => {
  // One device pixel per CSS pixel on every engine (Desktop Safari defaults to 2), so at 100 % the display
  // canvas holds the image 1:1, as the export does.
  test.use({ deviceScaleFactor: 1 });

  test('F-007.AC6 F-007.R4 when the tool is first picked, its kind is solid (secure)', async ({ page }) => {
    await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await expect(kindGroup(page).getByRole('radio', { name: /^Solid \(secure\)/ })).toBeChecked();
    // Solid offers colour only: no size, fill or strength (F-007.R2), and no warning.
    await expect(panel(page).getByRole('group', { name: 'Color' })).toBeVisible();
    for (const name of ['Size', 'Fill', 'Strength'])
      await expect(panel(page).getByRole('group', { name, exact: true })).toHaveCount(0);
    await expect(panel(page).getByRole('note')).toHaveCount(0);
  });

  test('F-007.AC1 F-007.R2 dragging over an email with the solid kind covers it with an opaque black box', async ({
    page,
  }) => {
    const { shot } = await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await dragImage(page, shot, [30, 48], [230, 74]);
    await page.mouse.up();
    await expect(summary(page)).toHaveText('400 × 300 px canvas, 1 annotation');
    await deselect(page);
    expect(allEqual(await region(page, shot, 30, 48, 200, 26), BLACK)).toBe(true);
    // Just outside, the image is unchanged.
    expect(allEqual(await region(page, shot, 30, 46, 200, 1), BLACK)).toBe(false);
  });

  test('F-007.AC2 F-007.R2 a selected solid redaction offers no opacity or fill choice', async ({ page }) => {
    const { shot } = await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await dragImage(page, shot, [30, 48], [230, 74]);
    await page.mouse.up();
    await expect(page.locator('[data-screen="SCR-Annotator"]')).toHaveAttribute('data-state', 'selecting');
    await expect(panel(page)).toHaveAttribute('data-variant', 'selection');
    await expect(kindGroup(page)).toBeVisible();
    await expect(panel(page).getByRole('group', { name: 'Fill', exact: true })).toHaveCount(0);
    await expect(panel(page).getByText(/opacity/i)).toHaveCount(0);
  });

  test('F-007.AC5 F-007.R4 RULE-10 choosing blur or pixelate shows the not-secure note and offers solid', async ({
    page,
  }) => {
    await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    // RULE-10: the not-secure tag is on the blur and pixelate choices wherever they are shown.
    await expect(kindGroup(page).getByText('Not secure', { exact: true })).toHaveCount(2);
    for (const kind of ['Blur', 'Pixelate']) {
      await kindGroup(page)
        .getByRole('radio', { name: new RegExp(`^${kind}`) })
        .check();
      const note = panel(page).getByRole('note');
      await expect(note).toHaveText('Not secure: blurred or pixelated text can sometimes be recovered.');
      await expect(panel(page).getByRole('group', { name: 'Strength' })).toBeVisible();
      await panel(page).getByRole('button', { name: 'Use solid' }).click();
      await expect(kindGroup(page).getByRole('radio', { name: /^Solid \(secure\)/ })).toBeChecked();
      await expect(note).toHaveCount(0);
    }
  });

  test('F-007.AC4 F-007.R3 RULE-10 pixelate M on a 1000 × 800 image shows 16 × 16 blocks from the box corner, updating while dragging', async ({
    page,
  }) => {
    const { shot, pixels } = await open(page, 1000, 800);
    await toolButton(page, 'Redact (X)').click();
    await kindGroup(page)
      .getByRole('radio', { name: /^Pixelate/ })
      .check();
    // Checked in the page (one boolean back): every 16 × 16 block from (x, y), the last ones cut by the box
    // edge, is one colour, and the blocks are not all alike (it is pixelated, not flat).
    const blocks = (x: number, y: number, w: number, h: number) =>
      page.locator('canvas.tk-canvas').evaluate(
        (el, r) => {
          const ctx = (el as HTMLCanvasElement).getContext('2d', { colorSpace: 'srgb' });
          if (!ctx) return false;
          const px = ctx.getImageData(r.x, r.y, r.w, r.h).data;
          const firsts = new Set<number>();
          for (let by = 0; by < r.h; by += 16)
            for (let bx = 0; bx < r.w; bx += 16) {
              const f = (by * r.w + bx) * 4;
              firsts.add((px[f]! << 16) | (px[f + 1]! << 8) | px[f + 2]!);
              for (let yy = by; yy < Math.min(by + 16, r.h); yy++)
                for (let xx = bx; xx < Math.min(bx + 16, r.w); xx++)
                  for (let c = 0; c < 4; c++) if (px[(yy * r.w + xx) * 4 + c] !== px[f + c]) return false;
            }
          return firsts.size > 1;
        },
        { x: shot.at.x + x, y: shot.at.y + y, w, h },
      );
    const box = await workArea(page).boundingBox();
    const to = (x: number, y: number) => page.mouse.move(box!.x + shot.at.x + x, box!.y + shot.at.y + y, { steps: 4 });
    // While dragging (pointer still down): blocks over the box as it is now — first a box that is not a
    // multiple of 16 (150 × 70: the last column and row of blocks are cut short), then a larger one.
    await dragImage(page, shot, [96, 64], [96 + 150, 64 + 70]);
    await expect.poll(() => blocks(96, 64, 150, 70)).toBe(true);
    await to(96 + 320, 64 + 192);
    await expect.poll(() => blocks(96, 64, 320, 192)).toBe(true);
    // Released: the exact patch, equal to the reference pixelate (ADR-0006), still 16 × 16 blocks.
    await page.mouse.up();
    await deselect(page);
    const ref = referencePixelate(
      { data: pixels, width: 1000, height: 800 },
      { x: 0, y: 0, width: 1000, height: 800 },
      { x: 96, y: 64, width: 320, height: 192 },
      16,
      [],
    );
    await expect
      .poll(async () => maxDiff(await region(page, shot, 96, 64, 320, 192), ref!.data))
      .toBeLessThanOrEqual(1);
    expect(await blocks(96, 64, 320, 192)).toBe(true);
  });

  test('F-007.AC7 F-007.R3 a blur over text equals the reference blur of the image within ±1 per channel (as painted)', async ({
    page,
  }) => {
    const { shot, pixels } = await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await kindGroup(page).getByRole('radio', { name: /^Blur/ }).check();
    await dragImage(page, shot, [30, 44], [230, 78]);
    await page.mouse.up();
    await deselect(page);
    const img = { data: pixels, width: 400, height: 300 };
    const frameBox = { x: 0, y: 0, width: 400, height: 300 };
    const ref = referenceBlur(img, frameBox, { x: 30, y: 44, width: 200, height: 34 }, BLUR_M_300, []);
    expect(ref).not.toBeNull();
    await expect
      .poll(async () => maxDiff(await region(page, shot, 30, 44, 200, 34), ref!.data), { timeout: 10_000 })
      .toBeLessThanOrEqual(1);
    // The text is gone: the box differs from the original image there.
    const original = Array.from({ length: 200 * 34 * 4 }, (_, i) => {
      const x = (i >> 2) % 200;
      const y = Math.floor((i >> 2) / 200);
      return pixels[((44 + y) * 400 + 30 + x) * 4 + (i & 3)] ?? 0;
    });
    expect(maxDiff(await region(page, shot, 30, 44, 200, 34), original)).toBeGreaterThan(40);
  });

  test('F-007.AC9 F-007.R3 a later blur over part of an arrow shows the image alone; the arrow outside is unchanged', async ({
    page,
  }) => {
    const { shot, pixels } = await open(page, 400, 300);
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, shot, [40, 200], [360, 200]);
    await page.mouse.up();
    await toolButton(page, 'Redact (X)').click();
    await deselect(page); // the arrow stays selected after it is drawn; the kind is then the tool's
    await kindGroup(page).getByRole('radio', { name: /^Blur/ }).check();
    await dragImage(page, shot, [150, 170], [250, 230]);
    await page.mouse.up();
    await deselect(page);
    const ref = referenceBlur(
      { data: pixels, width: 400, height: 300 },
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 150, y: 170, width: 100, height: 60 },
      BLUR_M_300,
      [],
    );
    await expect
      .poll(async () => maxDiff(await region(page, shot, 150, 170, 100, 60), ref!.data), { timeout: 10_000 })
      .toBeLessThanOrEqual(1);
    // The arrow's shaft outside the box is still the arrow's red.
    expect(maxDiff(await region(page, shot, 100, 200, 1, 1), RED)).toBeLessThanOrEqual(24);
  });

  test('F-007.AC10 INV-02 a later blur over half a solid redaction never shows through it', async ({ page }) => {
    const { shot, pixels } = await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await dragImage(page, shot, [30, 128], [230, 154]);
    await page.mouse.up();
    await deselect(page); // with the solid still selected, the kind choice would change it (F-007.R6)
    await kindGroup(page).getByRole('radio', { name: /^Blur/ }).check();
    await dragImage(page, shot, [130, 110], [330, 170]);
    await page.mouse.up();
    await deselect(page);
    // Approximation and exact patch alike: the solid shows, whatever the order (RULE-10).
    expect(allEqual(await region(page, shot, 30, 128, 200, 26), BLACK)).toBe(true);
    // The exact patch arrives: the blur above the solid equals the reference with the solid applied …
    const ref = referenceBlur(
      { data: pixels, width: 400, height: 300 },
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 130, y: 110, width: 200, height: 60 },
      BLUR_M_300,
      [{ box: { x: 30, y: 128, width: 200, height: 26 }, rgb: [0, 0, 0] }],
    );
    const top = ref!.data.slice(0, 200 * 18 * 4); // rows 110–127, above the solid
    await expect.poll(async () => maxDiff(await region(page, shot, 130, 110, 200, 18), top)).toBeLessThanOrEqual(1);
    // … and the solid still shows through none of it.
    expect(allEqual(await region(page, shot, 30, 128, 200, 26), BLACK)).toBe(true);
  });

  test('F-007.AC8 F-007.R6 a selected pixelate switched to solid becomes an opaque box in the current solid colour', async ({
    page,
  }) => {
    const { shot } = await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await kindGroup(page)
      .getByRole('radio', { name: /^Pixelate/ })
      .check();
    await dragImage(page, shot, [60, 60], [180, 140]);
    await page.mouse.up();
    await expect(panel(page)).toHaveAttribute('data-variant', 'selection');
    await kindGroup(page)
      .getByRole('radio', { name: /^Solid \(secure\)/ })
      .check();
    await deselect(page);
    expect(allEqual(await region(page, shot, 60, 60, 120, 80), BLACK)).toBe(true);
    await expect(summary(page)).toHaveText('400 × 300 px canvas, 1 annotation');
  });

  test('F-007.AC12 F-007.R1 Enter places a default-size redaction of the current kind at the centre, selected', async ({
    page,
  }) => {
    const { shot } = await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await workArea(page).focus();
    await page.keyboard.press('Enter');
    await expect(summary(page)).toHaveText('400 × 300 px canvas, 1 annotation');
    await expect(page.locator('[data-screen="SCR-Annotator"]')).toHaveAttribute('data-state', 'selecting');
    await deselect(page);
    // RULE-05: 20 % of s = 60 px, centred on (200, 150).
    expect(allEqual(await region(page, shot, 171, 121, 58, 58), BLACK)).toBe(true);
    expect(allEqual(await region(page, shot, 160, 150, 8, 1), BLACK)).toBe(false);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`NFR-06 F-007 the redaction choices and the not-secure note have no axe violations (${theme})`, async ({
      page,
    }) => {
      await open(page, 400, 300, `?theme=${theme}`);
      await toolButton(page, 'Redact (X)').click();
      await kindGroup(page).getByRole('radio', { name: /^Blur/ }).check();
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(result.violations).toEqual([]);
    });
  }

  test('F-007.AC3 INV-02 every exported pixel inside a solid redaction over text is exactly its colour, fully opaque', async ({
    page,
  }) => {
    const { shot } = await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await dragImage(page, shot, [30, 48], [230, 74]);
    await page.mouse.up();
    await deselect(page);
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    expect(allEqual(pngRegion(png, 30, 48, 200, 26), BLACK)).toBe(true);
    // The image around the box is still there (the export is not blank).
    expect(allEqual(pngRegion(png, 30, 46, 200, 1), BLACK)).toBe(false);
  });

  test('F-007.AC7 INV-02 the downloaded blur equals the reference within ±1 and the file holds one image, no extra blocks', async ({
    page,
  }) => {
    const { shot, pixels } = await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await kindGroup(page).getByRole('radio', { name: /^Blur/ }).check();
    await dragImage(page, shot, [30, 44], [230, 78]);
    await page.mouse.up();
    await deselect(page);
    // Downloaded at once: the export waits for the exact patch itself (never the approximation, ADR-0007).
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    const ref = referenceBlur(
      { data: pixels, width: 400, height: 300 },
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 30, y: 44, width: 200, height: 34 },
      BLUR_M_300,
      [],
    );
    expect(maxDiff(pngRegion(png, 30, 44, 200, 34), ref!.data)).toBeLessThanOrEqual(1);
  });

  test('F-007.AC9 exported: inside a later blur over an arrow the pixels are the reference blur of the image alone', async ({
    page,
  }) => {
    const { shot, pixels } = await open(page, 400, 300);
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, shot, [40, 200], [360, 200]);
    await page.mouse.up();
    await toolButton(page, 'Redact (X)').click();
    await deselect(page);
    await kindGroup(page).getByRole('radio', { name: /^Blur/ }).check();
    await dragImage(page, shot, [150, 170], [250, 230]);
    await page.mouse.up();
    await deselect(page);
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    const ref = referenceBlur(
      { data: pixels, width: 400, height: 300 },
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 150, y: 170, width: 100, height: 60 },
      BLUR_M_300,
      [],
    );
    expect(maxDiff(pngRegion(png, 150, 170, 100, 60), ref!.data)).toBeLessThanOrEqual(1);
    // The arrow's shaft outside the box is unchanged.
    expect(maxDiff(pngRegion(png, 100, 200, 1, 1), RED)).toBeLessThanOrEqual(24);
  });

  test('F-007.AC10 INV-02 exported: a blur drawn later over half a solid never shows through it', async ({ page }) => {
    const { shot, pixels } = await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await dragImage(page, shot, [30, 128], [230, 154]);
    await page.mouse.up();
    await deselect(page);
    await kindGroup(page).getByRole('radio', { name: /^Blur/ }).check();
    await dragImage(page, shot, [130, 110], [330, 170]);
    await page.mouse.up();
    await deselect(page);
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    expect(allEqual(pngRegion(png, 30, 128, 200, 26), BLACK)).toBe(true);
    const ref = referenceBlur(
      { data: pixels, width: 400, height: 300 },
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 130, y: 110, width: 200, height: 60 },
      BLUR_M_300,
      [{ box: { x: 30, y: 128, width: 200, height: 26 }, rgb: [0, 0, 0] }],
    );
    expect(maxDiff(pngRegion(png, 130, 110, 200, 18), ref!.data.slice(0, 200 * 18 * 4))).toBeLessThanOrEqual(1);
  });

  test('F-007.AC11 F-007.R2 INV-02 a solid drawn from a fractional x at 33 % exports its first column entirely in its colour', async ({
    page,
    browserName,
  }) => {
    // 3490 × 2000 fits the 1200 × 800 work area (less Fit's 24 px margin, space.6) at 1152 / 3490 ≈ 33 %; a pointer
    // 3.43 screen pixels right of the canvas edge is at image x ≈ 10.4 (rounded to 3 by an engine: x ≈ 9.1).
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(3490, 2000);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(0, 0, 3490, 2000);
      const dt = new DataTransfer();
      dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'big.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(summary(page)).toHaveText('3,490 × 2,000 px canvas, 0 annotations');
    await expect(page.locator('.tk-zoom__level')).toHaveText('33 %');
    const zoom = (AREA.width - 48) / 3490;
    const area = await workArea(page).boundingBox();
    if (!area) throw new Error('no work area');
    const top = area.y + (AREA.height - 2000 * zoom) / 2;
    const left = area.x + (AREA.width - 3490 * zoom) / 2;
    await toolButton(page, 'Redact (X)').click();
    await page.mouse.move(left + 3.43, top + 300 * zoom);
    await page.mouse.down();
    await page.mouse.move(left + 40, top + 450 * zoom, { steps: 4 });
    await page.mouse.move(left + 63.43, top + 600 * zoom, { steps: 4 });
    await page.mouse.up();
    await expect(summary(page)).toHaveText('3,490 × 2,000 px canvas, 1 annotation');
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    // The box's first column: the first black pixel on a middle row.
    const row = pngRegion(png, 0, 450, 40, 1);
    const first = Array.from({ length: 40 }, (_, x) => x).find((x) => allEqual(row.slice(x * 4, x * 4 + 4), BLACK));
    expect([9, 10]).toContain(first);
    // Chromium keeps the pointer's fraction (x ≈ 10.4): INV-02's floor gives exactly column 10.
    if (browserName === 'chromium') expect(first).toBe(10);
    // Whatever the engine's rounding, pixel column 10 (the AC's) is entirely the redaction colour.
    expect(allEqual(pngRegion(png, 10, 305, 1, 290), BLACK)).toBe(true);
    // That column is entirely the redaction colour over the box's rows; the one before it is untouched.
    expect(allEqual(pngRegion(png, first!, 305, 1, 290), BLACK)).toBe(true);
    expect(allEqual(pngRegion(png, first! - 1, 305, 1, 290), [200, 200, 200, 255])).toBe(true);
  });

  test('F-007.AC9 sent behind the arrow with COPY-action.send_backward, the arrow is drawn over the blur', async ({
    page,
  }) => {
    const { shot } = await open(page, 400, 300);
    await toolButton(page, 'Arrow (A)').click();
    await dragImage(page, shot, [40, 200], [360, 200]);
    await page.mouse.up();
    await toolButton(page, 'Redact (X)').click();
    await deselect(page);
    await kindGroup(page).getByRole('radio', { name: /^Blur/ }).check();
    await dragImage(page, shot, [150, 170], [250, 230]);
    await page.mouse.up();
    // Before: the blur hides the arrow inside its box.
    await deselect(page);
    expect(maxDiff(await region(page, shot, 200, 200, 1, 1), RED)).toBeGreaterThan(24);
    // The blur (just drawn, so selected again with a click) is sent behind the arrow.
    await toolButton(page, 'Select (V)').click();
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    await page.mouse.click(box.x + shot.at.x + 160, box.y + shot.at.y + 180);
    await panel(page).getByRole('button', { name: 'Send backward' }).click();
    await deselect(page);
    await expect.poll(async () => maxDiff(await region(page, shot, 200, 200, 1, 1), RED)).toBeLessThanOrEqual(24);
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    expect(maxDiff(pngRegion(png, 200, 200, 1, 1), RED)).toBeLessThanOrEqual(24);
  });

  test('F-007.AC10 INV-02 a later blur sent behind and brought to the front again never shows through the solid', async ({
    page,
  }) => {
    const { shot } = await open(page, 400, 300);
    await toolButton(page, 'Redact (X)').click();
    await dragImage(page, shot, [30, 128], [230, 154]);
    await page.mouse.up();
    await deselect(page);
    await kindGroup(page).getByRole('radio', { name: /^Blur/ }).check();
    await dragImage(page, shot, [130, 110], [330, 170]);
    await page.mouse.up(); // the blur is selected
    const actions = panel(page);
    await actions.getByRole('button', { name: 'Send backward' }).click();
    await deselect(page); // the blur's selection outline crosses the solid box
    expect(allEqual(await region(page, shot, 30, 128, 200, 26), BLACK)).toBe(true);
    // Select the blur again where the solid does not cover it, and bring it to the front of the two.
    await toolButton(page, 'Select (V)').click();
    const box = await workArea(page).boundingBox();
    if (!box) throw new Error('no work area');
    await page.mouse.click(box.x + shot.at.x + 300, box.y + shot.at.y + 160);
    await actions.getByRole('button', { name: 'Bring forward' }).click();
    await deselect(page);
    expect(allEqual(await region(page, shot, 30, 128, 200, 26), BLACK)).toBe(true);
    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    expect(allEqual(pngRegion(png, 30, 128, 200, 26), BLACK)).toBe(true);
  });
  test('D-031 RULE-10 CMP-StylePanel narrow: the summary bar shows the Not secure tag after blur and pixelate, in its name', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto('/');
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(400, 300);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(0, 0, 400, 300);
      const dt = new DataTransfer();
      dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'g.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(summary(page)).toHaveText('400 × 300 px canvas, 0 annotations');
    await toolButton(page, 'Redact (X)').click();
    const bar = page.locator('.tk-panel__bar');
    // Solid is secure: no tag.
    await expect(bar).toHaveAccessibleName('Style options: Solid (secure)');
    await expect(bar.locator('.tk-tag')).toHaveCount(0);
    await bar.click();
    const sheet = page.locator('#tk-style-sheet');
    for (const kind of ['Blur', 'Pixelate']) {
      await sheet.getByRole('radio', { name: new RegExp(`^${kind}`) }).check();
      await expect(bar).toHaveAccessibleName(`Style options: ${kind} Not secure · Medium`);
      const tag = bar.locator('.tk-tag');
      await expect(tag).toHaveText('Not secure');
      await expect(tag).toBeVisible();
    }
  });
  test.fixme('F-007.AC13 a blur spanning a cropped frame’s edge exports white in the padding and reads no pixel outside the frame (needs F-010, F-011)', async () => {});
});
