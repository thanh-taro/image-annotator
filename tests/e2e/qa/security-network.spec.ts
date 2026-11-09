// QA security (phase 5) — network logs on the multi-origin harness (real headers, real /sw.js):
// - F-017 security m3: on a first visit, work pasted before the offline copy is saved sends no image
//   data, the clipboard copy completes, and the offline copy still completes (it then works offline);
// - NFR-01 / INV-04: a full M-1 session (tests/e2e/support/tour.ts) logged at the server and in the
//   browser: only GETs of the tool's own files, no bodies, no other origin;
// - NFR-01: the page's content policy refuses connections, own origin or other;
// - NFR-09 / RULE-16: the empty-HOST_ORIGINS build refuses every embedder and compiles no host in.
// Run: pnpm exec playwright test -c tests/e2e/qa/security-harness.config.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type APIRequestContext, type BrowserContext, type Frame, type Page } from '@playwright/test';
import { copied, download, expectCleanPng, pngRegion, recordClipboard } from '../support/export';
import { m1Tour } from '../support/tour';
import { HOST_ALLOWED, HOST_OTHER, TOOL_ALLOWED, TOOL_EMPTY, hostPageUrl } from '../support/urls';
import { received, settle, SHELL, toolFrame } from '../host/support';

test.skip(!process.env['E2E_QA_HARNESS'], 'needs the QA security harness (tests/e2e/qa/security-harness.config.ts)');
test.use({ deviceScaleFactor: 1 });

type Way = 'standalone' | 'embedded';
const WAYS: Way[] = ['standalone', 'embedded'];
const CACHE = 'image-annotator-v1';
const OWN_FILE = /^\/(assets\/[\w.-]+|sw\.js|favicon\.ico)?$/;

interface Logged {
  readonly method: string;
  readonly path: string;
  readonly contentLength: number;
  readonly dest: string;
  readonly mode: string;
  readonly refused?: boolean;
}
interface Seen {
  readonly url: string;
  readonly method: string;
  readonly body: number;
  readonly type: string;
  readonly worker: boolean;
}

const logOf = async (request: APIRequestContext, origin = TOOL_ALLOWED) =>
  (await (await request.get(`${origin}/__log/dump`)).json()) as Logged[];
const resetLogs = async (request: APIRequestContext) => {
  await request.get(`${TOOL_ALLOWED}/__log/reset`);
  await request.get(`${TOOL_EMPTY}/__log/reset`);
};
const serverDown = (request: APIRequestContext, on: boolean) =>
  request.get(`${TOOL_ALLOWED}/__ctl/down?on=${on ? 1 : 0}`);

test.afterEach(async ({ request }) => {
  await serverDown(request, false);
});

/** Every request the browser makes in this context (pages, frames and, where reported, service workers). */
function recordNetwork(context: BrowserContext): Seen[] {
  const seen: Seen[] = [];
  context.on('request', (r) =>
    seen.push({
      url: r.url(),
      method: r.method(),
      body: r.postDataBuffer()?.length ?? 0,
      type: r.resourceType(),
      worker: !!r.serviceWorker(),
    }),
  );
  return seen;
}

/** NFR-01 / INV-04: nothing but GETs without a body, to the tool's own files or the stub portal page. */
function expectOnlyOwnFiles(seen: readonly Seen[], log: readonly Logged[]): void {
  for (const r of log) {
    expect(r.method, r.path).toBe('GET');
    expect(r.contentLength, r.path).toBe(0);
    expect(r.path).toMatch(OWN_FILE);
  }
  for (const r of seen) {
    if (r.url.startsWith('blob:') || r.url.startsWith('data:')) continue; // in-memory, never the network
    const u = new URL(r.url);
    expect(r.method, r.url).toBe('GET');
    expect(r.body, r.url).toBe(0);
    if (u.origin === HOST_ALLOWED) {
      expect(u.pathname, r.url).toBe('/host.html');
      continue;
    }
    expect(u.origin, r.url).toBe(TOOL_ALLOWED);
    expect(u.pathname, r.url).toMatch(OWN_FILE);
    // Only the page address may carry a query, and only the portal's theme and language (RULE-16/17).
    if (u.search) {
      expect(u.pathname, r.url).toBe('/');
      expect(
        [...u.searchParams.keys()].every((k) => k === 'theme' || k === 'lang'),
        r.url,
      ).toBe(true);
    }
  }
}

