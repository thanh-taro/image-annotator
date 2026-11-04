// F-012 Copy and download the result — end to end on the production build (Chromium + WebKit).
// Downloads are caught by Playwright and read from disk; what the tool hands to the clipboard is recorded
// by wrapping `navigator.clipboard.write` (the real write still runs in the gesture), and on Chromium the
// system clipboard is read back too. Every PNG is decoded in Node (ADR-0019). Also the deferred F-001.AC10
// (export, then paste replaces without asking), F-002.AC7 (zoom and pan change nothing exported) and
// F-018.AC5 (byte-identical in every language).
// F-012.AC8 moves an annotation, which needs F-008: its placeholder is at the end. F-012.AC13's
// "closing the tab still warns" needs F-014: here the session is shown to stay unexported by the replace
// confirmation (F-001.R7), which reads the same RULE-18 state.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  clipboardImage,
  copied,
  copyButton,
  decodePng,
  download,
  downloadButton,
  expectCleanPng,
  maxDiff,
  notice,
  pngRegion,
  recordClipboard,
  toolbar,
} from './support/export';
import { drop, fixture, summary } from './support/load';

const PANEL = 272;
const AREA = { width: 1200, height: 800 };
const VIEWPORT = { width: AREA.width + PANEL, height: 40 + AREA.height + 28 };
const RED = [214, 40, 40, 255]; // annotation.color.red
const BLACK = [0, 0, 0, 255]; // annotation.color.black

const workArea = (page: Page) => page.locator('main.tk-work-area');
const toolButton = (page: Page, name: string) => toolbar(page).getByRole('radio', { name });
const kindGroup = (page: Page) =>
  page.getByRole('complementary', { name: 'Style' }).getByRole('group', { name: 'Redaction type' });
const dialog = (page: Page) => page.getByRole('alertdialog');

