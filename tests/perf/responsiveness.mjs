// NFR-02 responsiveness: 100 annotations (10 blur/pixelate) on the reference images; paced pointer drags
// (one move per frame) while recording frame intervals (rAF), long tasks, Event Timing and a CDP trace.
import {
  launch,
  ensureImages,
  newPage,
  openApp,
  stage,
  openStaged,
  IMAGES,
  load1,
  pct,
  r1,
  write,
  buildDoc,
  pick,
  imageRect,
  nextFrame,
  toolbar,
} from './lib.mjs';
const N = Number(process.env.RUNS ?? 3);
const browser = await launch();
await ensureImages(browser);
const FRAME = 1000 / 60;

// One synthetic pointermove per animation frame, dispatched inside the page (the real button press and
// release go through CDP): Node round trips would otherwise cap the input rate far below 60 Hz under load.
async function paced(page, pts) {
  await page.evaluate(
    (pts) =>
      new Promise((res) => {
        let i = 0;
        const costs = [];
        const step = () => {
          if (i >= pts.length) {
            window.__moveCost = costs;
            return res();
          }
          const [x, y] = pts[i++];
          const t = performance.now();
          (document.elementFromPoint(x, y) ?? document.body).dispatchEvent(
            new PointerEvent('pointermove', {
              clientX: x,
              clientY: y,
              bubbles: true,
              cancelable: true,
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true,
              buttons: 1,
            }),
          );
          costs.push(performance.now() - t);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    pts,
  );
}
const line = (a, b, n) =>
  Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * (i + 1)) / n, a[1] + ((b[1] - a[1]) * (i + 1)) / n]);

async function scenario(page, cdp, name, fn) {
  await nextFrame(page);
  await nextFrame(page);
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await browser.startTracing(page, {
    categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'cc', 'benchmark'],
  });
  await page.evaluate(() => window.__perfStart());
  const t0 = Date.now();
  await fn();
  const wall = Date.now() - t0;
  const d = await page.evaluate(() => window.__perfStop());
  const mc = await page.evaluate(() => {
    const c = window.__moveCost ?? [];
    window.__moveCost = [];
    return c;
  });
  const cnt = await page.locator('#tk-canvas-summary').textContent();
  const trace = JSON.parse((await browser.stopTracing()).toString());
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const ev = trace.traceEvents ?? trace;
  const draws = ev.filter((e) => e.name === 'DrawFrame').length;
  const mainTasks = ev
    .filter((e) => e.name === 'RunTask' && e.dur && e.args?.src_func === undefined)
    .map((e) => e.dur / 1000);
  const f = d.frames;
  return {
    name,
    summary: cnt,
    wallMs: wall,
    frames: f.length,
    moveSyncP95: r1(pct(mc, 95)),
    moveSyncMax: r1(Math.max(0, ...mc)),
    frameP50: r1(pct(f, 50)),
    frameP95: r1(pct(f, 95)),
    frameMax: r1(Math.max(...f, 0)),
    pctOver20: r1((100 * f.filter((x) => x > 20.8).length) / Math.max(1, f.length)),
    over33: f.filter((x) => x > 33.4).length,
    longTasks: d.long.length,
    longMax: r1(Math.max(0, ...d.long)),
    evCount: d.ev.length,
    evMax: r1(Math.max(0, ...d.ev)),
    drawFrames: draws,
    drawFps: r1((draws * 1000) / wall),
    scriptMs: r1((m1.ScriptDuration - m0.ScriptDuration) * 1000),
    taskMs: r1((m1.TaskDuration - m0.TaskDuration) * 1000),
    traceTaskOver16: mainTasks.filter((x) => x > FRAME).length,
    traceTaskMax: r1(Math.max(0, ...mainTasks)),
  };
}