async function openTool(page: Page, way: Way, wait: 'load' | 'commit' = 'load'): Promise<Frame> {
  if (way === 'standalone') {
    await page.goto(`${TOOL_ALLOWED}/?theme=dark&lang=en-US`, { waitUntil: wait });
    await expect(page.locator(SHELL)).toBeVisible();
    return page.mainFrame();
  }
  await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'dark', 'en-US'), { waitUntil: wait });
  return toolFrame(page);
}

const cachedKeys = (frame: Frame) =>
  frame.evaluate(async (name) => {
    if (!(await caches.has(name))) return [] as string[];
    return (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search);
  }, CACHE);

/** F-017.R1: the page and every file its build names are in the offline cache. */
async function offlineReady(frame: Frame): Promise<void> {
  const files = await frame.evaluate(() =>
    (document.querySelector<HTMLMetaElement>('meta[name="tk-assets"]')?.content ?? '').split(/\s+/).filter(Boolean),
  );
  expect(files.length).toBeGreaterThan(5);
  await expect
    .poll(
      async () => {
        const keys = new Set(await cachedKeys(frame));
        return keys.has('/') && files.every((f) => keys.has(f));
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

/** A 400 × 300 high-entropy screenshot (noise), pasted at the focused element. */
async function pasteNoise(frame: Frame): Promise<void> {
  await frame.evaluate(async () => {
    const c = new OffscreenCanvas(400, 300);
    const ctx = c.getContext('2d', { colorSpace: 'srgb' });
    if (!ctx) throw new Error('no 2d context');
    const img = ctx.createImageData(400, 300);
    let s = 7;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1664525 + 1013904223) >>> 0;
      img.data[i] = s & 255;
      img.data[i + 1] = (s >>> 8) & 255;
      img.data[i + 2] = (s >>> 16) & 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const dt = new DataTransfer();
    dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'secret.png', { type: 'image/png' }));
    (document.activeElement ?? document).dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  });
}

const ui = (page: Page, way: Way) => (way === 'standalone' ? page : page.frameLocator('#tool'));
const summary = (page: Page, way: Way) => ui(page, way).locator('#tk-canvas-summary');
const toolbar = (page: Page, way: Way) => ui(page, way).getByRole('toolbar', { name: 'Tools and actions' });
const kinds = (page: Page, way: Way) =>
  ui(page, way).getByRole('complementary', { name: 'Style' }).getByRole('group', { name: 'Redaction type' });

