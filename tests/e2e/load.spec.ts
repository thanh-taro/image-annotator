// F-001 Load an image — end to end on the production build (Chromium + WebKit; adapters/tests.md).
// Paste and drop are dispatched with real fixture files (tests/e2e/support/load.ts); decoding is the
// engine's own (ADR-0005, ADR-0018). AC9, AC10 and AC14 need unexported changes, which only drawing
// features can make; they are covered in tests/unit/app.load.test.ts and deferred in the build plan. AC16 and AC17 need MOD-Host's
// focus tracking and ready signal (F-015).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Request } from '@playwright/test';
import {
  canvasBox,
  canvasPixel,
  dragOver,
  drop,
  expectLoaded,
  fixture,
  fixturePath,
  noticeText,
  paste,
  summary,
} from './support/load';

const PNG_WIDE = fixture('wide-2000x1000.png', 'image/png');
const PNG = fixture('fmt.png', 'image/png');
const JPEG = fixture('orient-1.jpg', 'image/jpeg');
const JPEG_ROTATED = fixture('orient-6.jpg', 'image/jpeg');
const WEBP = fixture('fmt.webp', 'image/webp');
const GIF = fixture('fmt-anim.gif', 'image/gif');
const BMP = fixture('fmt.bmp', 'image/bmp');
const HEIC = fixture('fmt.heic', 'image/heic');
const BROKEN = fixture('broken.png', 'image/png');
const LARGE = fixture('large-6000x3400.png', 'image/png');
const LARGE_ROTATED = fixture('large-rot6.jpg', 'image/jpeg');
const TRANSPARENT = fixture('transparent.png', 'image/png');
const PDF = { name: 'report.pdf', type: 'application/pdf', bytes: Array.from('%PDF-1.7\n%\n', (c) => c.charCodeAt(0)) };

const UNSUPPORTED = /^This file type isn't supported\. Use PNG, JPEG, WebP, GIF,( BMP,)? (or )?(BMP|AVIF)\.$/;

const state = (page: Page) => page.locator('[data-screen="SCR-Annotator"]');
const near = (a: number[], b: number[], tolerance = 24) => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= tolerance);

async function open(page: Page, query = '') {
  await page.goto(`/${query}`);
  await expect(state(page)).toHaveAttribute('data-state', 'empty');
}

