// F-017 Work offline (ADR-0011, ADR-0021, ADR-0024; NFR-01, NFR-09, INV-04) on the multi-origin
// harness: the real /sw.js under its deploy headers, standalone and embedded in the stub portal, on
// Chromium and WebKit. "Offline" takes the tool server down (its connections are dropped) rather than
// using Playwright's `setOffline`, which breaks service workers on WebKit (ADR-0021). The stub host
// stays up: the portal page itself is not the tool's to cache. The server log records `sec-fetch-dest`,
// so the offline worker's own fetches (`empty`) are told apart from the browser loading the page.
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
  readonly dest: string;
  readonly mode: string;
  readonly refused?: boolean;
}

const ctl = (request: APIRequestContext, q: string) => request.get(`${TOOL_ALLOWED}/__ctl/${q}`);
const serverDown = (request: APIRequestContext, on: boolean) => ctl(request, `down?on=${on ? 1 : 0}`);
const serveVersion = (request: APIRequestContext, v: '1' | '2' | 'revoked') => ctl(request, `version?v=${v}`);
const resetLog = (request: APIRequestContext) => request.get(`${TOOL_ALLOWED}/__log/reset`);
const requestLog = async (request: APIRequestContext) =>
  (await (await request.get(`${TOOL_ALLOWED}/__log/dump`)).json()) as Logged[];

test.afterEach(async ({ request }) => {
  await serverDown(request, false);
  await serveVersion(request, '1');
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

/**
 * Opens the stub portal with the tool server down, in a site whose partition has no offline copy, and
 * returns the messages the tool sent. Deterministic: the frame's navigation reaches the server as the
 * browser's own (`sec-fetch-mode: navigate`; a worker forwarding it would send `same-origin`), so no
 * worker answered it, the server refuses it, and nothing else could load the tool (ADR-0021).
 */
async function embedWithoutCopy(page: Page, request: APIRequestContext): Promise<unknown[]> {
  await resetLog(request);
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'en-US'), { waitUntil: 'commit' });
  await expect
    .poll(async () =>
      (await requestLog(request)).some(
        (r) => r.path === '/' && r.dest === 'iframe' && r.mode === 'navigate' && r.refused,
      ),
    )
    .toBe(true);
  return received(page);
}

/**
 * Opens the stub portal and waits until its frame has loaded or failed (the host counts the frame's
 * load events; Chromium fires one for a refused or failed frame too), then returns the messages the
 * tool sent: none when it did not run (it posts the ready signal before its frame's load event).
 */
async function embedSettled(page: Page): Promise<unknown[]> {
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'en-US'), { waitUntil: 'commit' });
  await page.waitForFunction(() => (window as unknown as { __frameLoads?: number }).__frameLoads! >= 1);
  return received(page);
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

/** The page's own font loads (both subsets of both faces, F-018.R7) have finished. */
const fontsLoaded = (frame: Frame) =>
  frame.waitForFunction(() => document.fonts.status === 'loaded' && document.fonts.size >= 4);

const version = (f: Frame) =>
  f.evaluate(() => document.querySelector('meta[name="tk-e2e-version"]')?.getAttribute('content') ?? '1');

