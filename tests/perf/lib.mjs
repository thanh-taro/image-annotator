// QA perf helpers (NFR-02..05): production build on Chromium via Playwright + CDP. Not part of `pnpm test`.
// Run: pnpm build; pnpm preview --port 4321 --strictPort &; node tests/perf/<script>.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE = path.join(HERE, '.cache');
export const OUT = path.join(HERE, 'out');
export const URL_BASE = process.env.PERF_URL ?? 'http://localhost:4321/';
export const IMAGES = {
  mp147: { file: 'ref-5120x2880.png', w: 5120, h: 2880 },
  mp52: { file: 'ref-2880x1800.png', w: 2880, h: 1800 },
  limit: { file: 'limit-4096x4096.png', w: 4096, h: 4096 },
  limit2: { file: 'limit2-4096x4096.png', w: 4096, h: 4096 },
};
export const VIEWPORT = { width: 1472, height: 868 }; // work area 1200 x 800 as in the e2e suite
export const load1 = () => os.loadavg()[0];
export const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};
export const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : NaN;
};
export const r1 = (n) => Math.round(n * 10) / 10;

export async function launch(opts = {}) {
  return chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc', ...(opts.args ?? [])], headless: opts.headless ?? true });
}

/** Generates the reference images once (screenshot-like: flat panels, text, gradients, some noise). */
export async function ensureImages(browser) {
  fs.mkdirSync(CACHE, { recursive: true });
  const missing = Object.values(IMAGES).filter((i) => !fs.existsSync(path.join(CACHE, i.file)));
  if (!missing.length) return;
  const page = await browser.newPage();
  for (const img of missing) {
    const b64 = await page.evaluate(
      async ({ w, h, seed }) => {
        const c = new OffscreenCanvas(w, h);
        const ctx = c.getContext('2d', { colorSpace: 'srgb' });
        let s = seed;
        const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#f3f5fa');
        g.addColorStop(1, '#d9e0ee');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = `rgb(${(rnd() * 255) | 0},${(rnd() * 255) | 0},${(rnd() * 255) | 0})`;
          ctx.globalAlpha = 0.5 + rnd() * 0.5;
          ctx.fillRect(rnd() * w, rnd() * h, 20 + rnd() * w * 0.08, 10 + rnd() * h * 0.08);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#111';
        ctx.font = '18px sans-serif';
        for (let y = 30; y < h; y += 26) for (let x = 20; x < w; x += 420) ctx.fillText(`jane.doe${y}@example.com  row ${y}`, x, y);
        // a noisy photo-like region (about a tenth of the area)
        const nw = Math.floor(w / 3), nh = Math.floor(h / 3);
        const id = ctx.createImageData(nw, nh);
        for (let i = 0; i < id.data.length; i += 4) {
          id.data[i] = rnd() * 255; id.data[i + 1] = rnd() * 255; id.data[i + 2] = rnd() * 255; id.data[i + 3] = 255;
        }
        ctx.putImageData(id, Math.floor(w / 3), Math.floor(h / 3));
        const blob = await c.convertToBlob({ type: 'image/png' });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return btoa(bin);
      },
      { w: img.w, h: img.h, seed: img.w + img.file.length * 7919 },
    );
    fs.writeFileSync(path.join(CACHE, img.file), Buffer.from(b64, 'base64'));
  }
  await page.close();
}

export async function newPage(browser, ctxOpts = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, ...ctxOpts });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(URL_BASE).origin }).catch(() => {});
  const page = await context.newPage();
  await page.addInitScript(() => {
    // frame / long-task / event-timing recorder, active between __perf.start() and __perf.stop()
    const st = { on: false, frames: [], long: [], ev: [] };
    window.__perf = st;
    let last = 0;
    const loop = (t) => { if (st.on) { if (last) st.frames.push(t - last); last = t; } else last = 0; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    try { new PerformanceObserver((l) => { if (st.on) for (const e of l.getEntries()) st.long.push(e.duration); }).observe({ type: 'longtask' }); } catch {}
    try { new PerformanceObserver((l) => { if (st.on) for (const e of l.getEntries()) if (e.name === 'pointermove' || e.name === 'wheel') st.ev.push(e.duration); }).observe({ type: 'event', durationThreshold: 16, buffered: false }); } catch {}
    window.__perfStart = () => { st.frames = []; st.long = []; st.ev = []; st.on = true; };
    window.__perfStop = () => { st.on = false; return { frames: st.frames, long: st.long, ev: st.ev }; };
    window.__clip = { click: 0, write: 0, done: 0 };
    document.addEventListener('click', () => { window.__clip.click = performance.now(); }, true);
    const cb = navigator.clipboard;
    if (cb && cb.write) {
      const real = cb.write.bind(cb);
      cb.write = (items) => { window.__clip.write = performance.now(); return real(items).finally(() => { window.__clip.done = performance.now(); }); };
    }
  });
  return { context, page };
}

export const toolbar = (page) => page.getByRole('toolbar', { name: 'Tools and actions' });
export const summary = (page) => page.locator('#tk-canvas-summary');
export const nextFrame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

export async function openApp(page) {
  await page.goto(URL_BASE);
  await page.locator('[data-screen="SCR-Annotator"]').waitFor();
}