/** Drags between two image pixels of the 400 × 300 image shown centred at 100 %. */
async function drag(page: Page, way: Way, from: [number, number], to: [number, number]): Promise<void> {
  await expect(ui(page, way).locator('.tk-zoom__level')).toHaveText('100 %');
  const box = await ui(page, way).locator('main.tk-work-area').boundingBox();
  if (!box) throw new Error('no work area');
  const ox = Math.round(box.x + (box.width - 400) / 2);
  const oy = Math.round(box.y + (box.height - 300) / 2);
  await page.mouse.move(ox + from[0], oy + from[1]);
  await page.mouse.down();
  await page.mouse.move(ox + (from[0] + to[0]) / 2, oy + (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(ox + to[0], oy + to[1], { steps: 4 });
  await page.mouse.up();
}

async function redact(page: Page, way: Way, kind: RegExp, from: [number, number], to: [number, number]) {
  await ui(page, way).locator('main.tk-work-area').focus();
  await page.keyboard.press('Escape'); // nothing selected: the kind choice is the tool's
  await toolbar(page, way).getByRole('radio', { name: 'Redact (X)' }).click();
  await kinds(page, way).getByRole('radio', { name: kind }).check();
  await drag(page, way, from, to);
}

async function grantClipboard(context: BrowserContext, browserName: string): Promise<void> {
  if (browserName !== 'chromium') return;
  for (const origin of [TOOL_ALLOWED, HOST_ALLOWED])
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
}

test.describe('QA security: network', () => {
  for (const way of WAYS) {
    test(`F-017 security m3 ADR-0025.1 NFR-01 INV-04 first visit: work pasted before the offline copy is saved sends no image data; the copy and the offline copy complete (${way})`, async ({
      page,
      context,
      request,
      browserName,
    }) => {
      // ADR-0025.1 (QA security M1): on WebKit the effects worker script, requested through the active
      // /sw.js before the offline copy holds it, falls under /sw.js's own policy, which allows it with
      // `worker-src 'self'`; the blur gets its exact patch and the copy succeeds.
      await grantClipboard(context, browserName);
      await recordClipboard(page);
      await page.setViewportSize({ width: 1472, height: 868 });
      const seen = recordNetwork(context);
      await resetLogs(request);

      // The window F-017 security m3 is about: the offline worker is active (it answers this site's
      // requests) but the offline copy is not saved yet. Since ADR-0025.4 the build's files are seeded as
      // soon as the worker is ready, so the effects worker script may already be stored (the cache-miss
      // case of QA security M1 is checked deterministically by the next test).
      const frame = await openTool(page, way, 'commit');
      const before = await frame.evaluate(async (name) => {
        await navigator.serviceWorker.ready;
        const cache = (await caches.has(name)) ? await caches.open(name) : null;
        const keys = cache ? (await cache.keys()).map((r) => new URL(r.url).pathname) : [];
        return {
          controlled: !!navigator.serviceWorker.controller,
          pageStored: keys.includes('/'),
          workerStored: keys.some((k) => k.startsWith('/assets/worker-')),
        };
      }, CACHE);
      expect(before.controlled).toBe(false);
      test.info().annotations.push({ type: 'evidence', description: `before the paste: ${JSON.stringify(before)}` });

      await pasteNoise(frame);
      await expect(summary(page, way)).toHaveText('400 × 300 px canvas, 0 annotations');
      await redact(page, way, /^Blur/, [20, 20], [180, 140]);
      await redact(page, way, /^Solid \(secure\)/, [220, 20], [380, 140]);
      await expect(summary(page, way)).toHaveText('400 × 300 px canvas, 2 annotations');
      await toolbar(page, way).getByRole('button', { name: 'Copy', exact: true }).click();
      const notice = ui(page, way).locator('.tk-notice');
      await expect(notice).not.toHaveAttribute('data-copy-id', 'export.preparing', { timeout: 20_000 });

      // The offline copy still completes after work started before it, and nothing carried the image.
      await offlineReady(frame);
      const log = await logOf(request);
      expectOnlyOwnFiles(seen, log);
      test.info().annotations.push({
        type: 'evidence',
        description: `${browserName} ${way}: ${log.length} tool requests; worker script: ${log
          .filter((r) => /^\/assets\/worker-/.test(r.path))
          .map((r) => `${r.dest}/${r.mode}`)
          .join(', ')}; copy: ${await notice.getAttribute('data-copy-id')}`,
      });

      // It works offline: the effects worker comes from the offline copy (the export waits for it).
      const copyResult = await notice.textContent();
      const clipBytes = copyResult?.startsWith('Copied') ? await copied(frame) : null;
      await serverDown(request, true);
      await resetLogs(request);
      const off = await openTool(page, way);
      expect((await logOf(request)).every((r) => r.refused)).toBe(true);
      await pasteNoise(off);
      await expect(summary(page, way)).toHaveText('400 × 300 px canvas, 0 annotations');
      await redact(page, way, /^Pixelate/, [20, 20], [180, 140]);
      const file = await download(page, () =>
        toolbar(page, way).getByRole('button', { name: 'Download', exact: true }).click(),
      );
      const png = expectCleanPng(file.bytes);
      expect([png.width, png.height]).toEqual([400, 300]);
      // A pixelate block is uniform (the noise source never is).
      const block = pngRegion(png, 40, 40, 4, 1);
      expect(new Set(block.filter((_, i) => i % 4 === 0)).size).toBe(1);

      // Last: the copy made before the offline copy was saved completed, with the exact blur.
      expect(copyResult).toContain('Copied, with 2 redactions applied.');
      const clip = expectCleanPng(clipBytes!);
      expect([clip.width, clip.height]).toEqual([400, 300]);
      expect(pngRegion(clip, 300, 80, 1, 1)).toEqual([0, 0, 0, 255]);
    });
  }

  for (const way of WAYS) {
    test(`ADR-0025.1 QA security M1 the effects worker script missing from the offline copy is fetched through /sw.js; blur exports (${way})`, async ({
      page,
      context,
      request,
      browserName,
    }) => {
      await grantClipboard(context, browserName);
      await recordClipboard(page);
      await page.setViewportSize({ width: 1472, height: 868 });
      await resetLogs(request);
      await offlineReady(await openTool(page, way));
      // As after a new version or an eviction: the stored copy lacks the effects worker script.
      const removed = await (
        await openTool(page, way)
      ).evaluate(async (name) => {
        const cache = await caches.open(name);
        let n = 0;
        for (const r of await cache.keys())
          if (new URL(r.url).pathname.startsWith('/assets/worker-')) n += Number(await cache.delete(r));
        return { n, controlled: !!navigator.serviceWorker.controller };
      }, CACHE);
      expect(removed).toEqual({ n: 1, controlled: true });
      const frame = await openTool(page, way);
      await pasteNoise(frame);
      await expect(summary(page, way)).toHaveText('400 × 300 px canvas, 0 annotations');
      await redact(page, way, /^Blur/, [20, 20], [180, 140]);
      await toolbar(page, way).getByRole('button', { name: 'Copy', exact: true }).click();
      const notice = ui(page, way).locator('.tk-notice');
      // Before ADR-0025.1 WebKit refused the script under /sw.js's own policy and the copy failed after 10 s.
      await expect(notice).toContainText('Copied, with 1 redaction applied.', { timeout: 20_000 });
      expect([...(await copied(frame))].length).toBeGreaterThan(0);
      // The worker answered the miss and keeps the script for offline use again.
      await expect.poll(async () => (await cachedKeys(frame)).some((k) => k.startsWith('/assets/worker-'))).toBe(true);
    });
  }

  for (const way of WAYS) {
    test(`NFR-01 INV-04 a full M-1 session from a first visit: the network log shows only the tool's own files, no bodies, no other origin (${way})`, async ({
      page,
      context,
      request,
      browserName,
    }) => {
      test.slow();
      await grantClipboard(context, browserName);
      await recordClipboard(page);
      await page.setViewportSize({ width: 1472, height: 868 });
      const seen = recordNetwork(context);
      await resetLogs(request);
      let frame: Frame;
      if (way === 'standalone') {
        await page.goto(`${TOOL_ALLOWED}/?lang=en-US`);
        frame = page.mainFrame();
      } else {
        await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_ALLOWED, 'light', 'en-US'));
        frame = await toolFrame(page);
      }
      await m1Tour(page, frame);
      if (way === 'embedded') {
        await settle(page);
        expect(await received(page)).toEqual([{ origin: TOOL_ALLOWED, data: { type: 'taro:ready' } }]);
      }
      const log = await logOf(request);
      expectOnlyOwnFiles(seen, log);
      // Nothing reached the other tool origin either.
      expect(await logOf(request, TOOL_EMPTY)).toEqual([]);
      // INV-04: the only storage is the offline cache of the tool's own files.
      for (const k of await cachedKeys(frame)) expect(k).toMatch(/^\/(assets\/[\w.-]+)?$/);
      expect(await frame.evaluate(() => caches.keys())).toEqual([CACHE]);
      const storage = await frame.evaluate(async () => ({
        local: localStorage.length,
        session: sessionStorage.length,
        cookies: document.cookie,
        idb: 'databases' in indexedDB ? (await indexedDB.databases()).length : 0,
      }));
      expect(storage).toEqual({ local: 0, session: 0, cookies: '', idb: 0 });
      test.info().annotations.push({
        type: 'evidence',
        description: `${browserName} ${way}: ${log.length} tool requests (${[
          ...new Set(log.map((r) => `${r.dest || 'none'}`)),
        ].join(',')}); browser saw ${seen.length} requests`,
      });
    });
  }

  test('NFR-01 the page refuses every connection: own origin, another origin, beacon, image, socket', async ({
    page,
    request,
  }) => {
    await page.goto(`${TOOL_ALLOWED}/`);
    await expect(page.locator(SHELL)).toBeVisible();
    await page.waitForLoadState('load');
    await resetLogs(request);
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy|Refused/i.test(m.text())) violations.push(m.text());
    });
    const outcome = await page.evaluate(
      async ({ other }) => {
        const tryFetch = async (u: string, init?: RequestInit) => {
          try {
            await fetch(u, init);
            return 'sent';
          } catch {
            return 'refused';
          }
        };
        const img = await new Promise<string>((r) => {
          const i = new Image();
          i.onload = () => r('loaded');
          i.onerror = () => r('refused');
          i.src = `${other}/qa-img.png`;
        });
        let socket = 'refused';
        try {
          const ws = new WebSocket(other.replace('http', 'ws') + '/qa-ws');
          socket = await new Promise<string>((r) => {
            ws.onopen = () => r('open');
            ws.onerror = () => r('refused');
          });
        } catch {
          socket = 'refused';
        }
        return {
          own: await tryFetch('/qa-own'),
          other: await tryFetch(`${other}/qa-other`, { method: 'POST', body: 'x'.repeat(64) }),
          // Queued (true) even when the policy then refuses it: the server log below is the check.
          beacon: (navigator.sendBeacon(`${other}/qa-beacon`, 'x'), 'queued'),
          img,
          socket,
        };
      },
      { other: TOOL_EMPTY },
    );
    expect(outcome).toEqual({ own: 'refused', other: 'refused', beacon: 'queued', img: 'refused', socket: 'refused' });
    await page.waitForTimeout(300);
    expect((await logOf(request)).filter((r) => r.path.startsWith('/qa-'))).toEqual([]);
    expect(await logOf(request, TOOL_EMPTY)).toEqual([]);
  });

  test('NFR-09 RULE-16 the build with an empty HOST_ORIGINS refuses every embedder and compiles no host in', async ({
    page,
    request,
  }) => {
    const res = await request.get(`${TOOL_EMPTY}/`);
    expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    const allowed = await request.get(`${TOOL_ALLOWED}/`);
    expect(allowed.headers()['content-security-policy']).toContain(`frame-ancestors ${HOST_ALLOWED}`);
    // The compiled allow-list of that build names no origin (no message is accepted from anyone).
    const root = fileURLToPath(new URL('../../../dist-e2e/qa-security/empty/', import.meta.url));
    const main = /src="\/(assets\/index-[\w-]+\.js)"/.exec(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
    const code = fs.readFileSync(path.join(root, main![1]!), 'utf8');
    expect(code).not.toContain(HOST_ALLOWED);
    expect(code).not.toContain('https://tarokit.app');

    await resetLogs(request);
    await page.goto(hostPageUrl(HOST_ALLOWED, TOOL_EMPTY, 'dark', 'en-US'));
    await page.waitForFunction(() => (window as unknown as { __frameLoads?: number }).__frameLoads! >= 1);
    await settle(page);
    expect(await received(page)).toEqual([]);
    await expect(page.frameLocator('#tool').locator(SHELL)).toHaveCount(0);
    // A host that is not in any list is refused by the allowed build too.
    await page.goto(hostPageUrl(HOST_OTHER, TOOL_ALLOWED, 'dark', 'en-US'));
    await page.waitForFunction(() => (window as unknown as { __frameLoads?: number }).__frameLoads! >= 1);
    await settle(page);
    expect(await received(page)).toEqual([]);
    // Standalone, the empty build works.
    await page.goto(`${TOOL_EMPTY}/`);
    await expect(page.locator(SHELL)).toBeVisible();
  });
});
