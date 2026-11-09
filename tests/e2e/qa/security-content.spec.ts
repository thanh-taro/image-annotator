// QA security (phase 5) — what goes into and out of the tool, on the production build (default config):
// - INV-03 / NFR-08: a PNG with iCCP, eXIf (GPS), iTXt XMP, tEXt, zTXt and tIME, and a JPEG with Exif GPS,
//   XMP, an ICC profile and a comment, export (download and copy) with none of it;
// - INV-02 / RULE-10: a solid redaction replaces every pixel of its box in the export, with no bleed;
//   blur and pixelate carry the not-secure label;
// - RULE-15 and injection: hostile file names and text stay text; an SVG is refused.
import zlib from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import {
  clipboardImage,
  copied,
  copyButton,
  download,
  downloadButton,
  expectCleanPng,
  notice,
  pngRegion,
  recordClipboard,
  toolbar,
} from '../support/export';
import { drop, fixture, paste, summary, type FileSpec } from '../support/load';

test.use({ deviceScaleFactor: 1 });

const VIEWPORT = { width: 1472, height: 868 };
const MARKERS = ['QAGPSMARK', 'QAXMPMARK', 'QAICCMARK', 'QATEXTMARK', 'QACOMMENTMARK', 'QAZTXTMARK'];

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

const latin1 = (s: string) => Uint8Array.from(ascii(s));

