// QA visual regression, step 1: render each design artboard (design/canvas/project/*.dc.html) with
// Playwright Chromium, one PNG per theme panel (the `.app` element), without the Claude Design runtime:
// the artboards use one template construct (<sc-for list="{{themes}}">), expanded here for dark and light.
// Usage: node tests/visual/render-artboards.mjs <out-dir>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '../..');
const dir = path.join(root, 'design/canvas/project');
const out = process.argv[2] ?? path.join(root, '.build-my-app/reports/screens/qa');
fs.mkdirSync(out, { recursive: true });
const font = (f) =>
  fs.readFileSync(path.join(root, 'node_modules/@fontsource-variable/manrope/files', f)).toString('base64');
const faces = ['latin', 'vietnamese']
  .map(
    (s) =>
      `@font-face{font-family:Manrope;font-weight:200 800;src:url(data:font/woff2;base64,${font(`manrope-${s}-wght-normal.woff2`)}) format('woff2')}`,
  )
  .join('\n');

const themes = [
  { name: 'dark', cls: 'tk-dark' },
  { name: 'light', cls: 'tk-light' },
];
const files = fs.readdirSync(dir).filter((f) => /^(SCR-Annotator_.*|Main)\.dc\.html$/.test(f));

const browser = await chromium.launch();
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const helmet = /<helmet>([\s\S]*?)<\/helmet>/.exec(src)?.[1] ?? '';
  const loop = /<sc-for[^>]*>([\s\S]*?)<\/sc-for>/.exec(src)?.[1] ?? '';
  const body = themes.map((t) => loop.replaceAll('{{t.cls}}', t.cls).replaceAll('{{t.name}}', t.name)).join('\n');
  const head = helmet.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, '');
  const name = f === 'Main.dc.html' ? 'default_embedded' : f.replace(/^SCR-Annotator_/, '').replace('.dc.html', '');
  const html = `<!doctype html><html lang="${name.endsWith('-vi') ? 'vi' : 'en'}"><head><meta charset="utf-8"><style>${faces}</style>${head}</head><body><div style="display:flex;gap:40px;padding:40px;background:#0B0812">${body}</div></body></html>`;
  const page = await browser.newPage({ viewport: { width: 2600, height: 1000 }, deviceScaleFactor: 1 });
  await page.route(/^https?:/, (r) => r.abort());
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  for (const t of themes) {
    await page
      .locator(`.${t.cls} .app`)
      .first()
      .screenshot({ path: path.join(out, `design_${name}_${t.name}.png`) });
  }
  await page.close();
  console.log('rendered', name);
}
await browser.close();