/** Pastes a generated opaque image: seeded noise blocks over a light grey, so every pixel is known-ish. */
async function pasteImage(page: Page, width: number, height: number): Promise<void> {
  await page.evaluate(
    async ({ width, height }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d', { colorSpace: 'srgb' });
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(0, 0, width, height);
      let s = 11;
      const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgb(${(rnd() * 255) | 0},${(rnd() * 255) | 0},${(rnd() * 255) | 0})`;
        ctx.fillRect(rnd() * width, rnd() * height, 8 + rnd() * width * 0.1, 8 + rnd() * height * 0.1);
      }
      const blob = await c.convertToBlob({ type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { width, height },
  );
}

const sizeText = (w: number, h: number, n: number) =>
  `${w.toLocaleString('en-US')} × ${h.toLocaleString('en-US')} px canvas, ${n} annotation${n === 1 ? '' : 's'}`;

/** Opens the tool and pastes a w × h image shown at 100 % (the 1:1 view the export must match). */
async function open(page: Page, width = 400, height = 300, query = ''): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`/${query}`);
  await pasteImage(page, width, height);
  await expect(summary(page)).toHaveText(sizeText(width, height, 0));
}

/** Where image pixel (0, 0) is on the page while the image is shown at `zoom` (centred when it fits). */
async function origin(page: Page, width: number, height: number, zoom = 1) {
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  return { x: box.x + (AREA.width - width * zoom) / 2, y: box.y + (AREA.height - height * zoom) / 2 };
}

/** Drags from one image pixel to another (100 % unless `zoom`), with the active tool. */
async function drag(page: Page, size: [number, number], from: [number, number], to: [number, number], zoom = 1) {
  const o = await origin(page, size[0], size[1], zoom);
  await page.mouse.move(o.x + from[0] * zoom, o.y + from[1] * zoom);
  await page.mouse.down();
  await page.mouse.move(o.x + ((from[0] + to[0]) / 2) * zoom, o.y + ((from[1] + to[1]) / 2) * zoom, { steps: 4 });
  await page.mouse.move(o.x + to[0] * zoom, o.y + to[1] * zoom, { steps: 4 });
  await page.mouse.up();
}

async function rectangle(
  page: Page,
  from: [number, number],
  to: [number, number],
  size: [number, number] = [400, 300],
) {
  await toolButton(page, 'Rectangle (R)').click();
  await drag(page, size, from, to);
}

/** Draws a redaction of `kind` (the tool's kind is set with nothing selected, so it is the tool's). */
async function redaction(
  page: Page,
  kind: 'Solid' | 'Blur',
  from: [number, number],
  to: [number, number],
  size: [number, number] = [400, 300],
) {
  await workArea(page).focus();
  await page.keyboard.press('Escape'); // clear the selection: the kind choice is then the tool's
  await toolButton(page, 'Redact (X)').click();
  await kindGroup(page)
    .getByRole('radio', { name: kind === 'Solid' ? /^Solid \(secure\)/ : /^Blur/ })
    .check();
  await drag(page, size, from, to);
}

const allEqual = (px: number[], rgba: number[]) => px.every((v, i) => v === rgba[i % 4]);

/**
 * A JPEG (the 240 × 160 fixture) with an extra APP1 Exif block holding a camera make, a date and GPS
 * location — the metadata F-012.AC4 must never reach an export.
 */
function jpegWithGps(): number[] {
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
  const le16 = (n: number) => [n & 255, (n >> 8) & 255];
  const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  const make = [...ascii('ZZCAMERA'), 0]; // 9 bytes
  const date = [...ascii('2026:10:27 14:05:09'), 0]; // 20 bytes
  // TIFF: header (8) · IFD0 (2 + 3 × 12 + 4 = 42) · make (9) · date (20) · GPS IFD (2 + 2 × 12 + 4 = 30) · 3 rationals (24)
  const ifd0 = 8;
  const makeAt = ifd0 + 42;
  const dateAt = makeAt + make.length;
  const gpsAt = dateAt + date.length;
  const latAt = gpsAt + 30;
  const entry = (tag: number, type: number, count: number, value: number[]) => [
    ...le16(tag),
    ...le16(type),
    ...le32(count),
    ...value,
  ];
  const tiff = [
    ...ascii('II'),
    ...le16(42),
    ...le32(ifd0),
    ...le16(3),
    ...entry(0x010f, 2, make.length, le32(makeAt)),
    ...entry(0x0132, 2, date.length, le32(dateAt)),
    ...entry(0x8825, 4, 1, le32(gpsAt)),
    ...le32(0),
    ...make,
    ...date,
    ...le16(2),
    ...entry(0x0001, 2, 2, [...ascii('N'), 0, 0, 0]),
    ...entry(0x0002, 5, 3, le32(latAt)),
    ...le32(0),
    ...[...le32(48), ...le32(1), ...le32(51), ...le32(1), ...le32(30), ...le32(1)],
  ];
  const app1 = [...ascii('Exif'), 0, 0, ...tiff];
  const jpeg = fixture('orient-1.jpg', 'image/jpeg').bytes;
  const len = app1.length + 2;
  return [0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...app1, ...jpeg.slice(2)];
}

/** True when `needle` occurs in `bytes` (ASCII). */
const contains = (bytes: Uint8Array, needle: string) => {
  const n = [...needle].map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i + n.length <= bytes.length; i++) {
    for (let j = 0; j < n.length; j++) if (bytes[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
};

test.describe('F-012 copy and download', () => {
  test.use({ deviceScaleFactor: 1 });

  test.beforeEach(async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await recordClipboard(page);
  });

  test('F-012.AC1 F-012.R1 Mod+C puts a PNG with every annotation on the clipboard', async ({ page, browserName }) => {
    await open(page);
    await rectangle(page, [40, 40], [200, 160]);
    await redaction(page, 'Solid', [250, 60], [350, 100]);
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+C');
    await expect(notice(page)).toContainText('Copied, with 1 redaction applied.');
    const png = expectCleanPng(await copied(page));
    expect([png.width, png.height]).toEqual([400, 300]);
    // The rectangle's outline (M stroke on s = 300) and the solid redaction are in the picture.
    expect(maxDiff(pngRegion(png, 40, 100, 1, 1), RED)).toBeLessThanOrEqual(2);
    expect(allEqual(pngRegion(png, 250, 60, 100, 40), BLACK)).toBe(true);
    if (browserName === 'chromium') {
      // The system clipboard holds an image (the browser may re-encode it, ADR-0021) with the same pixels.
      const back = await clipboardImage(page);
      expect(back).not.toBeNull();
      const pasted = decodePng(back!);
      expect([pasted.width, pasted.height]).toEqual([400, 300]);
      expect(allEqual(pngRegion(pasted, 250, 60, 100, 40), BLACK)).toBe(true);
    }
  });

  test('F-012.AC2 an image opened from login-bug.jpg downloads as login-bug-annotated.png', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await drop(page, [{ ...fixture('orient-1.jpg', 'image/jpeg'), name: 'login-bug.jpg' }]);
    await expect(summary(page)).toHaveText(sizeText(240, 160, 0));
    const file = await download(page, () => downloadButton(page).click());
    expect(file.name).toBe('login-bug-annotated.png');
    expectCleanPng(file.bytes);
  });

  test.describe('pasted image at a fixed local time', () => {
    test.use({ timezoneId: 'Europe/Berlin' });
    test('F-012.AC3 a pasted image downloaded at 14:05:09 on 27 Oct 2026 is annotated-20261027-140509.png', async ({
      page,
    }) => {
      await page.clock.setFixedTime(new Date('2026-10-27T14:05:09+01:00'));
      await open(page);
      const file = await download(page, async () => {
        await workArea(page).focus();
        await page.keyboard.press('ControlOrMeta+S');
      });
      expect(file.name).toBe('annotated-20261027-140509.png');
    });
  });

  test('F-012.AC4 INV-03 a JPEG with GPS, camera and date metadata exports with none of it', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await drop(page, [{ name: 'trip.jpg', type: 'image/jpeg', bytes: jpegWithGps() }]);
    await expect(summary(page)).toHaveText(sizeText(240, 160, 0));
    await rectangle(page, [20, 20], [120, 100], [240, 160]);
    const file = await download(page, () => downloadButton(page).click());
    expectCleanPng(file.bytes);
    for (const needle of ['Exif', 'ZZCAMERA', '2026:10:27', 'GPS', 'eXIf', 'tEXt', 'iCCP'])
      expect(contains(file.bytes, needle), needle).toBe(false);
  });

  test('F-012.AC5 F-012.R3 a 2880 × 1800 image with no crop or padding exports at 2880 × 1800', async ({ page }) => {
    await open(page, 2880, 1800);
    const file = await download(page, () => downloadButton(page).click());
    const png = expectCleanPng(file.bytes);
    expect([png.width, png.height]).toEqual([2880, 1800]);
  });

  test('F-012.AC6 two solid and one blur redaction: copying says 3 redactions applied', async ({ page }) => {
    await open(page);
    await redaction(page, 'Solid', [20, 20], [120, 60]);
    await redaction(page, 'Solid', [20, 100], [120, 140]);
    await redaction(page, 'Blur', [200, 100], [300, 200]);
    await expect(toolbar(page).getByText('3 redactions', { exact: true })).toBeVisible();
    await copyButton(page).click();
    await expect(notice(page)).toContainText('Copied, with 3 redactions applied.');
    await expect(notice(page)).toHaveClass(/tk-notice--success/);
  });

  test('F-012.AC9 NFR-01 copying and downloading a full session sends no request', async ({ page }) => {
    await open(page);
    await rectangle(page, [40, 40], [200, 160]);
    await redaction(page, 'Blur', [200, 100], [300, 200]);
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await copyButton(page).click();
    await expect(notice(page)).toContainText('Copied');
    await download(page, () => downloadButton(page).click());
    await expect(notice(page)).toContainText('Downloaded');
    expect(requests.filter((u) => !u.startsWith('blob:') && !u.startsWith('data:'))).toEqual([]);
  });

  test('F-012.AC10 one solid redaction: downloaded with 1 redaction; none: downloaded', async ({ page }) => {
    await open(page);
    await download(page, () => downloadButton(page).click());
    await expect(notice(page)).toHaveText(/^Downloaded annotated-\d{8}-\d{6}\.png\.$/);
    await redaction(page, 'Solid', [20, 20], [120, 60]);
    await download(page, () => downloadButton(page).click());
    await expect(notice(page)).toHaveText(/^Downloaded annotated-\d{8}-\d{6}\.png, with 1 redaction applied\.$/);
  });

  test('F-012.AC11 F-012.R8 RULE-20 a redaction outside the canvas is not counted, before or after copying', async ({
    page,
  }) => {
    await open(page);
    await redaction(page, 'Solid', [20, 20], [120, 60]);
    // Drawn in the surround left of the 400 px canvas (centred in the 1200 px work area): outside the canvas.
    await redaction(page, 'Solid', [-300, 20], [-200, 60]);
    await expect(summary(page)).toHaveText(sizeText(400, 300, 2));
    await expect(toolbar(page).getByText('1 redaction', { exact: true })).toBeVisible();
    await copyButton(page).click();
    await expect(notice(page)).toContainText('Copied, with 1 redaction applied.');
  });

  test('F-012.AC12 with no redactions no count is shown', async ({ page }) => {
    await open(page);
    await rectangle(page, [40, 40], [200, 160]);
    await expect(toolbar(page).locator('.tk-count')).toHaveCount(0);
    await expect(copyButton(page)).toBeEnabled();
  });

  test('F-012.AC7 F-012.R5 a refused clipboard shows COPY-error.clipboard with a download that works', async ({
    page,
  }) => {
    await recordClipboard(page, { refuse: true });
    await open(page);
    await rectangle(page, [40, 40], [200, 160]);
    await copyButton(page).click();
    await expect(notice(page)).toContainText('The browser blocked copying the image. Download it instead.');
    await expect(notice(page)).toHaveClass(/tk-notice--error/);
    const file = await download(page, () =>
      notice(page).getByRole('button', { name: 'Download', exact: true }).click(),
    );
    expect(file.name).toMatch(/^annotated-\d{8}-\d{6}\.png$/);
    await expect(notice(page)).toContainText('Downloaded');
    // Review m2: the notice's button is gone, and focus is on the canvas region, not the page.
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('F-012.AC13 F-012.R7 when the image cannot be produced: COPY-error.export_failed, nothing saved, still unexported', async ({
    page,
  }) => {
    // The platform encoder returns nothing (as it may when out of memory).
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
        setTimeout(() => cb(null), 0);
      };
    });
    await open(page);
    await rectangle(page, [40, 40], [200, 160]);
    const downloads: unknown[] = [];
    page.on('download', (d) => downloads.push(d));
    await downloadButton(page).click();
    await expect(notice(page)).toContainText("The image couldn't be exported. Try again, or crop it smaller.");
    await expect(notice(page)).toHaveClass(/tk-notice--error/);
    expect(downloads).toEqual([]);
    // Still unexported (RULE-18): a new image asks before replacing (F-001.R7).
    await pasteImage(page, 200, 100);
    await expect(dialog(page)).toBeVisible();
  });

  test('F-001.AC10 right after an export, with nothing changed, pasting another image replaces it without asking', async ({
    page,
  }) => {
    await open(page);
    await rectangle(page, [40, 40], [200, 160]);
    await copyButton(page).click();
    await expect(notice(page)).toContainText('Copied');
    await pasteImage(page, 200, 100);
    await expect(summary(page)).toHaveText(sizeText(200, 100, 0));
    await expect(dialog(page)).toHaveCount(0);
  });

  test('F-002.AC7 INV-05 zooming and panning change nothing exported and add no undo step', async ({ page }) => {
    await open(page);
    await rectangle(page, [40, 40], [200, 160]);
    await redaction(page, 'Blur', [200, 100], [300, 200]);
    await workArea(page).focus();
    await page.keyboard.press('Escape');
    const before = await download(page, () => downloadButton(page).click());
    await workArea(page).focus();
    await page.keyboard.press('ControlOrMeta+=');
    await page.keyboard.press('ControlOrMeta+=');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.tk-zoom__level')).not.toHaveText('100 %');
    const after = await download(page, () => downloadButton(page).click());
    expect(after.bytes).toEqual(before.bytes);
    // No undo step: the session is still exported, so a new image replaces it without asking.
    await pasteImage(page, 200, 100);
    await expect(summary(page)).toHaveText(sizeText(200, 100, 0));
    await expect(dialog(page)).toHaveCount(0);
  });

  test('F-018.AC5 INV-05 the same image and annotations export byte-identical, with the same name, in vi-VN and en-US', async ({
    page,
  }) => {
    const exportIn = async (query: string) => {
      await page.setViewportSize(VIEWPORT);
      await page.goto(`/${query}`);
      await drop(page, [fixture('wide-2000x1000.png', 'image/png')]);
      await expect(summary(page)).not.toHaveText('');
      await page.locator('header.tk-toolbar [data-tool="rectangle"]').click();
      await drag(page, [2000, 1000], [200, 200], [900, 600], 0.6);
      await page.locator('header.tk-toolbar [data-tool="step"]').click();
      const o = await origin(page, 2000, 1000, 0.6);
      await page.mouse.click(o.x + 1200 * 0.6, o.y + 500 * 0.6);
      await expect(summary(page)).toContainText(query ? '2 chú thích' : '2 annotations');
      const name = query ? 'Tải xuống' : 'Download';
      return download(page, () => page.getByRole('button', { name, exact: true }).click());
    };
    const en = await exportIn('');
    const vi = await exportIn('?lang=vi-VN');
    expect(vi.name).toBe(en.name);
    expect(vi.name).toBe('wide-2000x1000-annotated.png');
    expect(vi.bytes).toEqual(en.bytes);
  });

  test('NFR-06 F-012 the export actions and the clipboard error have no axe violations', async ({ page }) => {
    await recordClipboard(page, { refuse: true });
    await open(page);
    await redaction(page, 'Solid', [20, 20], [120, 60]);
    await copyButton(page).click();
    await expect(notice(page)).toContainText('The browser blocked');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  });

  test('CMP-Toolbar narrow: the overflow holds the download, opened and closed from the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await page.goto('/');
    await pasteImage(page, 400, 300);
    await expect(summary(page)).toHaveText(sizeText(400, 300, 0));
    await expect(downloadButton(page)).toHaveCount(0);
    const more = toolbar(page).getByRole('button', { name: 'More actions' });
    await more.click();
    const menu = page.getByRole('menu', { name: 'More actions' });
    await expect(menu.getByRole('menuitem', { name: 'Download' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(more).toBeFocused();
    await more.click();
    const file = await download(page, () => menu.getByRole('menuitem', { name: 'Download' }).click());
    expect(file.name).toMatch(/^annotated-\d{8}-\d{6}\.png$/);
  });

  test('CMP-Toolbar count fallback: when the full count would not fit, icon and number with the full text as its name', async ({
    page,
  }) => {
    await open(page);
    await redaction(page, 'Solid', [20, 20], [120, 60]);
    await redaction(page, 'Solid', [20, 100], [120, 140]);
    const row = page.locator('.tk-toolbar__row').filter({ has: page.locator('.tk-count') });
    // Compact: the full text fits.
    await page.setViewportSize({ width: 900, height: VIEWPORT.height });
    await expect(toolbar(page).locator('.tk-count:visible')).toHaveText('2 redactions');
    await expect(toolbar(page).getByRole('img', { name: '2 redactions' })).toHaveCount(0);
    // Forced: the count's text is made wider than the row has room for (a long translation).
    await page.addStyleTag({ content: '.tk-count { letter-spacing: 40px; }' });
    await page.setViewportSize({ width: 880, height: VIEWPORT.height }); // the row is measured again
    const short = toolbar(page).getByRole('img', { name: '2 redactions' });
    await expect(short).toBeVisible();
    await expect(short).toHaveText('2');
    await expect(short.locator('svg')).toHaveCount(1);
    // F-018.R7: neither the row nor the page scrolls sideways (the hidden probe adds no width).
    // No toolbar item is squeezed either (the hidden probe clips itself by design).
    const fits = await row.evaluate((el) =>
      [el, ...el.children]
        .filter((c) => !c.classList.contains('tk-count-probe'))
        .every((c) => c.scrollWidth <= c.clientWidth),
    );
    expect(fits).toBe(true);
    const page_ = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(page_).toBe(true);
  });

  test('CMP-Toolbar no image: copy and download are disabled', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await expect(copyButton(page)).toBeDisabled();
    await expect(downloadButton(page)).toBeDisabled();
  });

  test.fixme('F-012.AC8 after copying, moving an annotation and copying again reflects the move (needs F-008 move)', async () => {});
});
