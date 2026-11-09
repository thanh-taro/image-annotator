// NFR-04 memory: OS footprint (macOS `footprint`) of the page's renderer process + GPU process, minus a
// blank page's GPU process, after load, edit (200 annotations incl. 10 redactions), export and replace.
// Cycles: load A, edit, export, replace with B (x3). "Released" = replace-stage footprint of cycle 3 vs 2 (10 %).
import { launch, ensureImages, newPage, openApp, stage, openStaged, IMAGES, load1, r1, write, buildDoc, processMemory, toolbar, confirmReplaceIfAsked } from './lib.mjs';
const browser = await launch();
await ensureImages(browser);
const settle = async (page, cdp) => { await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(1500); await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(500); };
const snap = async (page, cdp, label, base) => {
  await settle(page, cdp);
  const m = await processMemory(browser);
  const heap = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6;
  const tool = m.renderer + Math.max(0, m.gpu - base.gpu);
  const row = { label, renderer: r1(m.renderer), gpu: r1(m.gpu), toolMB: r1(tool), jsHeap: r1(heap), load: r1(load1()) };
  console.log(JSON.stringify(row));
  return row;
};
// blank-page baseline
const b = await newPage(browser); await openApp(b.page);
const bcdp = await b.context.newCDPSession(b.page);
await settle(b.page, bcdp);
const base = await processMemory(browser);
console.log('blank page (tool open, no image):', JSON.stringify(base));
const blankTool = r1(base.renderer);
await b.context.close();

const out = [];
for (let run = 0; run < Number(process.env.RUNS ?? 1); run++) {
  const { context, page } = await newPage(browser);
  const cdp = await context.newCDPSession(page);
  await openApp(page);
  await stage(page, IMAGES.limit); await stage(page, IMAGES.limit2);
  const rows = [];
  rows.push(await snap(page, cdp, 'empty tool', base));
  for (let cycle = 1; cycle <= 3; cycle++) {
    const img = cycle % 2 ? IMAGES.limit : IMAGES.limit2;
    const imgB = cycle % 2 ? IMAGES.limit2 : IMAGES.limit;
    if (cycle === 1) await openStaged(page, img, 'paste');
    rows.push(await snap(page, cdp, `c${cycle} load`, base));
    const n = await buildDoc(page, img, 200, 10);
    rows.push({ ...(await snap(page, cdp, `c${cycle} edit (${n} annotations)`, base)) });
    const [d] = await Promise.all([page.waitForEvent('download'), toolbar(page).getByRole('button', { name: 'Download', exact: true }).click()]); await d.path();
    rows.push(await snap(page, cdp, `c${cycle} after export`, base));
    // replace by paste: confirmation (unsaved changes were exported, so it may not ask)
    const p = openStaged(page, imgB, 'paste');
    await page.waitForTimeout(500); await confirmReplaceIfAsked(page);
    await p;
    rows.push(await snap(page, cdp, `c${cycle} replace`, base));
  }
  out.push(rows);
  await context.close();
}
write('memory.json', { blank: base, out });
await browser.close();
