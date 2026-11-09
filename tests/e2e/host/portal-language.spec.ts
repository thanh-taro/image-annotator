// F-018 Use the portal's language (RULE-16, RULE-17, ADR-0015) on the multi-origin harness: the
// language from the address before first display, live taro:language messages, the browser
// fallback, the origin/source/value checks, 320 px and the Vietnamese faces in the initial load.
// AC7 (every SCR-Annotator state at 320 px) is in ./narrow-states.spec.ts; AC5 (export) in tests/e2e/export.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import { CATALOG } from '../../../src/copy/messages.gen';
import { download, expectCleanPng, pngRegion } from '../support/export';
import { HOST_ALLOWED, TOOL_ALLOWED, hostPageUrl } from '../support/urls';
import {
  markWindow,
  postFromForeignOrigin,
  postFromSibling,
  settle,
  SHELL,
  stillSameWindow,
  toolFrame,
} from './support';

/** Every en-US string that differs from its vi-VN text (plural forms included). */
const ENGLISH_ONLY: string[] = (() => {
  const out: string[] = [];
  const flat = (v: unknown): string[] =>
    typeof v === 'string' ? [v] : Object.values(v as Record<string, string>).filter((x) => typeof x === 'string');
  const en = CATALOG['en-US'] as Record<string, unknown>;
  const vi = CATALOG['vi-VN'] as Record<string, unknown>;
  for (const id of Object.keys(en)) {
    const viTexts = new Set(flat(vi[id]));
    for (const text of flat(en[id])) if (!viTexts.has(text) && text.length > 2) out.push(text);
  }
  return out;
})();

const sendTheme = (page: Page, value: string) =>
  page.evaluate((v) => (window as unknown as { __sendTheme: (v: string) => void }).__sendTheme(v), value);

const sendLanguage = (page: Page, value: unknown) =>
  page.evaluate((v) => (window as unknown as { __sendLanguage: (v: unknown) => void }).__sendLanguage(v), value);

async function expectUi(page: Page, lang: 'en-US' | 'vi-VN') {
  const tool = page.frameLocator('#tool');
  await expect(tool.locator('html')).toHaveAttribute('lang', lang);
  await expect(tool.locator('main')).toHaveAccessibleName(CATALOG[lang]['a11y.canvas'] as string);
  await expect(tool.getByRole('toolbar')).toHaveAccessibleName(CATALOG[lang]['a11y.toolbar'] as string);
}

test('F-018.AC1 vi-VN in the address: every string in vi-VN from first display, never English first', async ({
  page,
}) => {
  // The browser prefers English, so any fallback would show English.
  await page.addInitScript((tool) => {
    if (location.origin !== tool) return;
    const seen = new Set<string>();
    const langs: string[] = [];
    Object.assign(window, { __texts: seen, __langs: langs });
    const record = () => {
      // The page language from the moment there is anything to display (index.html's static
      // lang attribute precedes the boot script, while the document has no body yet).
      const html = document.documentElement;
      if (document.body && langs[langs.length - 1] !== html.lang) langs.push(html.lang);
      for (const el of Array.from(document.querySelectorAll('*'))) {
        for (const a of ['aria-label', 'title', 'placeholder', 'alt'])
          if (el.hasAttribute(a)) seen.add(el.getAttribute(a)!);
        for (const n of Array.from(el.childNodes))
          if (n.nodeType === 3 && n.textContent!.trim()) seen.add(n.textContent!.trim());
      }
    };
    new MutationObserver(record).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  }, TOOL_ALLOWED);
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'vi-VN'));
  const frame = await toolFrame(page);
  await expectUi(page, 'vi-VN');
  const { texts, langs } = await frame.evaluate(() => {
    const w = window as unknown as { __texts: Set<string>; __langs: string[] };
    return { texts: [...w.__texts], langs: w.__langs };
  });
  expect(langs.filter((l) => l)).toEqual(['vi-VN']);
  expect(texts.filter((s) => ENGLISH_ONLY.includes(s))).toEqual([]);
  expect(texts).toContain(CATALOG['vi-VN']['a11y.canvas']);
});

