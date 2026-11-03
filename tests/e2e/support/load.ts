// E2E helpers for F-001: synthetic paste and drop events carrying real fixture files (a page cannot
// write image files to the system clipboard or start an OS drag in headless engines, so the events the
// browser would fire are dispatched with the same DataTransfer contents).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

const FIXTURES = fileURLToPath(new URL('../../fixtures/', import.meta.url));

export interface FileSpec {
  readonly name: string;
  readonly type: string;
  readonly bytes: number[];
}

/** A committed fixture (tests/fixtures/make-fixtures.sh). */
export function fixture(name: string, type: string): FileSpec {
  return { name, type, bytes: Array.from(fs.readFileSync(path.join(FIXTURES, name))) };
}

/** The path of a committed fixture (for the file chooser). */
export const fixturePath = (name: string) => path.join(FIXTURES, name);

/** Bytes made in the page (e.g. a 60 MB file); `fill` repeats a short prefix. */
export interface BigSpec {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly prefix: number[];
}

type AnySpec = FileSpec | BigSpec;

/** Dispatches a `paste` event at the focused element with these files and string items. */
export async function paste(page: Page, files: AnySpec[], strings: Record<string, string> = {}): Promise<void> {
  await page.evaluate(
    ({ files, strings }) => {
      const dt = new DataTransfer();
      for (const f of files) {
        const bytes =
          'bytes' in f
            ? new Uint8Array(f.bytes)
            : (() => {
                const b = new Uint8Array(f.size);
                b.set(f.prefix);
                return b;
              })();
        dt.items.add(new File([bytes], f.name, { type: f.type }));
      }
      for (const [type, value] of Object.entries(strings)) dt.items.add(value, type);
      const target = document.activeElement ?? document.body;
      target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    { files, strings },
  );
}

/** Starts a file drag over the work area (dragenter + dragover); returns a handle to drop or leave. */
export async function dragOver(page: Page, files: AnySpec[]) {
  const dt = await page.evaluateHandle((files) => {
    const dt = new DataTransfer();
    for (const f of files) {
      const bytes =
        'bytes' in f
          ? new Uint8Array(f.bytes)
          : (() => {
              const b = new Uint8Array(f.size);
              b.set(f.prefix);
              return b;
            })();
      dt.items.add(new File([bytes], f.name, { type: f.type }));
    }
    return dt;
  }, files);
  await page.dispatchEvent('main', 'dragenter', { dataTransfer: dt });
  await page.dispatchEvent('main', 'dragover', { dataTransfer: dt });
  return {
    drop: () => page.dispatchEvent('main', 'drop', { dataTransfer: dt }),
    leave: () => page.dispatchEvent('main', 'dragleave', { dataTransfer: dt }),
  };
}

/** Drags these files over the tool and drops them. */
export async function drop(page: Page, files: AnySpec[]): Promise<void> {
  const drag = await dragOver(page, files);
  await drag.drop();
}

/** The loaded image's size from the canvas summary (CMP-Canvas, COPY-a11y.canvas_summary). */
export const summary = (page: Page) => page.locator('#tk-canvas-summary');

/** Waits until an image of this size is shown. */
export async function expectLoaded(page: Page, width: number, height: number): Promise<void> {
  const w = width.toLocaleString('en-US');
  const h = height.toLocaleString('en-US');
  await expect(summary(page)).toHaveText(`${w} × ${h} px canvas, 0 annotations`);
  await expect(page.locator('canvas.tk-canvas')).toBeVisible();
}

/** The notice's text (CMP-Notice). */
export const noticeText = (page: Page) => page.locator('.tk-notice__text');

/** RGBA of the display canvas at a point given in CSS pixels from its top-left corner. */
export async function canvasPixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.locator('canvas.tk-canvas').evaluate(
    (el, { x, y }) => {
      const c = el as HTMLCanvasElement;
      const k = c.width / c.getBoundingClientRect().width;
      const ctx = c.getContext('2d', { colorSpace: 'srgb' });
      return Array.from(ctx?.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data ?? []);
    },
    { x, y },
  );
}

/** The display canvas size in CSS pixels. */
export async function canvasBox(page: Page): Promise<{ width: number; height: number }> {
  const box = await page.locator('canvas.tk-canvas').boundingBox();
  return { width: box?.width ?? 0, height: box?.height ?? 0 };
}