const all = [];
for (const key of ['mp147', 'mp52']) {
  const img = IMAGES[key];
  for (let run = 0; run < N; run++) {
    const { context, page } = await newPage(browser);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await openApp(page);
    await stage(page, img);
    await openStaged(page, img, 'paste');
    const count = await buildDoc(page, img, 100, 10);
    const R = await imageRect(page, img);
    const load = r1(load1());
    const res = [];
    // draw a rectangle, a blur box
    const free = [R.x + R.w * 0.55, R.y + R.h * 0.15];
    await pick(page, 'Rectangle (R)');
    res.push(
      await scenario(page, cdp, 'draw rectangle', async () => {
        await page.mouse.move(...free);
        await page.mouse.down();
        await paced(page, line(free, [free[0] + 220, free[1] + 120], 50));
        await page.mouse.up();
      }),
    );
    await pick(page, 'Redact (X)');
    const free2 = [R.x + R.w * 0.1, R.y + R.h * 0.6];
    res.push(
      await scenario(page, cdp, 'draw blur box (260x150 screen px)', async () => {
        await page.mouse.move(...free2);
        await page.mouse.down();
        await paced(page, line(free2, [free2[0] + 260, free2[1] + 150], 50));
        await page.mouse.up();
      }),
    );
    // the blur box is selected: switch to Select, resize by its bottom-right handle, then move by its edge
    await pick(page, 'Select (V)');
    const br = [free2[0] + 260, free2[1] + 150];
    res.push(
      await scenario(page, cdp, 'resize blur box (handle)', async () => {
        await page.mouse.move(...br);
        await nextFrame(page);
        await page.mouse.down();
        await paced(page, line(br, [br[0] + 120, br[1] + 60], 40));
        await page.mouse.up();
      }),
    );
    const edge = [free2[0] + 130, free2[1]]; // top edge middle
    res.push(
      await scenario(page, cdp, 'move blur box', async () => {
        await page.mouse.move(...edge);
        await nextFrame(page);
        await page.mouse.down();
        await paced(page, line(edge, [edge[0] + 300, edge[1] - 80], 50));
        await page.mouse.up();
      }),
    );
    // the rectangle drawn first
    const rb = [free[0] + 220, free[1] + 120];
    await page.mouse.click(free[0] + 110, free[1]);
    await nextFrame(page);
    res.push(
      await scenario(page, cdp, 'resize rectangle (handle)', async () => {
        await page.mouse.move(...rb);
        await nextFrame(page);
        await page.mouse.down();
        await paced(page, line(rb, [rb[0] + 100, rb[1] + 80], 40));
        await page.mouse.up();
      }),
    );
    const redge = [free[0] + 160, free[1]];
    res.push(
      await scenario(page, cdp, 'move rectangle', async () => {
        await page.mouse.move(...redge);
        await nextFrame(page);
        await page.mouse.down();
        await paced(page, line(redge, [redge[0] - 200, redge[1] + 150], 50));
        await page.mouse.up();
      }),
    );
    // zoom (ctrl+wheel) and pan (wheel) - NFR-02 needs 100 ms feedback only
    const mid = [R.x + R.w / 2, R.y + R.h / 2];
    res.push(
      await scenario(page, cdp, 'zoom (ctrl+wheel x12)', async () => {
        await page.mouse.move(...mid);
        for (let i = 0; i < 12; i++) {
          await page.keyboard.down('Control');
          await page.mouse.wheel(0, -120);
          await page.keyboard.up('Control');
          await nextFrame(page);
        }
      }),
    );
    res.push(
      await scenario(page, cdp, 'pan (wheel x20)', async () => {
        for (let i = 0; i < 20; i++) {
          await page.mouse.wheel(40, 30);
          await nextFrame(page);
        }
      }),
    );
    const zoom = await page.locator('.tk-zoom__level').textContent();
    // input feedback: time from a click on a toolbar tool to its checked state + a frame
    const fb = [];
    for (const n of ['Rectangle (R)', 'Ellipse (O)', 'Select (V)', 'Pen (P)', 'Select (V)']) {
      const t = await page.evaluate(() => performance.now());
      await toolbar(page).getByRole('radio', { name: n }).click();
      await page
        .waitForFunction(
          (n) =>
            document.querySelector(`[role=radio][aria-label="${n}"]`)?.getAttribute('aria-checked') === 'true' ||
            document.querySelector(`input[type=radio]:checked`),
          n,
        )
        .catch(() => {});
      await nextFrame(page);
      fb.push(r1((await page.evaluate(() => performance.now())) - t));
    }
    all.push({ key, run, load, count, zoomAfter: zoom, feedbackMs: fb, res });
    console.log(key, run, 'load', load, 'count', count, 'zoom', zoom);
    for (const r of res) console.log('  ', JSON.stringify(r));
    await context.close();
  }
}
write('responsiveness.json', { loadEnd: load1(), all });
await browser.close();
