// E2E helpers for F-012 (export): catch a download and read its bytes, record what the tool hands to the
// clipboard (and, on Chromium, read the clipboard back), make the clipboard refuse, and decode PNGs in
// Node (ADR-0019: never with the browser's decoder, which changes semi-transparent pixels on WebKit).
import fs from 'node:fs';
import { expect, type Frame, type Locator, type Page } from '@playwright/test';
import { chunkTypes, decodePng, type DecodedPng } from '../../support/png';

export { chunkTypes, decodePng, pngRegion, type DecodedPng } from '../../support/png';

export interface Downloaded {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/** Runs `trigger` (a click or key press) and returns the file the browser saved. */
export async function download(page: Page, trigger: () => Promise<unknown>): Promise<Downloaded> {
  const [file] = await Promise.all([page.waitForEvent('download'), trigger()]);
  const path = await file.path();
  return { name: file.suggestedFilename(), bytes: new Uint8Array(fs.readFileSync(path)) };
}

type CopyWindow = { __copies: string[] };

/**
 * Before the page loads: wraps `navigator.clipboard.write` so the PNG the tool hands to the clipboard is
 * recorded (base64) while the real write still runs in the gesture (ADR-0021: WebKit needs that). With
 * `refuse`, the write is rejected as a browser refusal (`NotAllowedError`).
 */
export async function recordClipboard(page: Page, opts: { refuse?: boolean } = {}): Promise<void> {
  await page.addInitScript((refuse) => {
    const w = window as unknown as CopyWindow;
    w.__copies = [];
    const clipboard = navigator.clipboard;
    if (!clipboard) return;
    const real = clipboard.write?.bind(clipboard);
    clipboard.write = (items: ClipboardItem[]) => {
      if (refuse) return Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
      const done = real ? real(items) : Promise.resolve();
      void items[0]
        ?.getType('image/png')
        .then((blob) => blob.arrayBuffer())
        .then((buf) => {
          const b = new Uint8Array(buf);
          let bin = '';
          for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
          w.__copies.push(btoa(bin));
        });
      return done;
    };
  }, !!opts.refuse);
}

/** The PNG bytes of the n-th recorded copy (waits for it). */
export async function copied(page: Page | Frame, n = 0): Promise<Uint8Array> {
  await expect
    .poll(() => page.evaluate(() => (window as unknown as CopyWindow).__copies.length), { timeout: 15_000 })
    .toBeGreaterThan(n);
  const b64 = await page.evaluate((i) => (window as unknown as CopyWindow).__copies[i] ?? '', n);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Chromium only: reads the system clipboard back and returns its image/png bytes, or null. */
export async function clipboardImage(page: Page | Frame): Promise<Uint8Array | null> {
  const b64 = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const item = items.find((i) => i.types.includes('image/png'));
    if (!item) return null;
    const b = new Uint8Array(await (await item.getType('image/png')).arrayBuffer());
    let bin = '';
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return btoa(bin);
  });
  return b64 === null ? null : Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * INV-02 / INV-03: a file the tool produced holds one picture and nothing else — IHDR, the image data
 * (one or more consecutive IDAT chunks, as encoders split large images), IEND.
 */
export function expectCleanPng(bytes: Uint8Array): DecodedPng {
  expect(chunkTypes(bytes).filter((t, i, all) => t !== 'IDAT' || all[i - 1] !== 'IDAT')).toEqual([
    'IHDR',
    'IDAT',
    'IEND',
  ]);
  return decodePng(bytes);
}

/** CMP-Toolbar export actions. */
export const toolbar = (page: Page | Frame) => page.getByRole('toolbar', { name: 'Tools and actions' });
export const copyButton = (page: Page | Frame): Locator =>
  toolbar(page).getByRole('button', { name: 'Copy', exact: true });
export const downloadButton = (page: Page | Frame): Locator =>
  toolbar(page).getByRole('button', { name: 'Download', exact: true });
export const notice = (page: Page | Frame) => page.locator('.tk-notice');

/** Largest per-channel difference between two RGBA lists. */
export const maxDiff = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  return m;
};
