// QA visual regression, step 2: drive the production build (vite preview) into each designed state and
// screenshot the whole page (1200 x 760 embedded, 390 x 760 narrow) in both themes, as `app_<state>_<theme>.png`.
// The sample screenshot is the artboards' own checkout sample, rendered from design/canvas/project/Main.dc.html
// without its annotations, so the app and the design show the same picture.
// Usage: BASE=http://localhost:4173 node tests/visual/capture-app.mjs <out-dir> [state ...]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '../..');
const base = process.env.BASE ?? 'http://localhost:4173';
const out = process.argv[2];
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
const WIDE = { width: 1200, height: 760 };
const NARROW = { width: 390, height: 760 };
const SCALE = 1756 / 720; // the artboards show the 720 x 450 sample as a 1,756 x 1,098 px image

const browser = await chromium.launch();

/** The checkout sample (no annotations) as PNG bytes. */
async function sample() {
  const src = fs.readFileSync(path.join(root, 'design/canvas/project/Main.dc.html'), 'utf8');
  const helmet = /<helmet>([\s\S]*?)<\/helmet>/.exec(src)?.[1] ?? '';
  const inner = /<div class="inner" data-sample="screenshot"[^>]*>([\s\S]*?)<\/div>\n<div class="ov"/.exec(src);
  if (!inner) throw new Error('sample not found');
  const page = await browser.newPage({ viewport: { width: 720, height: 450 }, deviceScaleFactor: SCALE });
  const html = inner[1]
    .replace(/<svg width="720"[\s\S]*?<\/svg>/, '')
    .replace(/<div style="position:absolute;left:448px;top:150px[^>]*><\/div>/, '')
    .replace(/<div data-sample="text-annotation"[\s\S]*?<\/div>/, '')
    .replace(
      /<div style="position:absolute;left:36px;top:\d+px;width:368px;height:32px;background:var\(--ann-black\)"><\/div>/g,
      '',
    );
  await page.setContent(
    `<style>body{margin:0}${helmet.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''}.inner{transform:none!important}</style><div class="tk-dark"><div class="inner" style="width:720px;height:450px">${html}</div></div>`,
  );
  const buf = await page.locator('.inner').screenshot();
  await page.close();
  return buf;
}
const SAMPLE = (await sample()).toString('base64');
fs.writeFileSync(path.join(out, 'sample.png'), Buffer.from(SAMPLE, 'base64'));

async function pasteImage(page, b64 = SAMPLE) {
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'shot.png', { type: 'image/png' }));
    (document.activeElement ?? document).dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, b64);
  await page.locator('#tk-canvas-summary').waitFor({ state: 'attached', timeout: 30000 });
}
const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250)))));

async function open(page, theme, vp, extra = '') {
  await page.setViewportSize(vp);
  await page.goto(`${base}/?theme=${theme}&lang=${extra.includes('vi') ? 'vi' : 'en-US'}`);
  await page.locator('[data-screen="SCR-Annotator"]').waitFor();
}

/** Draws the artboards' annotations (two redactions, rectangle, arrow, text); leaves the arrow tool, nothing selected. */
async function annotate(page) {
  const area = await page.locator('main.tk-work-area').boundingBox();
  const zoomText = await page
    .locator('.tk-zoom__level')
    .textContent()
    .catch(() => null);
  const pct = Number((zoomText ?? '50').replace(/\D/g, '')) / 100;
  // image origin on screen: centred horizontally; the artboards pin it to 24 px from the left
  const ox = area.x + (area.width - 1756 * pct) / 2;
  const oy = area.y + (area.height - 1098 * pct) / 2;
  const at = (x, y) => [ox + x * SCALE * pct, oy + y * SCALE * pct];
  const drag = async (a, b) => {
    const [x1, y1] = at(...a);
    const [x2, y2] = at(...b);
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 6 });
    await page.mouse.up();
  };
  await page.locator('main.tk-work-area').focus();
  const key = async (k) => {
    await page.keyboard.press(k);
  };
  await key('x');
  await drag([36, 130], [404, 162]);
  await key('Escape');
  await drag([36, 194], [404, 226]);
  await key('Escape');
  await key('r');
  await drag([448, 150], [692, 204]);
  await key('Escape');
  await key('a');
  await drag([420, 372], [533, 219]);
  await key('Escape');
  await key('t');
  await page.mouse.click(...at(300, 380));
  await page.keyboard.insertText('Shipping charged twice');
  await key('Escape');
  await key('Escape');
  await key('a');
  await settle(page);
  return { at, pct, ox, oy };
}