/** Asks a service worker of `f`'s registration for its harness version (only the v2 worker answers). */
const workerVersion = (f: Frame, which: 'controller' | 'waiting' | 'active') =>
  f.evaluate(async (which) => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sw = which === 'controller' ? navigator.serviceWorker.controller : (reg?.[which] ?? null);
    if (!sw) return null;
    return new Promise<unknown>((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => resolve(e.data);
      sw.postMessage('e2e-version', [ch.port2]);
    });
  }, which);

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
    // WebKit partitions here; Chrome itself partitions, which QA checks by hand (docs/offline.md).
    test.skip(browserName === 'chromium', 'Playwright disables storage partitioning in Chromium');
    const online = await openTool(page, 'standalone');
    await offlineReady(online);
    await serverDown(request, true);
    // Storage is partitioned per embedding site: the frame has no copy of its own, so it cannot load.
    expect(await embedWithoutCopy(page, request)).toEqual([]);
    expect(page.frames().find((f) => f.url().startsWith(TOOL_ALLOWED))).toBeUndefined();
    // WebKit keeps the failed frame pending and would stall closing the context: leave it first.
    await serverDown(request, false);
    await page.goto('about:blank');
  });

  test('F-017 edge case: a copy made embedded does not open the standalone tool offline (ADR-0021)', async ({
    page,
    request,
    browserName,
  }) => {
    test.skip(browserName === 'chromium', 'Playwright disables storage partitioning in Chromium');
    const embedded = await openTool(page, 'embedded');
    await offlineReady(embedded);
    await serverDown(request, true);
    // The top-level page has its own, empty partition: the navigation fails like any offline site.
    await expect(page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=en-US`)).rejects.toThrow();
  });

  test('NFR-09 F-017 security m1 a host removed from the allow-list no longer embeds the offline copy', async ({
    page,
    request,
    browserName,
  }) => {
    // WebKit fires no load event for a refused or failed frame, so there is no deterministic point to
    // check that nothing ran; the worker's code path is the same on both engines.
    test.skip(browserName === 'webkit', 'WebKit fires no load event for a refused frame');
    const embedded = await openTool(page, 'embedded');
    await offlineReady(embedded);
    // The host is revoked: online, the served page's frame-ancestors refuse it, and the worker drops
    // the stored page whose frame-ancestors still allowed it.
    await serveVersion(request, 'revoked');
    expect(await embedSettled(page)).toEqual([]);
    await serverDown(request, true);
    expect(await embedSettled(page)).toEqual([]);
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
      await fontsLoaded(frame);
      // While opening: only the tool's own files, fetched without a body. The browser loads each file
      // once for the page; the worker's own fetches (dest `empty`) fill the offline cache.
      const opening = await requestLog(request);
      expect(opening.length).toBeGreaterThan(0);
      for (const r of opening) {
        expect(r.method, r.path).toBe('GET');
        expect(r.contentLength, r.path).toBe(0);
        expect(r.path).toMatch(/^\/(assets\/[\w.-]+|sw\.js|favicon\.ico)?$/);
      }
      const byPage = opening.filter((r) => r.dest !== 'empty').map((r) => `${r.dest} ${r.path}`);
      expect(byPage.length, byPage.join('\n')).toBe(new Set(byPage).size);
      expect(opening.filter((r) => r.dest === 'font').length).toBe(4);

      // A session using each feature for the first time: no request at all, from the page or the worker.
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

  test('F-017.AC3 F-017.R3 a new version never reloads an open tool; the first online open uses it, and then the offline copy', async ({
    playwright,
    browserName,
    request,
  }, testInfo) => {
    // A persistent profile, as a real browser has: Playwright's in-memory WebKit contexts lose the Cache
    // Storage when a new service worker activates, which a real browser profile keeps.
    const context = await playwright[browserName].launchPersistentContext(testInfo.outputPath('profile'));
    const page = context.pages()[0] ?? (await context.newPage());
    try {
      // A returning user: opened once (cached), then open again, now under the worker's control.
      const oldFiles = await offlineReady(await openTool(page, 'standalone'));
      const v1 = await openTool(page, 'standalone');
      expect(await v1.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      await markWindow(v1);

      // Published while the tool is open: the browser finds the new worker, which installs and waits.
      await serveVersion(request, '2');
      await v1.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      });
      await expect
        .poll(() => v1.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state ?? null))
        .toBe('installed');
      expect(await workerVersion(v1, 'waiting')).toBe(2);
      // Nothing reloads and nothing takes over: same window, same page version, the old worker in control.
      const takeover = () =>
        v1.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          const c = navigator.serviceWorker.controller;
          return { old: !!c && c === reg?.active && c !== reg?.waiting, waiting: reg?.waiting?.state ?? null };
        });
      expect(await takeover()).toEqual({ old: true, waiting: 'installed' });
      expect(await stillSameWindow(v1)).toBe(true);
      expect(await version(v1)).toBe('1');
      // The session goes on (a blur needs the effects worker), and the new worker keeps waiting.
      await pasteGrey(v1);
      await expect(summary(page, 'standalone')).toHaveText('400 × 300 px canvas, 0 annotations');
      expect(await takeover()).toEqual({ old: true, waiting: 'installed' });
      expect(await stillSameWindow(v1)).toBe(true);

      // Closed and opened again online: the first open uses the new version and the new worker.
      // (Another tab stays open meanwhile, so the browser itself stays open.)
      const reopened = await context.newPage();
      await page.close();
      const v2 = await openTool(reopened, 'standalone');
      expect(await version(v2)).toBe('2');
      await expect(reopened.locator('link[rel="stylesheet"]')).toHaveAttribute('href', /v2\.css$/);
      expect(await workerVersion(v2, 'active')).toBe(2);
      expect(await workerVersion(v2, 'controller')).toBe(2);
      // Once its files are cached, the offline copy is the new version; the old version's files are gone.
      const newFiles = await offlineReady(v2);
      expect(newFiles).not.toEqual(oldFiles);
      const keys = await cached(v2);
      for (const f of oldFiles.filter((f) => !newFiles.includes(f))) expect(keys).not.toContain(f);
      await serverDown(request, true);
      const offline = await openTool(reopened, 'standalone');
      expect(await version(offline)).toBe('2');
      await expect(reopened.locator('link[rel="stylesheet"]')).toHaveAttribute('href', /v2\.css$/);
    } finally {
      await context.close();
    }
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
