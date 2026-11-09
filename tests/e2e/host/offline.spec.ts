// F-017 Work offline (ADR-0011, ADR-0021; NFR-01, INV-04) on the multi-origin harness: the real
// /sw.js under its deploy headers, standalone and embedded in the stub portal, on Chromium and WebKit.
// "Offline" takes the tool server down (its connections are dropped) rather than using Playwright's
// `setOffline`, which breaks service workers on WebKit (ADR-0021). The stub host stays up: the portal
// page itself is not the tool's to cache.
import { expect, test, type APIRequestContext, type Frame, type FrameLocator, type Page } from '@playwright/test';
import { download, expectCleanPng } from '../support/export';
import { fixture, paste } from '../support/load';
import { HOST_ALLOWED, TOOL_ALLOWED, hostPageUrl } from '../support/urls';
import { markWindow, received, SHELL, stillSameWindow, toolFrame } from './support';

type Way = 'standalone' | 'embedded';
const WAYS: Way[] = ['standalone', 'embedded'];
const CACHE = 'image-annotator-v1';

interface Logged {
  readonly method: string;
  readonly path: string;
  readonly contentLength: number;
  readonly refused?: boolean;
}

const ctl = (request: APIRequestContext, q: string) => request.get(`${TOOL_ALLOWED}/__ctl/${q}`);
const serverDown = (request: APIRequestContext, on: boolean) => ctl(request, `down?on=${on ? 1 : 0}`);
const serveVersion = (request: APIRequestContext, v: 1 | 2) => ctl(request, `version?v=${v}`);
const resetLog = (request: APIRequestContext) => request.get(`${TOOL_ALLOWED}/__log/reset`);
const requestLog = async (request: APIRequestContext) =>
  (await (await request.get(`${TOOL_ALLOWED}/__log/dump`)).json()) as Logged[];

test.afterEach(async ({ request }) => {
  await serverDown(request, false);
  await serveVersion(request, 1);
});

/** Opens the tool online or offline, standalone or in the stub portal; returns its frame. */
async function openTool(page: Page, way: Way, query = 'theme=dark&lang=en-US'): Promise<Frame> {
  if (way === 'standalone') {
    await page.goto(`${TOOL_ALLOWED}/?${query}`);
    await expect(page.locator(SHELL)).toBeVisible();
    return page.mainFrame();
  }
  const q = new URLSearchParams(query);
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, q.get('theme') as 'dark', q.get('lang') ?? undefined));
  return toolFrame(page);
}

const ui = (page: Page, way: Way): Page | FrameLocator => (way === 'standalone' ? page : page.frameLocator('#tool'));

/** Cache keys (path and query) the tool stored, read in its own (possibly partitioned) storage. */
const cached = (frame: Frame) =>
  frame.evaluate(async (name) => {
    const cache = await caches.open(name);
    return (await cache.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search);
  }, CACHE);

