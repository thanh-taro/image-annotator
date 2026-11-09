// NFR-03 speed: open (paste, drop, file chooser) and export (download, copy) timings, N runs, medians.
import path from 'node:path';
import {
  launch,
  ensureImages,
  newPage,
  openApp,
  stage,
  openStaged,
  IMAGES,
  CACHE,
  load1,
  median,
  r1,
  write,
  toolbar,
  buildDoc,
} from './lib.mjs';
const N = Number(process.env.RUNS ?? 5);
const browser = await launch();
await ensureImages(browser);
const results = [];
for (const key of ['mp147', 'mp52']) {
  const img = IMAGES[key];
  const rows = {
    open_paste: [],
    open_drop: [],
    open_file: [],
    export_download_bare: [],
    export_copy_bare: [],
    export_download_doc: [],
    export_copy_doc: [],
    load: [],
  };
  for (let run = 0; run < N; run++) {
    const { context, page } = await newPage(browser);
    await openApp(page);
    await stage(page, img);
    rows.load.push(r1(load1()));
    rows.open_paste.push(r1(await openStaged(page, img, 'paste')));
    // second open of the same image: drop (replace, no changes so no confirm)
    rows.open_drop.push(r1(await openStaged(page, img, 'drop')));
    // file chooser (wall clock incl. Playwright file read)
    const t0 = Date.now();
    const chooser = page.waitForEvent('filechooser');
    await toolbar(page).getByRole('button', { name: 'Open image' }).click();
    await (await chooser).setFiles(path.join(CACHE, img.file));
    await page.waitForFunction(
      (w) => document.querySelector('#tk-canvas-summary')?.textContent?.startsWith(w),
      `${img.w.toLocaleString('en-US')} × ${img.h.toLocaleString('en-US')}`,
    );
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    rows.open_file.push(Date.now() - t0);
    const exportDl = async () => {
      const t = Date.now();
      const [d] = await Promise.all([
        page.waitForEvent('download'),
        toolbar(page).getByRole('button', { name: 'Download', exact: true }).click(),
      ]);
      await d.path();
      return Date.now() - t;
    };
    const exportCopy = async () => {
      await page.evaluate(() => (window.__clip = { click: 0, write: 0, done: 0 }));
      await toolbar(page).getByRole('button', { name: 'Copy', exact: true }).click();
      await page.waitForFunction(() => window.__clip.done > 0, null, { timeout: 30000 });
      return page.evaluate(() => ({
        toWrite: window.__clip.write - window.__clip.click,
        toDone: window.__clip.done - window.__clip.click,
      }));
    };
    rows.export_download_bare.push(await exportDl());
    const c1 = await exportCopy();
    rows.export_copy_bare.push(r1(c1.toDone));
    if (run < 3) {
      const n = await buildDoc(page, img, 100, 10);
      rows.export_download_doc.push(await exportDl());
      const c2 = await exportCopy();
      rows.export_copy_doc.push(r1(c2.toDone));
      rows.docCount = n;
    }
    await context.close();
  }
  const med = Object.fromEntries(
    Object.entries(rows)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => [k, r1(median(v))]),
  );
  results.push({ key, img, rows, med });
  console.log(key, JSON.stringify(med), JSON.stringify(rows));
}
write('speed.json', { loadAvgEnd: load1(), results });
await browser.close();