const click = (page, name) => page.getByRole('button', { name, exact: true }).click();
const states = {
  default_embedded: {
    vp: WIDE,
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
    },
  },
  default_narrow: {
    vp: NARROW,
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
    },
  },
  'default_narrow-vi': {
    vp: NARROW,
    vi: true,
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
    },
  },
  empty_embedded: { vp: WIDE, run: async () => {} },
  empty_narrow: { vp: NARROW, run: async () => {} },
  'dragging-file_embedded': {
    vp: WIDE,
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
      const dt = await p.evaluateHandle(() => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(8)], 'a.png', { type: 'image/png' }));
        return dt;
      });
      await p.dispatchEvent('main', 'dragenter', { dataTransfer: dt });
      await p.dispatchEvent('main', 'dragover', { dataTransfer: dt });
    },
  },
  loading_embedded: {
    vp: WIDE,
    init: () => {
      const original = window.createImageBitmap.bind(window);
      window.createImageBitmap = (...a) => new Promise((r) => setTimeout(r, 6000)).then(() => original(...a));
    },
    run: async (p) => {
      await p.evaluate(async (b64) => {
        const dt = new DataTransfer();
        dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'shot.png', { type: 'image/png' }));
        (document.activeElement ?? document).dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }),
        );
      }, SAMPLE);
      await p.locator('.tk-notice').waitFor({ timeout: 5000 });
    },
  },
  error_embedded: {
    vp: WIDE,
    init: () => {
      navigator.clipboard.write = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    },
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
      await click(p, 'Copy');
      await p.locator('.tk-notice').waitFor();
    },
  },
  exporting_embedded: {
    vp: WIDE,
    init: () => {
      const real = OffscreenCanvas.prototype.convertToBlob;
      OffscreenCanvas.prototype.convertToBlob = function (...a) {
        return new Promise((r) => setTimeout(r, 6000)).then(() => real.apply(this, a));
      };
      const toBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (...a) {
        setTimeout(() => toBlob.apply(this, a), 6000);
      };
    },
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
      await click(p, 'Copy');
      await p.locator('.tk-notice').waitFor({ timeout: 5000 });
    },
  },
  selecting_embedded: {
    vp: WIDE,
    run: async (p) => {
      await selectTwo(p);
    },
  },
  selecting_narrow: {
    vp: NARROW,
    run: async (p) => {
      await selectTwo(p);
    },
  },
  cropping_embedded: {
    vp: WIDE,
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
      await crop(p);
    },
  },
  cropping_narrow: {
    vp: NARROW,
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
      await crop(p);
    },
  },
  'canvas-settings_embedded': {
    vp: WIDE,
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
      await settings(p);
    },
  },
  'canvas-settings_narrow': {
    vp: NARROW,
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
      await settings(p);
    },
  },
  'confirm-replace_embedded': {
    vp: WIDE,
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
      await pasteImage(p);
      await p.getByRole('alertdialog').waitFor();
    },
  },
  'shortcut-help_embedded': {
    vp: WIDE,
    run: async (p) => {
      await pasteImage(p);
      await annotate(p);
      await p.locator('main.tk-work-area').focus();
      await p.keyboard.press('?');
      await p.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor();
    },
  },
};

async function selectTwo(p) {
  await pasteImage(p);
  const g = await annotate(p);
  await p.keyboard.press('v');
  await p.mouse.click(...g.at(448, 177)); // the rectangle's left edge
  await p.keyboard.down('Shift');
  await p.mouse.click(...g.at(300 + 5, 380 + 9));
  await p.keyboard.up('Shift');
}
async function crop(p) {
  await p.keyboard.press('c');
  await p.locator('[data-screen="SCR-Annotator"][data-state="cropping"]').waitFor();
}
async function settings(p) {
  await p.keyboard.press('v');
  await p.keyboard.press('Escape');
  const panel = p.getByRole('complementary', { name: 'Style' });
  const narrowToggle = p.locator('.tk-sheet__toggle, [aria-controls="tk-style-sheet"]').first();
  if (
    !(await panel
      .getByRole('group', { name: 'Padding' })
      .isVisible()
      .catch(() => false)) &&
    (await narrowToggle.count())
  ) {
    await narrowToggle.click().catch(() => {});
  }
  await panel.getByRole('group', { name: 'Padding' }).getByRole('radio', { name: 'Medium', exact: true }).check();
  await panel.getByRole('group', { name: 'Background' }).getByRole('radio', { name: 'White', exact: true }).check();
}

for (const [name, st] of Object.entries(states)) {
  if (only.length && !only.includes(name)) continue;
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: st.vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    if (st.init) await page.addInitScript(st.init);
    try {
      await open(page, theme, st.vp, st.vi ? 'vi' : '');
      await st.run(page);
      await settle(page);
      await page.screenshot({ path: path.join(out, `app_${name}_${theme}.png`) });
      console.log('ok', name, theme);
    } catch (e) {
      console.log('FAIL', name, theme, String(e).split('\n')[0]);
      await page.screenshot({ path: path.join(out, `app_${name}_${theme}.FAILED.png`) }).catch(() => {});
    }
    await ctx.close();
  }
}
await browser.close();