/** Waits until the page and every file its build names are in the offline cache (F-017.R1). */
async function offlineReady(frame: Frame): Promise<string[]> {
  const files = await frame.evaluate(() =>
    (document.querySelector<HTMLMetaElement>('meta[name="tk-assets"]')?.content ?? '').split(/\s+/).filter(Boolean),
  );
  expect(files.length).toBeGreaterThan(5);
  await expect
    .poll(
      async () => {
        const keys = new Set(await cached(frame));
        return keys.has('/') && files.every((f) => keys.has(f));
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  return files;
}

const summary = (page: Page, way: Way) => ui(page, way).locator('#tk-canvas-summary');
const toolButton = (page: Page, way: Way, name: string) =>
  ui(page, way).getByRole('toolbar', { name: 'Tools and actions' }).getByRole('radio', { name });

/** The canvas centre (the image is centred in the work area at 100 %), in page coordinates. */
async function centre(page: Page, way: Way): Promise<[number, number]> {
  await expect(ui(page, way).locator('.tk-zoom__level')).toHaveText('100 %');
  const box = await ui(page, way).locator('main.tk-work-area').boundingBox();
  if (!box) throw new Error('no work area');
  return [box.x + box.width / 2, box.y + box.height / 2];
}

/** Drags between two points given in image pixels from the image centre. */
async function drag(page: Page, way: Way, from: [number, number], to: [number, number]): Promise<void> {
  const [cx, cy] = await centre(page, way);
  await page.mouse.move(cx + from[0], cy + from[1]);
  await page.mouse.down();
  await page.mouse.move(cx + (from[0] + to[0]) / 2, cy + (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(cx + to[0], cy + to[1], { steps: 4 });
  await page.mouse.up();
}

/** A 400 × 300 grey screenshot, pasted at the focused element. */
async function pasteGrey(frame: Frame): Promise<void> {
  await frame.evaluate(async () => {
    const c = new OffscreenCanvas(400, 300);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = '#111';
    ctx.fillRect(40, 40, 200, 30);
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'grey.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
}

test.describe('F-017 offline', () => {
  for (const way of WAYS) {
    test(`F-017.AC1 F-017.R1 opened once online, it opens with no connection and paste, arrow, solid redaction and download work (${way})`, async ({
      page,
      request,
    }) => {
      const online = await openTool(page, way);
      await offlineReady(online);

      await serverDown(request, true);
      await resetLog(request);
      const frame = await openTool(page, way);
      // The page came from the offline cache: the server refused everything it was asked.
      expect((await requestLog(request)).every((r) => r.refused)).toBe(true);
      expect(await frame.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

      await paste(frame, [fixture('fmt.png', 'image/png')]);
      await expect(summary(page, way)).toHaveText('240 × 160 px canvas, 0 annotations');
      await toolButton(page, way, 'Arrow (A)').click();
      await drag(page, way, [-80, 40], [60, -40]);
      await expect(summary(page, way)).toHaveText('240 × 160 px canvas, 1 annotation');
      await toolButton(page, way, 'Redact (X)').click();
      await drag(page, way, [-100, -60], [-20, -20]); // image pixels 20–100 × 20–60
      await expect(summary(page, way)).toHaveText('240 × 160 px canvas, 2 annotations');
      const file = await download(page, () =>
        ui(page, way).getByRole('button', { name: 'Download', exact: true }).click(),
      );
      const png = expectCleanPng(file.bytes);
      expect([png.width, png.height]).toEqual([240, 160]);
      // The solid redaction is in the export: its centre (image pixel 60, 40) is opaque black.
      const i = (40 * 240 + 60) * 4;
      expect(Array.from(png.data.slice(i, i + 4))).toEqual([0, 0, 0, 255]);
    });
  }

  test('F-017 edge case: a copy made standalone does not open the embedded tool offline (ADR-0021)', async ({
    page,
    request,
    browserName,
  }) => {
    // Playwright launches Chromium with ThirdPartyStoragePartitioning disabled (playwright#32230), so only
    // WebKit partitions here; Chrome itself partitions, which QA checks by hand.
    test.skip(browserName === 'chromium', 'Playwright disables storage partitioning in Chromium');
    const online = await openTool(page, 'standalone');
    await offlineReady(online);
    await serverDown(request, true);
    await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'en-US'), { waitUntil: 'domcontentloaded' });
    // Storage is partitioned per embedding site: the frame has no copy of its own, so it cannot load.
    // The failed frame never loads, so the negative check is a bounded wait for the ready signal the
    // tool posts once it runs (the stub host records every message, RULE-16).
    await page.waitForTimeout(2000);
    expect(await received(page)).toEqual([]);
    // WebKit keeps the failed frame pending and would stall closing the context: leave it first.
    await serverDown(request, false);
    await page.goto('about:blank');
  });

  for (const way of WAYS) {
    test(`F-017.AC2 F-017.R2 NFR-01 a whole session requests only the tool's own files, and text, blur, pixelate and export ask for nothing (${way})`, async ({
      page,
      request,
    }) => {
      await resetLog(request);
      const frame = await openTool(page, way);
      await offlineReady(frame);
      // Everything requested so far is one of the tool's own files, fetched without a body.
      const opening = await requestLog(request);
      expect(opening.length).toBeGreaterThan(0);
      for (const r of opening) {
        expect(r.method, r.path).toBe('GET');
        expect(r.contentLength, r.path).toBe(0);
        expect(r.path).toMatch(/^\/(assets\/[\w.-]+|sw\.js|favicon\.ico)?$/);
      }

      // A session using each feature for the first time: no request at all.
      await resetLog(request);
      await pasteGrey(frame);
      await expect(summary(page, way)).toHaveText('400 × 300 px canvas, 0 annotations');
      await toolButton(page, way, 'Text (T)').click();
      const [cx, cy] = await centre(page, way);
      await page.mouse.click(cx - 150, cy + 40);
      await expect(ui(page, way).getByRole('textbox', { name: 'Text' })).toBeFocused();
      await page.keyboard.insertText('Đường dẫn lỗi');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape'); // and clear the selection, so the panel follows the tool
      await expect(summary(page, way)).toHaveText('400 × 300 px canvas, 1 annotation');
      const kinds = ui(page, way).getByRole('complementary', { name: 'Style' }).getByRole('group', {
        name: 'Redaction type',
      });
      await toolButton(page, way, 'Redact (X)').click();
      await kinds.getByRole('radio', { name: /^Blur/ }).check();
      await drag(page, way, [-180, -130], [-20, -60]);
      await expect(summary(page, way)).toHaveText('400 × 300 px canvas, 2 annotations');
      await page.keyboard.press('Escape'); // the new redaction stays selected; the kind is then the tool's
      await kinds.getByRole('radio', { name: /^Pixelate/ }).check();
      await drag(page, way, [20, -130], [180, -60]);
      await expect(summary(page, way)).toHaveText('400 × 300 px canvas, 3 annotations');
      const file = await download(page, () =>
        ui(page, way).getByRole('button', { name: 'Download', exact: true }).click(),
      );
      expectCleanPng(file.bytes);
      expect(await requestLog(request)).toEqual([]);
    });
  }

  test('F-017.AC3 F-017.R3 a new version never reloads an open tool; opened online once, then again, the new version is used', async ({
    page,
    request,
  }) => {
    const v1 = await openTool(page, 'standalone');
    const oldFiles = await offlineReady(v1);
    await markWindow(v1);
    const version = (f: Frame) =>
      f.evaluate(() => document.querySelector('meta[name="tk-e2e-version"]')?.getAttribute('content') ?? '1');

    // Published while the tool is open: nothing reloads, the session stays on its version.
    await serveVersion(request, 2);
    await pasteGrey(v1);
    await expect(page.locator('#tk-canvas-summary')).toHaveText('400 × 300 px canvas, 0 annotations');
    await page.evaluate(() => new Promise((r) => setTimeout(r, 1500)));
    expect(await stillSameWindow(v1)).toBe(true);
    expect(await version(v1)).toBe('1');
    await expect(page.locator('#tk-canvas-summary')).toHaveText('400 × 300 px canvas, 0 annotations');

    // Opened online once (the version check happens only now), then again: the new version is used.
    await openTool(page, 'standalone');
    const v2 = await openTool(page, 'standalone');
    expect(await version(v2)).toBe('2');
    const newFiles = await offlineReady(v2);
    expect(newFiles).not.toEqual(oldFiles);
    // The old version's files are pruned; offline, the stored page is the new version too.
    const keys = await cached(v2);
    for (const f of oldFiles.filter((f) => !newFiles.includes(f))) expect(keys).not.toContain(f);
    await serverDown(request, true);
    const offline = await openTool(page, 'standalone');
    expect(await version(offline)).toBe('2');
    await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', /v2\.css$/);
  });

  test('INV-04 NFR-01 the offline cache holds only the tool’s own files, never the image or the address', async ({
    page,
  }) => {
    const frame = await openTool(page, 'embedded', 'theme=light&lang=vi-VN');
    await offlineReady(frame);
    await pasteGrey(frame);
    await expect(summary(page, 'embedded')).toContainText('400 × 300');
    const keys = await cached(frame);
    for (const k of keys) expect(k).toMatch(/^\/(assets\/[\w.-]+)?$/);
    const names = await frame.evaluate(() => caches.keys());
    expect(names).toEqual([CACHE]);
    const stored = await frame.evaluate(async (name) => {
      const res = await (await caches.open(name)).match('/');
      return { url: res?.url ?? null, csp: res?.headers.get('content-security-policy') ?? '' };
    }, CACHE);
    expect(stored.url ?? '').not.toContain('lang=');
    expect(stored.csp).toContain("connect-src 'none'");
  });
});