/** Stage a File in the page (so timed runs exclude moving bytes from Node). */
export async function stage(page, img) {
  const b64 = fs.readFileSync(path.join(CACHE, img.file)).toString('base64');
  await page.evaluate(({ b64, name }) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    (window.__files ??= {})[name] = new File([u], name, { type: 'image/png' });
  }, { b64, name: img.file });
}

/** Opens a staged image by paste or drop; resolves with ms from dispatch to the canvas summary showing, plus 2 frames. */
export async function openStaged(page, img, via) {
  return page.evaluate(({ name, w, h, via }) => new Promise((resolve, reject) => {
    const want = `${w.toLocaleString('en-US')} × ${h.toLocaleString('en-US')} px canvas`;
    const dt = new DataTransfer();
    dt.items.add(window.__files[name]);
    const el = document.querySelector('#tk-canvas-summary');
    const done = (t0) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0)));
    const t0 = performance.now();
    const obs = new MutationObserver(() => {
      const s = document.querySelector('#tk-canvas-summary');
      if (s && s.textContent.startsWith(want)) { obs.disconnect(); done(t0); }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    setTimeout(() => { obs.disconnect(); reject(new Error('open timeout ' + (document.querySelector('#tk-canvas-summary')?.textContent ?? 'none'))); }, 30000);
    if (via === 'paste') (document.activeElement ?? document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    else document.querySelector('main').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }), { name: img.file, w: img.w, h: img.h, via });
}

export async function confirmReplaceIfAsked(page) {
  const d = page.getByRole('alertdialog');
  if (await d.count()) await d.getByRole('button', { name: 'Replace', exact: true }).click();
}

export const annotationCount = async (page) => {
  const t = (await summary(page).textContent()) ?? '';
  const m = /, (\d+) annotations?$/.exec(t);
  return m ? Number(m[1]) : -1;
};

/** Mouse helpers: work area box and the displayed image rectangle at fit zoom. */
export async function imageRect(page, img) {
  const box = await page.locator('main.tk-work-area').boundingBox();
  const s = Math.min(box.width / img.w, box.height / img.h) * 0.9;
  const w = img.w * s, h = img.h * s;
  return { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, w, h };
}

export async function pick(page, name) { await toolbar(page).getByRole('radio', { name }).click(); }

/** Draws `n` annotations (n - redactions + redactions) with the mouse at the fit view. */
export async function buildDoc(page, img, n, redactions) {
  const R = await imageRect(page, img);
  let seed = 99;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const rect = () => { const w = 40 + rnd() * 110, h = 25 + rnd() * 70; return [R.x + 5 + rnd() * (R.w - w - 10), R.y + 5 + rnd() * (R.h - h - 10), w, h]; };
  const drag = async (kindPts) => {
    const [x, y, w, h] = rect();
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + w / 2, y + h / 3, { steps: 2 }); await page.mouse.move(x + w, y + h, { steps: 2 }); await page.mouse.up();
  };
  const plain = n - redactions;
  const kinds = ['Rectangle (R)', 'Ellipse (O)', 'Line (L)', 'Arrow (A)', 'Pen (P)', 'Highlight (H)'];
  const stepsN = Math.min(10, plain);
  const per = Math.floor((plain - stepsN) / kinds.length);
  for (const [i, k] of kinds.entries()) {
    await pick(page, k);
    const cnt = i === kinds.length - 1 ? plain - stepsN - per * (kinds.length - 1) : per;
    for (let j = 0; j < cnt; j++) await drag();
  }
  await pick(page, 'Step (N)');
  for (let j = 0; j < stepsN; j++) { const [x, y] = rect(); await page.mouse.click(x, y); }
  await page.keyboard.press('Escape');
  await pick(page, 'Redact (X)');
  const kind = (re) => page.getByRole('complementary', { name: 'Style' }).getByRole('group', { name: 'Redaction type' }).getByRole('radio', { name: re });
  for (let j = 0; j < redactions; j++) {
    if (j === 0) await kind(/^Blur/).check();
    if (j === Math.ceil(redactions / 2)) await kind(/^Pixelate/).check();
    await drag();
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction((n) => /, (\d+) annotations?$/.exec(document.querySelector('#tk-canvas-summary')?.textContent ?? '')?.[1] == n, n, { timeout: 60000 }).catch(() => {});
  return annotationCount(page);
}

/** Process memory via macOS `footprint` for the browser's renderer and GPU processes (MB). */
export async function processMemory(browser) {
  const cdp = await browser.newBrowserCDPSession();
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  await cdp.detach();
  const out = { renderer: 0, gpu: 0, other: 0, pids: {} };
  for (const p of processInfo) {
    let mb = 0;
    try {
      const txt = execFileSync('footprint', ['-p', String(p.id)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const m = /Footprint:\s+([\d.]+)\s*(KB|MB|GB)/.exec(txt);
      if (m) mb = Number(m[1]) * { KB: 1 / 1024, MB: 1, GB: 1024 }[m[2]];
    } catch {}
    (out.pids[p.type] ??= []).push([p.id, r1(mb)]);
    if (p.type === 'renderer') out.renderer += mb; else if (/^gpu/i.test(p.type)) out.gpu += mb; else out.other += mb;
  }
  return out;
}
export const write = (name, obj) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 2)); };