function indexOf(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

const u32 = (b: Uint8Array, o: number) =>
  (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>> 0;

/** True when `needle` occurs in `bytes` (ASCII), also inside any zlib stream in a non-IDAT PNG chunk. */
function contains(bytes: Uint8Array, needle: string): boolean {
  const n = latin1(needle);
  if (indexOf(bytes, n) >= 0) return true;
  // Compressed metadata (zTXt, iCCP, compressed iTXt) would hide a marker: inflate every non-IDAT chunk.
  if (bytes[0] !== 0x89) return false;
  for (let o = 8; o + 12 <= bytes.length;) {
    const len = u32(bytes, o);
    const type = String.fromCharCode(...bytes.subarray(o + 4, o + 8));
    if (type !== 'IDAT') {
      const data = bytes.subarray(o + 8, o + 8 + len);
      for (let i = 0; i < data.length; i++) {
        if (data[i] !== 0x78) continue; // zlib header
        try {
          if (indexOf(zlib.inflateSync(data.subarray(i)), n) >= 0) return true;
        } catch {
          /* not a stream here */
        }
      }
    }
    o += 12 + len;
  }
  return false;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: readonly number[]) => {
  let c = 0xffffffff;
  for (const v of b) c = (CRC_TABLE[(c ^ v) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function pngChunk(type: string, data: number[]): number[] {
  const body = [...ascii(type), ...data];
  return [...be32(data.length), ...body, ...be32(crc32(body))];
}

/** A TIFF/Exif block with a GPS IFD whose latitude ref carries QAGPSMARK (big-endian, as eXIf allows). */
function exifTiff(): number[] {
  const be16 = (n: number) => [(n >> 8) & 255, n & 255];
  const mark = [...ascii('QAGPSMARK'), 0]; // 10 bytes
  const entry = (tag: number, type: number, count: number, value: number[]) => [
    ...be16(tag),
    ...be16(type),
    ...be32(count),
    ...value,
  ];
  // header 8 · IFD0 (2 + 1 × 12 + 4 = 18) at 8 · GPS IFD (2 + 1 × 12 + 4 = 18) at 26 · marker at 44
  return [
    ...ascii('MM'),
    ...be16(42),
    ...be32(8),
    ...be16(1),
    ...entry(0x8825, 4, 1, be32(26)),
    ...be32(0),
    ...be16(1),
    ...entry(0x001b, 7, mark.length, be32(44)), // GPSProcessingMethod (undefined bytes)
    ...be32(0),
    ...mark,
  ];
}

const XMP = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="10,46.5N" exif:UserComment="QAXMPMARK"/></rdf:RDF></x:xmpmeta>`;
/** Not a valid profile on purpose: decoders ignore it, which is all the export may do with it. */
const ICC = [...be32(160), ...ascii('QAICCMARK'), ...new Array(147).fill(0)];

/** fmt.png (240 × 160) with every kind of PNG metadata inserted after IHDR. */
function pngWithMetadata(): FileSpec {
  const src = fixture('fmt.png', 'image/png').bytes;
  const ihdrEnd = 8 + 12 + 13;
  const extra = [
    ...pngChunk('iCCP', [...ascii('QA profile'), 0, 0, ...zlib.deflateSync(Uint8Array.from(ICC))]),
    ...pngChunk('eXIf', exifTiff()),
    ...pngChunk('iTXt', [...ascii('XML:com.adobe.xmp'), 0, 0, 0, 0, 0, ...ascii(XMP)]),
    ...pngChunk('tEXt', [...ascii('Author'), 0, ...ascii('QATEXTMARK Jane Doe')]),
    ...pngChunk('zTXt', [...ascii('Comment'), 0, 0, ...zlib.deflateSync(latin1('QAZTXTMARK secret'))]),
    ...pngChunk('tIME', [0x07, 0xea, 10, 27, 14, 5, 9]),
  ];
  return { name: 'trip.png', type: 'image/png', bytes: [...src.slice(0, ihdrEnd), ...extra, ...src.slice(ihdrEnd)] };
}

/** orient-1.jpg (240 × 160) with APP1 Exif (GPS), APP1 XMP, APP2 ICC_PROFILE and a COM segment. */
function jpegWithMetadata(): FileSpec {
  const seg = (marker: number, data: number[]) => [
    0xff,
    marker,
    ((data.length + 2) >> 8) & 255,
    (data.length + 2) & 255,
    ...data,
  ];
  const src = fixture('orient-1.jpg', 'image/jpeg').bytes;
  const extra = [
    ...seg(0xe1, [...ascii('Exif'), 0, 0, ...exifTiff()]),
    ...seg(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, ...ascii(XMP)]),
    ...seg(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, ...ICC]),
    ...seg(0xfe, ascii('QACOMMENTMARK shot at home')),
  ];
  return { name: 'trip.jpg', type: 'image/jpeg', bytes: [0xff, 0xd8, ...extra, ...src.slice(2)] };
}

const sizeText = (w: number, h: number, n: number) =>
  `${w.toLocaleString('en-US')} × ${h.toLocaleString('en-US')} px canvas, ${n} annotation${n === 1 ? '' : 's'}`;
const workArea = (page: Page) => page.locator('main.tk-work-area');
const kinds = (page: Page) =>
  page.getByRole('complementary', { name: 'Style' }).getByRole('group', { name: 'Redaction type' });

/** Where image pixel (0, 0) is on the page for a w × h image shown centred at 100 %. */
async function imageOrigin(page: Page, w: number, h: number) {
  await expect(page.locator('.tk-zoom__level')).toHaveText('100 %');
  const box = await workArea(page).boundingBox();
  if (!box) throw new Error('no work area');
  return { x: Math.round(box.x + (box.width - w) / 2), y: Math.round(box.y + (box.height - h) / 2) };
}

async function dragPixels(page: Page, size: [number, number], from: [number, number], to: [number, number]) {
  const o = await imageOrigin(page, ...size);
  await page.mouse.move(o.x + from[0], o.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(o.x + (from[0] + to[0]) / 2, o.y + (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(o.x + to[0], o.y + to[1], { steps: 4 });
  await page.mouse.up();
}

/** The selected annotation's x, y, width, height from its position and size fields. */
const geometry = (page: Page) =>
  page
    .locator('.tk-geometry__input')
    .evaluateAll((els) => els.slice(0, 4).map((e) => Number((e as HTMLInputElement).value)));

/** Seeded noise, the same in Node and in the page: every pixel differs from its neighbours. */
function noise(width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  let s = 7;
  for (let i = 0; i < out.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = s & 255;
    out[i + 1] = (s >>> 8) & 255;
    out[i + 2] = (s >>> 16) & 255;
    out[i + 3] = 255;
  }
  return out;
}

async function pasteNoise(page: Page, width: number, height: number) {
  await page.evaluate(
    async ({ width, height }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d', { colorSpace: 'srgb' });
      if (!ctx) throw new Error('no 2d context');
      const img = ctx.createImageData(width, height);
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
      dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 's.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { width, height },
  );
}

test.describe('QA security: content', () => {
  test.beforeEach(async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await recordClipboard(page);
    await page.setViewportSize(VIEWPORT);
  });

  for (const make of [pngWithMetadata, jpegWithMetadata]) {
    test(`INV-03 NFR-08 F-012.AC4 ${make().name} with GPS, XMP, ICC and text metadata exports with none of it (download and copy)`, async ({
      page,
      browserName,
    }) => {
      const file = make();
      // The source really carries every marker it should (guards the fixture builder).
      const src = Uint8Array.from(file.bytes);
      for (const m of MARKERS.filter((m) => (file.type === 'image/png' ? m !== 'QACOMMENTMARK' : !/TEXT|ZTXT/.test(m))))
        expect(contains(src, m), `source has ${m}`).toBe(true);

      await page.goto('/?lang=en-US');
      await drop(page, [file]);
      await expect(summary(page)).toHaveText(sizeText(240, 160, 0));

      const saved = await download(page, () => downloadButton(page).click());
      expect(saved.name).toBe(file.name.replace(/\.\w+$/, '-annotated.png'));
      await copyButton(page).click();
      await expect(notice(page)).toContainText('Copied');
      const outputs: [string, Uint8Array][] = [
        ['download', saved.bytes],
        ['copy', await copied(page)],
      ];
      if (browserName === 'chromium') {
        const back = await clipboardImage(page); // what another app would paste
        expect(back).not.toBeNull();
        outputs.push(['system clipboard', back!]);
      }
      for (const [what, bytes] of outputs) {
        if (what !== 'system clipboard') expectCleanPng(bytes);
        for (const m of [...MARKERS, 'Exif', 'xmpmeta', 'ICC_PROFILE', 'Author', 'GPS'])
          expect(contains(bytes, m), `${what}: ${m}`).toBe(false);
      }
    });
  }

  test('INV-02 RULE-10 F-007.R2 a solid redaction replaces every pixel of its box in the export, with no bleed; blur and pixelate are labelled not secure', async ({
    page,
  }) => {
    const [W, H] = [400, 300];
    await page.goto('/?lang=en-US');
    await pasteNoise(page, W, H);
    await expect(summary(page)).toHaveText(sizeText(W, H, 0));
    await toolbar(page).getByRole('radio', { name: 'Redact (X)' }).click();

    // RULE-10: the honest labels.
    await expect(kinds(page).getByRole('radio', { name: /^Solid \(secure\)/ })).toBeVisible();
    for (const kind of [/^Blur/, /^Pixelate/]) {
      const label = kinds(page).locator('label', { has: page.getByRole('radio', { name: kind }) });
      await expect(label).toContainText('Not secure');
    }

    await kinds(page)
      .getByRole('radio', { name: /^Solid \(secure\)/ })
      .check();
    await dragPixels(page, [W, H], [60.4, 50.6], [201.7, 140.2]); // fractional: the box grows to whole pixels
    const [sx, sy, sw, sh] = await geometry(page);
    // A blur that overlaps the solid's right half, drawn after it: the solid must still win (INV-02).
    await workArea(page).focus();
    await page.keyboard.press('Escape');
    await kinds(page).getByRole('radio', { name: /^Blur/ }).check();
    await dragPixels(page, [W, H], [150, 80], [300, 220]);
    await expect(summary(page)).toHaveText(sizeText(W, H, 2));

    const png = expectCleanPng((await download(page, () => downloadButton(page).click())).bytes);
    expect([png.width, png.height]).toEqual([W, H]);
    const src = noise(W, H);
    const black = (x: number, y: number) => {
      const i = (y * W + x) * 4;
      return png.data[i] === 0 && png.data[i + 1] === 0 && png.data[i + 2] === 0 && png.data[i + 3] === 255;
    };
    // The solid's extent in the export (seeded noise is never exactly opaque black), grown outward to whole
    // pixels from the fractional drag: it covers the rounded fields and exceeds them by at most a pixel.
    const cx = Math.round(sx! + 10);
    const cy = Math.round(sy! + 10);
    let [x0, x1, y0, y1] = [cx, cx, cy, cy];
    while (x0 > 0 && black(x0 - 1, cy)) x0--;
    while (x1 < W && black(x1, cy)) x1++;
    while (y0 > 0 && black(cx, y0 - 1)) y0--;
    while (y1 < H && black(cx, y1)) y1++;
    expect(x0).toBeLessThanOrEqual(sx!);
    expect(y0).toBeLessThanOrEqual(sy!);
    expect(x1).toBeGreaterThanOrEqual(sx! + sw!);
    expect(y1).toBeGreaterThanOrEqual(sy! + sh!);
    expect(sx! - x0).toBeLessThanOrEqual(1);
    expect(sy! - y0).toBeLessThanOrEqual(1);
    let inside = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        expect(black(x, y), `solid pixel ${x},${y}`).toBe(true);
        inside++;
      }
    expect(inside).toBeGreaterThan(100 * 80);
    // The ring just outside the solid, left and top (away from the blur), is the untouched source: no
    // antialiased edge, nothing under the solid leaks into its neighbours.
    for (let y = y0 - 1; y <= y1; y++)
      for (const x of [x0 - 1]) {
        const i = (y * W + x) * 4;
        expect(Array.from(png.data.slice(i, i + 4)), `left ring ${x},${y}`).toEqual(Array.from(src.slice(i, i + 4)));
      }
    for (let x = x0 - 1; x < 150 - 30; x++) {
      const i = ((y0 - 1) * W + x) * 4;
      expect(Array.from(png.data.slice(i, i + 4)), `top ring ${x},${y0 - 1}`).toEqual(Array.from(src.slice(i, i + 4)));
    }
    // The blur really changed its area outside the solid (it is not a no-op).
    const blurred = pngRegion(png, 260, 180, 8, 1);
    expect(blurred).not.toEqual(Array.from(src.slice((180 * W + 260) * 4, (180 * W + 268) * 4)));
  });

  test('RULE-15 injection: a hostile file name and hostile text stay text; the saved name has no controls or path', async ({
    page,
  }) => {
    await page.goto('/?lang=en-US');
    const hostile = '..‮<img src=x onerror="window.__qa=1">\u0007gnp.exe.png';
    await drop(page, [{ ...fixture('fmt.png', 'image/png'), name: hostile }]);
    await expect(summary(page)).toHaveText(sizeText(240, 160, 0));
    const saved = await download(page, () => downloadButton(page).click());
    expect(saved.name).not.toMatch(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩/\\]/);
    expect(saved.name.endsWith('-annotated.png')).toBe(true);
    expect(saved.name.startsWith('.')).toBe(false);
    // The notice names the file as text: no element was created from it.
    await expect(notice(page)).toContainText('-annotated.png');
    expect(await notice(page).locator('img').count()).toBe(0);

    // Text annotation with markup: drawn on the canvas and listed as text, never parsed.
    await toolbar(page).getByRole('radio', { name: 'Text (T)' }).click();
    const o = await imageOrigin(page, 240, 160);
    await page.mouse.click(o.x + 30, o.y + 40);
    await expect(page.getByRole('textbox', { name: 'Text' })).toBeFocused();
    await page.keyboard.insertText('<img src=x onerror="window.__qa=2"><script>window.__qa=3</script>');
    await page.keyboard.press('Escape');
    await expect(summary(page)).toHaveText(sizeText(240, 160, 1));
    expect(await page.evaluate(() => (window as unknown as { __qa?: number }).__qa)).toBeUndefined();
    expect(await page.locator('[data-screen="SCR-Annotator"] img').count()).toBe(0);
    expect(await page.locator('[data-screen="SCR-Annotator"] script').count()).toBe(0);
  });

  test('RULE-01 an SVG with script and an external image is refused, and nothing is fetched', async ({ page }) => {
    await page.goto('/?lang=en-US');
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>parent.__qa=4</script><image href="https://example.com/qa.png" width="10" height="10"/></svg>`;
    await paste(page, [{ name: 'x.svg', type: 'image/svg+xml', bytes: ascii(svg) }]);
    await expect(notice(page)).toHaveAttribute('data-copy-id', 'error.unsupported_format');
    await expect(page.locator('canvas.tk-canvas')).toHaveCount(0); // nothing loaded
    expect(await page.evaluate(() => (window as unknown as { __qa?: number }).__qa)).toBeUndefined();
    // Only the tool's own files (the offline worker registers after load); never the SVG's image.
    const own = new URL(page.url()).origin;
    const fetched = requests.filter((u) => !u.startsWith('blob:') && !u.startsWith('data:'));
    for (const u of fetched) expect(u).toMatch(new RegExp(`^${own}/(sw\\.js|assets/[\\w.-]+)$`));
  });
});