test('F-018.R2 a language message switches the UI live, without reloading', async ({ page }) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'vi-VN'));
  const frame = await toolFrame(page);
  await markWindow(frame);
  await expectUi(page, 'vi-VN');

  await sendLanguage(page, 'en-US');
  await expectUi(page, 'en-US');
  // Edge case: the same language again is applied with no visible change; the theme message sent
  // after it by the same window proves it was processed.
  await sendLanguage(page, 'en-US');
  await sendTheme(page, 'light');
  await expect(page.frameLocator('#tool').locator('html')).toHaveAttribute('data-theme', 'light');
  await expectUi(page, 'en-US');
  await sendTheme(page, 'dark');
  // RULE-17 matching applies to messages too: `vi` → vi-VN.
  await sendLanguage(page, 'vi');
  await expectUi(page, 'vi-VN');
  await expect(page.frameLocator('#tool').locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await stillSameWindow(frame)).toBe(true);
  // ADR-0015 §7: the document title is re-set from COPY-app.title on every switch.
  expect(await frame.evaluate(() => document.title)).toBe(CATALOG['vi-VN']['app.title']);
});

test('F-018.AC2 F-018.R2 a language message keeps the image, annotations, selection, arrow tool, zoom and history', async ({
  page,
}) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'vi-VN'));
  const frame = await toolFrame(page);
  await markWindow(frame);
  await expectUi(page, 'vi-VN');
  await frame.evaluate(async () => {
    const c = new OffscreenCanvas(400, 300);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, 400, 300);
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'grey.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  const tool = page.frameLocator('#tool');
  await expect(tool.locator('#tk-canvas-summary')).toContainText(', 0 chú thích');
  await tool.getByRole('radio', { name: `${CATALOG['vi-VN']['tool.arrow'] as string} (A)` }).click();
  const area = await tool.locator('main.tk-work-area').boundingBox();
  if (!area) throw new Error('no work area');
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  await page.mouse.move(cx - 60, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 20, { steps: 4 });
  await page.mouse.move(cx + 60, cy + 40, { steps: 4 });
  await page.mouse.up();
  await expect(tool.locator('#tk-canvas-summary')).toContainText(', 1 chú thích');
  const fields = tool.locator('.tk-geometry__input');
  await expect(fields).toHaveCount(4); // the arrow is selected: its start and end fields
  const before = await fields.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  const zoom = await tool.locator('.tk-zoom__level').textContent();

  await sendLanguage(page, 'en-US');
  await expectUi(page, 'en-US');
  expect(await stillSameWindow(frame)).toBe(true);
  await expect(tool.locator('#tk-canvas-summary')).toContainText(', 1 annotation');
  await expect(tool.locator('[data-screen="SCR-Annotator"]')).toHaveAttribute('data-state', 'selecting');
  expect(await fields.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(before);
  await expect(tool.getByRole('radio', { name: 'Arrow (A)' })).toHaveAttribute('aria-checked', 'true');
  await expect(tool.locator('.tk-zoom__level')).toHaveText(zoom ?? '');
  // The undo history is unchanged (F-009): the arrow's step undoes and redoes, the controls now in English.
  const undo = tool.getByRole('button', { name: 'Undo', exact: true });
  const redo = tool.getByRole('button', { name: 'Redo', exact: true });
  await expect(redo).toBeDisabled();
  await undo.click();
  await expect(tool.locator('#tk-canvas-summary')).toContainText(', 0 annotations');
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(tool.locator('#tk-canvas-summary')).toContainText(', 1 annotation');
  expect(await fields.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(before);
});

for (const [prefs, expected] of [
  [['fr-FR', 'vi'], 'vi-VN'],
  [['fr-FR'], 'en-US'],
] as const) {
  test(`F-018.AC3 no language in the address, browser prefers ${prefs.join(', ')} → ${expected}`, async ({ page }) => {
    await page.addInitScript(
      (list) => {
        Object.defineProperty(Navigator.prototype, 'languages', { get: () => list, configurable: true });
        Object.defineProperty(Navigator.prototype, 'language', { get: () => list[0], configurable: true });
      },
      prefs as unknown as string[],
    );
    await page.goto(`${TOOL_ALLOWED}/?theme=dark`);
    await expect(page.locator(SHELL)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', expected);
    await expect(page.locator('main')).toHaveAccessibleName(CATALOG[expected]['a11y.canvas'] as string);
  });
}

test('F-018.AC4 language messages from another origin, another window or with an unsupported value are ignored', async ({
  page,
}) => {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'vi-VN'));
  await toolFrame(page);
  await postFromForeignOrigin(page, { type: 'taro:language', value: 'en-US' });
  await postFromSibling(page, { type: 'taro:language', value: 'en-US' });
  await settle(page); // other windows: no ordering with the parent's messages
  await expectUi(page, 'vi-VN');
  // Unsupported values from the parent, then a valid theme control from the same window: once the
  // control has taken effect, every earlier message has been handled.
  for (const value of ['fr-FR', '', null, 42, { lang: 'en-US' }]) await sendLanguage(page, value);
  await sendTheme(page, 'light');
  await expect(page.frameLocator('#tool').locator('html')).toHaveAttribute('data-theme', 'light');
  await expectUi(page, 'vi-VN');
});