test.describe('F-001 load an image', () => {
  test('F-001.AC11 standalone empty state names paste, drop and open', async ({ page }) => {
    await open(page);
    const empty = page.locator('.tk-empty');
    await expect(empty.getByRole('heading', { name: 'Paste, drop or open an image' })).toBeVisible();
    await expect(empty.locator('.tk-empty__hint')).toHaveText(
      /^Press (Ctrl\+V|⌘V) to paste a screenshot, drop an image file here, or choose Open image\.$/,
    );
    await expect(empty.getByRole('button', { name: 'Open image' })).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('button')).toHaveText('Open image');
  });

  test('F-001.AC1 pasting a PNG screenshot shows it fitted to the view at full resolution', async ({ page }) => {
    await open(page);
    await paste(page, [PNG_WIDE]);
    await expectLoaded(page, 2000, 1000);
    await expect(state(page)).toHaveAttribute('data-state', 'default');
    await expect(page.locator('[role="status"]')).toHaveText('Image opened, 2,000 × 1,000 px');

    // Fit (RULE-12): the whole image is visible, centred, inside the work area's margin, below 100 %.
    const box = await canvasBox(page);
    const scale = Math.min(1, (box.width - 48) / 2000, (box.height - 48) / 1000);
    const left = (box.width - 2000 * scale) / 2;
    const top = (box.height - 1000 * scale) / 2;
    const green = [16, 192, 16, 255];
    expect(near(await canvasPixel(page, box.width / 2, box.height / 2), green)).toBe(true);
    expect(near(await canvasPixel(page, left + 3, top + 3), green)).toBe(true);
    expect(near(await canvasPixel(page, left + 2000 * scale - 3, top + 1000 * scale - 3), green)).toBe(true);
    // ADR-0016: the surround outside the canvas is color.work-area (light #ECE8F4 or dark #0B0812).
    const surround = await canvasPixel(page, left - 6, box.height / 2);
    expect(near(surround, [236, 232, 244, 255], 4) || near(surround, [11, 8, 18, 255], 4)).toBe(true);
  });

  test('F-001.AC2 dragging a JPEG shows COPY-load.drop_here; dropping it loads it', async ({ page }) => {
    await open(page);
    const drag = await dragOver(page, [JPEG]);
    await expect(page.locator('.tk-drop')).toBeVisible();
    await expect(page.locator('.tk-drop')).toHaveText('Drop to open');
    await expect(state(page)).toHaveAttribute('data-state', 'dragging-file');
    await expect(page.locator('[role="status"]')).toHaveText('Drop to open');
    await drag.drop();
    await expect(page.locator('.tk-drop')).toHaveCount(0);
    await expectLoaded(page, 240, 160);
  });

  test('F-001.R2 the drop overlay disappears when the drag leaves or on Esc', async ({ page }) => {
    await open(page);
    const drag = await dragOver(page, [JPEG]);
    await expect(page.locator('.tk-drop')).toBeVisible();
    await drag.leave();
    await expect(page.locator('.tk-drop')).toHaveCount(0);
    await dragOver(page, [JPEG]);
    await expect(page.locator('.tk-drop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.tk-drop')).toHaveCount(0);
    await expect(page.locator('[role="status"]')).toHaveText('');
  });

  test('F-001.AC3 choosing COPY-action.open and picking a WebP file loads it', async ({ page }) => {
    await open(page);
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.tk-empty').getByRole('button', { name: 'Open image' }).click();
    await (await chooser).setFiles(fixturePath(WEBP.name));
    await expectLoaded(page, 240, 160);
  });

  test('F-001.R3 the toolbar open action and Mod+O open the file picker at any time', async ({ page }) => {
    await open(page);
    await paste(page, [PNG]);
    await expectLoaded(page, 240, 160);
    let chooser = page.waitForEvent('filechooser');
    await page.getByRole('toolbar').getByRole('button', { name: 'Open image' }).click();
    await (await chooser).setFiles(fixturePath(JPEG.name));
    await expectLoaded(page, 240, 160);
    chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('ControlOrMeta+o');
    await (await chooser).setFiles(fixturePath(BMP.name));
    await expectLoaded(page, 8, 8);
  });

  test('F-001.AC4 pasting plain text over an image changes nothing and shows COPY-load.no_image_in_clipboard', async ({
    page,
  }) => {
    await open(page);
    await paste(page, [PNG_WIDE]);
    await expectLoaded(page, 2000, 1000);
    await paste(page, [], { 'text/plain': 'just some text' });
    await expect(noticeText(page)).toHaveText('The clipboard has no image.');
    await expect(page.locator('[role="alert"]')).toHaveText('The clipboard has no image.');
    await expectLoaded(page, 2000, 1000);
  });

  for (const file of [PDF, HEIC]) {
    test(`F-001.AC5 dropping ${file.name} over an image leaves the session unchanged and shows COPY-error.unsupported_format`, async ({
      page,
    }) => {
      await open(page);
      await paste(page, [PNG_WIDE]);
      await expectLoaded(page, 2000, 1000);
      await drop(page, [file]);
      await expect(noticeText(page)).toHaveText(UNSUPPORTED);
      await expect(state(page)).toHaveAttribute('data-state', 'error');
      await expectLoaded(page, 2000, 1000);
    });
  }

  test('F-001.AC6 a 60 MB file is refused with COPY-error.file_too_large', async ({ page }) => {
    await open(page);
    await drop(page, [{ name: 'huge.png', type: 'image/png', size: 60_000_000, prefix: PNG.bytes }]);
    await expect(noticeText(page)).toHaveText('This file is larger than 50 MB.');
    await expect(summary(page)).toHaveCount(0);
    await expect(page.locator('.tk-empty')).toBeVisible();
  });

  test('F-001.AC7 a 6000 × 3400 image offers to open scaled down to 5441 × 3083', async ({ page }) => {
    await open(page);
    await paste(page, [LARGE]);
    const dialog = page.getByRole('alertdialog', { name: 'This image is very large' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Open it scaled down to 5,441 × 3,083 px? The original file is not changed.');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await dialog.getByRole('button', { name: 'Open scaled down' }).click();
    await expect(dialog).toHaveCount(0);
    await expectLoaded(page, 5441, 3083);
  });

  test('F-001.AC7 cancelling the scale-down (Cancel or Esc) leaves the session unchanged', async ({ page }) => {
    await open(page);
    await paste(page, [LARGE]);
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.tk-empty')).toBeVisible();

    await paste(page, [PNG]);
    await expectLoaded(page, 240, 160);
    await paste(page, [LARGE]);
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Open scaled down' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expectLoaded(page, 240, 160);
  });

  test('F-001.AC8 a JPEG whose metadata says rotated 90° is shown upright with width and height swapped', async ({
    page,
  }) => {
    await open(page);
    await drop(page, [JPEG_ROTATED]); // stored 160 × 240, orientation 6
    await expectLoaded(page, 240, 160);
    const box = await canvasBox(page);
    const scale = Math.min(1, (box.width - 48) / 240, (box.height - 48) / 160);
    const left = (box.width - 240 * scale) / 2;
    const top = (box.height - 160 * scale) / 2;
    expect(near(await canvasPixel(page, left + 60, top + 60), [224, 16, 16, 255], 40)).toBe(true); // red top-left
    expect(near(await canvasPixel(page, left + 180, top + 60), [16, 192, 16, 255], 40)).toBe(true); // green top-right
    expect(near(await canvasPixel(page, left + 60, top + 120), [16, 48, 224, 255], 40)).toBe(true); // blue bottom-left
  });

  test('F-001.AC12 dropping three image files loads the first and shows COPY-load.first_only', async ({ page }) => {
    await open(page);
    await drop(page, [BMP, PNG, JPEG]);
    await expectLoaded(page, 8, 8);
    await expect(noticeText(page)).toHaveText('Opened the first image only.');
  });

  test('F-001.AC13 a file that claims to be PNG but cannot be decoded shows COPY-error.decode_failed', async ({
    page,
  }) => {
    await open(page);
    await drop(page, [BROKEN]);
    await expect(noticeText(page)).toHaveText("This image couldn't be opened. The file may be damaged.");
    await expect(page.locator('.tk-empty')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(noticeText(page)).toHaveCount(0);
  });

  test('F-001.AC15 a pasted web fragment referring to a remote image is never fetched', async ({ page, baseURL }) => {
    const requests: string[] = [];
    page.on('request', (r: Request) => requests.push(r.url()));
    await open(page);
    await page.waitForLoadState('networkidle');
    const before = requests.length;
    await paste(page, [], {
      'text/html': '<img src="https://images.example.com/secret.png">',
      'text/uri-list': 'https://images.example.com/secret.png',
      'text/plain': 'https://images.example.com/secret.png',
    });
    await expect(noticeText(page)).toHaveText('The clipboard has no image.');
    await page.waitForTimeout(500);
    expect(requests.slice(before)).toEqual([]);
    const origin = new URL(baseURL ?? '').origin;
    expect(requests.filter((u) => !u.startsWith('data:') && new URL(u).origin !== origin)).toEqual([]);
  });

  test('RULE-01 an animated GIF loads its first frame only', async ({ page }) => {
    await open(page);
    await paste(page, [GIF]);
    await expectLoaded(page, 240, 160);
    const box = await canvasBox(page);
    const scale = Math.min(1, (box.width - 48) / 240, (box.height - 48) / 160);
    const left = (box.width - 240 * scale) / 2;
    const top = (box.height - 160 * scale) / 2;
    expect(near(await canvasPixel(page, left + 60, top + 60), [224, 16, 16, 255], 40)).toBe(true);
  });

  test('F-001 edge case: a paste while text is being edited never loads an image', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const field = document.createElement('textarea');
      field.id = 'probe';
      document.body.append(field);
      field.focus();
    });
    await paste(page, [PNG]);
    await page.waitForTimeout(300);
    await expect(summary(page)).toHaveCount(0);
    await expect(noticeText(page)).toHaveCount(0);
  });

  test('F-001 edge case: a clipboard holding an image and text uses the image', async ({ page }) => {
    await open(page);
    await paste(page, [PNG], { 'text/plain': 'a caption' });
    await expectLoaded(page, 240, 160);
    await expect(noticeText(page)).toHaveCount(0);
  });

  test('F-001 edge case: a transparent PNG is shown over the checkerboard', async ({ page }) => {
    await open(page);
    await paste(page, [TRANSPARENT]);
    await expectLoaded(page, 64, 64);
    const box = await canvasBox(page);
    const centre = await canvasPixel(page, box.width / 2, box.height / 2);
    const checker = [
      [255, 255, 255, 255],
      [230, 225, 240, 255],
      [42, 35, 51, 255],
      [30, 24, 40, 255],
    ];
    expect(checker.some((c) => near(centre, c, 4))).toBe(true);
  });

  test('F-001 edge case: input while a dialog is open is ignored', async ({ page }) => {
    await open(page);
    await paste(page, [LARGE]);
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await paste(page, [PNG]);
    await drop(page, [JPEG]);
    await page.waitForTimeout(300);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(page.locator('.tk-empty')).toBeVisible();
    await expect(summary(page)).toHaveCount(0);
  });

  test('F-001 edge case: input while an image is loading is ignored', async ({ page }) => {
    await page.addInitScript(() => {
      // The next decode after the test sets __delayDecode takes 1.5 s.
      const original = window.createImageBitmap.bind(window);
      const w = window as unknown as { __delayDecode?: boolean };
      window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
        if (!w.__delayDecode) return original(...args);
        w.__delayDecode = false;
        return new Promise((r) => setTimeout(r, 1500)).then(() => original(...args));
      }) as typeof createImageBitmap;
    });
    await open(page);
    await page.evaluate(() => ((window as unknown as { __delayDecode?: boolean }).__delayDecode = true));
    await paste(page, [PNG_WIDE]);
    await page.waitForTimeout(100);
    await paste(page, [PNG]);
    await expectLoaded(page, 2000, 1000);
    await page.waitForTimeout(300);
    await expectLoaded(page, 2000, 1000);
  });

  test('F-001 edge case: in a multi-file drop the first file that passes RULE-01 loads, with first_only', async ({
    page,
  }) => {
    await open(page);
    await drop(page, [PDF, PNG]);
    await expectLoaded(page, 240, 160);
    await expect(noticeText(page)).toHaveText('Opened the first image only.');
    await expect(page.locator('[role="status"]')).toContainText('Image opened, 240 × 160 px');
    await expect(page.locator('[role="status"]')).toContainText('Opened the first image only.');
  });

  test('F-001 edge case: in a multi-file drop where none passes, the first refusal shows', async ({ page }) => {
    await open(page);
    await drop(page, [PDF, HEIC]);
    await expect(noticeText(page)).toHaveText(UNSUPPORTED);
    await expect(page.locator('.tk-empty')).toBeVisible();
  });

  test('RULE-03 ADR-0023 an over-limit JPEG with orientation 6 is offered at its upright size', async ({ page }) => {
    await open(page);
    await paste(page, [LARGE_ROTATED]); // stored 3400 × 6000, orientation 6
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Open it scaled down to 5,441 × 3,083 px?');
    await dialog.getByRole('button', { name: 'Open scaled down' }).click();
    await expectLoaded(page, 5441, 3083);
    const box = await canvasBox(page);
    expect(near(await canvasPixel(page, box.width / 2, box.height / 2), [51, 102, 204, 255], 24)).toBe(true);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`NFR-06 F-001 states have no axe violations (${theme})`, async ({ page }) => {
      const axe = () =>
        new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const violations = async () => (await axe()).violations.map((v) => `${v.id}: ${v.help}`);
      await open(page, `?theme=${theme}`);
      expect(await violations()).toEqual([]);
      await dragOver(page, [PNG]);
      await expect(page.locator('.tk-drop')).toBeVisible();
      expect(await violations()).toEqual([]);
      await page.keyboard.press('Escape');
      await drop(page, [BROKEN]);
      await expect(noticeText(page)).toBeVisible();
      expect(await violations()).toEqual([]);
      await paste(page, [LARGE]);
      await expect(page.getByRole('alertdialog')).toBeVisible();
      expect(await violations()).toEqual([]);
      await page.keyboard.press('Escape');
      await paste(page, [PNG_WIDE]);
      await expectLoaded(page, 2000, 1000);
      expect(await violations()).toEqual([]);
    });
  }
});
