// NFR-05 startup: cold (fresh context, no cache) and cached (service worker seeded) at 10 Mbit/s, 40 ms RTT
// (CDP Network.emulateNetworkConditions). "Interactive" = the tool's screen is mounted, the Open button is
// attached and a pointer event on it is handled within a frame, after the main thread has no long task.
import { launch, newPage, URL_BASE, load1, median, r1, write } from './lib.mjs';
const N = Number(process.env.RUNS ?? 5);
const browser = await launch();
const THROTTLE = { offline: false, latency: 40, downloadThroughput: (10 * 1e6) / 8, uploadThroughput: (10 * 1e6) / 8 };

async function visit(context, page, cdp) {
  let bytes = 0; const reqs = [];
  const onFin = (e) => { bytes += e.encodedDataLength; };
  cdp.on('Network.loadingFinished', onFin);
  cdp.on('Network.requestWillBeSent', (e) => reqs.push(e.request.url.replace(URL_BASE, '/')));
  const t0 = Date.now();
  await page.goto(URL_BASE, { waitUntil: 'commit' });
  await page.locator('[data-screen="SCR-Annotator"]').waitFor();
  const open = toolbarOpen(page);
  await open.waitFor();
  // interactive: a click event dispatched on the button is handled and a frame follows
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const tWall = Date.now() - t0;
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint');
    return { ttfb: n.responseStart, domContentLoaded: n.domContentLoadedEventEnd, load: n.loadEventEnd, fcp: fcp?.startTime ?? null, fontsLoaded: document.fonts.status, mountedAt: performance.now() };
  });
  // a real input on the controls: measure click-to-frame latency on an inert target (theme-neutral: focus)
  const lat = await page.evaluate(() => new Promise((res) => { const t = performance.now(); document.querySelector('main')?.focus(); requestAnimationFrame(() => res(performance.now() - t)); }));
  const longs = await page.evaluate(() => performance.getEntriesByType('long-animation-frame').map((e) => [Math.round(e.startTime), Math.round(e.duration)]).slice(0, 8)).catch(() => []);
  cdp.off('Network.loadingFinished', onFin);
  return { tWall, ...nav, inputFrameMs: r1(lat), bytes, nreq: reqs.length, reqs, longs };
}
const toolbarOpen = (page) => page.getByRole('toolbar', { name: 'Tools and actions' }).getByRole('button', { name: 'Open image' });

const rows = { cold: [], cached: [], warmNoThrottle: [] };
for (let i = 0; i < N; i++) {
  const { context, page } = await newPage(browser, { serviceWorkers: 'allow' });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', THROTTLE);
  const cold = await visit(context, page, cdp); cold.load1 = r1(load1());
  rows.cold.push(cold);
  // wait for the service worker to seed the offline cache (fonts + files)
  await page.waitForFunction(async () => { const k = await caches.keys(); if (!k.length) return false; let n = 0; for (const c of k) n += (await (await caches.open(c)).keys()).length; return n >= 8; }, null, { timeout: 60000, polling: 500 }).catch(() => {});
  await page.waitForTimeout(1500);
  const cn = await page.evaluate(async () => { const k = await caches.keys(); const out = []; for (const c of k) out.push([c, (await (await caches.open(c)).keys()).length]); return { controller: !!navigator.serviceWorker.controller, out }; });
  const cached = await visit(context, page, cdp); cached.load1 = r1(load1()); cached.sw = cn;
  rows.cached.push(cached);
  await context.close();
  console.log(i, 'cold', cold.tWall, 'fcp', r1(cold.fcp), 'mount', r1(cold.mountedAt), 'bytes', cold.bytes, '| cached', cached.tWall, 'fcp', r1(cached.fcp), 'mount', r1(cached.mountedAt), 'bytes', cached.bytes, JSON.stringify(cn), 'load', cold.load1);
}
const med = (k, f) => r1(median(rows[k].map(f)));
const summaryRow = Object.fromEntries(['cold', 'cached'].map((k) => [k, { wall: med(k, (r) => r.tWall), fcp: med(k, (r) => r.fcp), mount: med(k, (r) => r.mountedAt), load: med(k, (r) => r.load), bytes: med(k, (r) => r.bytes), nreq: med(k, (r) => r.nreq) }]));
console.log(JSON.stringify(summaryRow));
write('startup.json', { loadEnd: load1(), summaryRow, rows });
await browser.close();