test('F-018.R7 vi-VN at 320 px wide: no horizontal scrollbar (empty frame)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=vi-VN`);
  await expect(page.locator(SHELL)).toBeVisible();
  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflowX).toBeLessThanOrEqual(0);
});

test('F-018.R7 the Vietnamese faces are part of the initial load, in every language', async ({ page }) => {
  await page.request.get(`${TOOL_ALLOWED}/__log/reset`);
  await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=en-US`);
  await expect(page.locator(SHELL)).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect
    .poll(async () => {
      const log = (await (await page.request.get(`${TOOL_ALLOWED}/__log/dump`)).json()) as {
        path: string;
        dest: string;
      }[];
      // The page's own font loads (dest `font`), not the offline worker's fetches into its cache (F-017).
      return log.filter((r) => r.dest === 'font' && /vietnamese.*\.woff2$/.test(r.path)).length;
    })
    .toBe(2);
});

// The text part of F-018's offline Vietnamese check (its download and offline halves wait for F-012 and
// F-017): opened in en-US first, then in vi-VN, the user's Vietnamese text is drawn in the tool's face
// with no font request after the load.
test('F-018.R7 F-005.R5 vi-VN: the text "Đường dẫn lỗi" is drawn in the tool’s face with no font request', async ({
  page,
}) => {
  await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=en-US`);
  await expect(page.locator(SHELL)).toBeVisible();
  await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=vi-VN`);
  await expect(page.locator(SHELL)).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.request.get(`${TOOL_ALLOWED}/__log/reset`);
  await page.evaluate(async () => {
    const c = new OffscreenCanvas(400, 300);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, 400, 300);
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'grey.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('#tk-canvas-summary')).toContainText(', 0 chú thích');
  await page.getByRole('radio', { name: `${CATALOG['vi-VN']['tool.text'] as string} (T)` }).click();
  const area = await page.locator('main.tk-work-area').boundingBox();
  if (!area) throw new Error('no work area');
  await page.mouse.click(area.x + area.width / 2 - 100, area.y + area.height / 2);
  const field = page.getByRole('textbox', { name: CATALOG['vi-VN']['tool.text'] as string });
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute('placeholder', CATALOG['vi-VN']['text.placeholder'] as string);
  await page.keyboard.insertText('Đường dẫn lỗi');
  await page.keyboard.press('Escape');
  await expect(field).toBeHidden();
  await expect(page.locator('#tk-canvas-summary')).toContainText(', 1 chú thích');
  expect(await page.evaluate(() => document.fonts.check('600 16px Manrope', 'Đường dẫn lỗi'))).toBe(true);
  const log = (await (await page.request.get(`${TOOL_ALLOWED}/__log/dump`)).json()) as { path: string }[];
  expect(log.map((r) => r.path).filter((p) => /\.woff2?$/.test(p))).toEqual([]);
});

test.describe('F-018.AC10 download', () => {
  // One device pixel per CSS pixel, so the 100 % view and the 1:1 export can be compared pixel for pixel.
  test.use({ deviceScaleFactor: 1 });

  // The download half of F-018.AC10, online: opened in en-US first, then in vi-VN, "Đường dẫn lỗi" is
  // downloaded with every diacritic drawn as on screen (in the tool's face), and no font is requested.
  test('F-018.AC10 F-012.R2 vi-VN: "Đường dẫn lỗi" downloads with every diacritic as on screen and no font request (download half)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1472, height: 868 });
    await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=en-US`);
    await expect(page.locator(SHELL)).toBeVisible();
    await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=vi-VN`);
    await expect(page.locator(SHELL)).toBeVisible();
    await page.waitForLoadState('networkidle');
    await typeAndDownload(page);
  });

  // The offline half (F-017): first opened online in en-US, then reopened with no connection (the tool
  // server down, ADR-0021) in vi-VN; both typefaces and their Vietnamese subsets come from the offline cache.
  test('F-018.AC10 F-017.R1 first opened online in en-US, reopened offline in vi-VN: the download has every diacritic and no font request (offline half)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1472, height: 868 });
    await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=en-US`);
    await expect(page.locator(SHELL)).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const files = (document.querySelector<HTMLMetaElement>('meta[name="tk-assets"]')?.content ?? '')
              .split(/\s+/)
              .filter(Boolean);
            const cache = await caches.open('image-annotator-v1');
            const keys = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
            return files.some((f) => f.endsWith('.woff2')) && keys.has('/') && files.every((f) => keys.has(f));
          }),
        { timeout: 30_000 },
      )
      .toBe(true);
    await page.request.get(`${TOOL_ALLOWED}/__ctl/down?on=1`);
    try {
      await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=vi-VN`);
      await expect(page.locator(SHELL)).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi-VN');
      await typeAndDownload(page);
    } finally {
      await page.request.get(`${TOOL_ALLOWED}/__ctl/down?on=0`);
    }
  });

  /**
   * In vi-VN: adds "Đường dẫn lỗi", downloads, and checks every diacritic is drawn in the export as on
   * screen (in the tool's face) and that the server was asked for no font meanwhile.
   */
  async function typeAndDownload(page: Page): Promise<void> {
    await page.request.get(`${TOOL_ALLOWED}/__log/reset`);
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(400, 300);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(0, 0, 400, 300);
      const dt = new DataTransfer();
      dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'grey.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(page.locator('#tk-canvas-summary')).toContainText(', 0 chú thích');
    await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
    await page.getByRole('radio', { name: `${CATALOG['vi-VN']['tool.text'] as string} (T)` }).click();
    const area = await page.locator('main.tk-work-area').boundingBox();
    if (!area) throw new Error('no work area');
    await page.mouse.click(area.x + area.width / 2 - 180, area.y + area.height / 2 - 40);
    const field = page.getByRole('textbox', { name: CATALOG['vi-VN']['tool.text'] as string });
    await expect(field).toBeFocused();
    await page.keyboard.insertText('Đường dẫn lỗi');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape'); // clear the selection, so the view shows no outline
    await expect(page.locator('#tk-canvas-summary')).toContainText(', 1 chú thích');
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    const file = await download(page, () =>
      page.getByRole('button', { name: CATALOG['vi-VN']['action.download'] as string, exact: true }).click(),
    );
    const png = expectCleanPng(file.bytes);
    // The text's area (image x 10–399, y 100–200) in the export against the 100 % view (the same paint()).
    const got = pngRegion(png, 10, 100, 390, 100);
    const diff = await page.locator('canvas.tk-canvas').evaluate((el, got) => {
      const c = el as HTMLCanvasElement;
      const x0 = Math.round((c.width - 400) / 2) + 10;
      const y0 = Math.round((c.height - 300) / 2) + 100;
      const shown = c.getContext('2d', { colorSpace: 'srgb' })?.getImageData(x0, y0, 390, 100).data ?? [];
      let d = 0;
      let ink = 0;
      for (let i = 0; i < got.length; i++) {
        d += Math.abs((got[i] ?? 0) - (shown[i] ?? 0));
        if (i % 4 === 0 && (got[i] ?? 0) !== 200) ink++;
      }
      return { mean: d / got.length, ink };
    }, got);
    expect(diff.ink, 'the text is in the export').toBeGreaterThan(500);
    expect(diff.mean).toBeLessThan(1.5);
    const log = (await (await page.request.get(`${TOOL_ALLOWED}/__log/dump`)).json()) as { path: string }[];
    expect(log.map((r) => r.path).filter((p) => /\.woff2?$/.test(p))).toEqual([]);
  }
});
