// MOD-IO — the export pipeline of ADR-0007 (hardened by ADR-0019; clipboard and frame findings ADR-0021;
// export memory ADR-0022): await every exact blur/pixelate patch (MOD-Effects `exactPatches`; never the
// on-screen approximation) and the tool's typeface → an sRGB export canvas exactly the size of the canvas
// (frame plus padding, RULE-14/15) → MOD-Render `paint()` — the same function as the screen — at scale 1
// with the canvas's top-left corner at the origin, so every image pixel is one export pixel on whole pixels
// → `toBlob('image/png')` → the export canvas is freed → the chunk whitelist (MOD-Core `stripPngChunks`,
// checked against the canvas size). Any failure on the way, or effects and fonts not ready within
// EXPORT_WAIT_MS, is `export_failed` (F-012.R7): there is no fallback. Copy creates the `ClipboardItem` with a *promised* blob in the gesture's task (WebKit requires
// it); download hands an `<a download>` with an object URL to the browser and revokes it afterwards.
// Nothing here makes a network request (NFR-01). Only this module touches the clipboard and downloads.
// Implements: F-012.R1/R2/R3/R5/R6/R7, RULE-15, INV-02, INV-03, NFR-01, NFR-08, ADR-0007, ADR-0019,
// ADR-0021, ADR-0022 ("Export memory").
import { canvasRect, downloadName, isStepAnnotation, isTextAnnotation, stripPngChunks, TEXT_WEIGHT } from '../core';
import { exactPatches, type HeldPatches } from '../effects';
import { paint, type Scene } from '../render';
import type { DecodedImage } from './decode';

export type ExportResult =
  | { readonly ok: true; readonly fileName?: string }
  | { readonly ok: false; readonly code: 'clipboard' | 'export_failed' };

/** An export that could not be produced (F-012.R7). */
class ExportFailed extends Error {}

/** The object URL of a download is revoked this long after the click handed it to the browser. */
export const REVOKE_DELAY_MS = 2000;

const isWhole = (n: number) => Number.isInteger(n);

/**
 * ADR-0009 §4 / ADR-0007 §1: the tool's face must be loaded for every text and step in the scene, so no
 * glyph is exported in a fallback face (NFR-08). The faces were requested at startup (MOD-Host), so this
 * makes no request (NFR-01); a face that is still not available fails the export.
 */
async function assertFonts(scene: Scene): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  let sample = '';
  for (const a of scene.annotations) {
    if (isTextAnnotation(a)) sample += a.text;
    else if (isStepAnnotation(a)) sample += String(a.number);
  }
  if (!sample) return;
  const face = `${TEXT_WEIGHT} 16px Manrope`;
  await document.fonts.ready;
  if (!document.fonts.check(face, sample)) await document.fonts.load(face, sample);
  if (!document.fonts.check(face, sample)) throw new ExportFailed('typeface not loaded');
}

/**
 * F-012.R7: an export whose redaction effects and fonts are not ready within this time counts as not
 * produced. Only that wait is bounded (a stuck worker, pixels that never arrive); encoding cannot be
 * cancelled and is not.
 */
export const EXPORT_WAIT_MS = 10_000;

/**
 * The exact patches and the typeface, or ExportFailed after EXPORT_WAIT_MS (F-012.R7). On any failure
 * the patches are released; on success the caller releases them after painting.
 */
async function ready(scene: Scene): Promise<HeldPatches> {
  const stop = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      stop.abort();
      reject(new ExportFailed('effects or fonts not ready in time'));
    }, EXPORT_WAIT_MS);
  });
  // ADR-0006 / F-007 security review: exact patches only; a failed job fails the export.
  const patches = exactPatches(scene, stop.signal).catch(() => {
    throw new ExportFailed('effects failed');
  });
  try {
    const [held] = await Promise.race([Promise.all([patches, assertFonts(scene)]), timeout]);
    return held;
  } catch (e) {
    stop.abort(); // a still-pending wait rejects and lets its patches go
    void patches.then(
      (held) => held.release(),
      () => {},
    ); // fonts failed after the patches resolved
    throw e instanceof ExportFailed ? e : new ExportFailed('fonts failed');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The stripped PNG of the canvas (ADR-0007 §1–3). Rejects with ExportFailed on any failure; the export
 * canvas is freed whatever happens (ADR-0022).
 */
export async function renderPng(scene: Scene, image: DecodedImage): Promise<Uint8Array<ArrayBuffer>> {
  const area = canvasRect(scene.frame, scene.padding.size);
  // RULE-13/14: the frame and the padding are whole image pixels, so the export is 1:1 on whole pixels.
  if (![area.x, area.y, area.width, area.height].every(isWhole) || area.width < 1 || area.height < 1)
    throw new ExportFailed('canvas not on whole pixels');
  if (image.bitmap.width === 0) throw new ExportFailed('image closed');
  const held = await ready(scene);
  const canvas = document.createElement('canvas');
  try {
    // F-012 security m2: the image was replaced or cleared while waiting: nothing is painted.
    if (image.bitmap.width === 0) throw new ExportFailed('image closed');
    canvas.width = area.width;
    canvas.height = area.height;
    // ADR-0005 §4 / INV-03: an sRGB canvas, so the untagged PNG means sRGB.
    const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
    if (!ctx || canvas.width !== area.width || canvas.height !== area.height) throw new ExportFailed('no canvas');
    // INV-05: no view, theme or language reaches paint(); no overlays, no layer (RULE-15); the image
    // without smoothing (security m4). The held patches stay open until painted (security m1).
    try {
      paint(ctx, scene, image.bitmap, { scale: 1, dx: -area.x, dy: -area.y }, held.patches, undefined, undefined, true);
    } finally {
      held.release();
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new ExportFailed('encoder returned nothing');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const stripped = stripPngChunks(bytes, { width: area.width, height: area.height });
    if (!stripped.ok) throw new ExportFailed(stripped.error);
    return stripped.bytes;
  } catch (e) {
    held.release();
    throw e instanceof ExportFailed ? e : new ExportFailed('render failed');
  } finally {
    // ADR-0022: the export canvas is freed right after encoding, whether it succeeded or not.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * F-012.R1 / ADR-0007 §4: copies the result as a PNG. Call it synchronously in the click or keydown task:
 * the `ClipboardItem` is created at once with the promised image. A missing clipboard, a missing
 * `ClipboardItem` or a refusal (`NotAllowedError`, ADR-0021) is `clipboard` (F-012.R5); an image that could
 * not be produced is `export_failed` (F-012.R7). Success = the clipboard accepted the image (RULE-15).
 */
export function copyResult(scene: Scene, image: DecodedImage): Promise<ExportResult> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (typeof ClipboardItem !== 'function' || typeof clipboard?.write !== 'function')
    return Promise.resolve({ ok: false, code: 'clipboard' });
  const png = renderPng(scene, image);
  // The outcome of producing the image, read after a refusal (never an unhandled rejection).
  const produced = png.then(
    () => true,
    () => false,
  );
  let write: Promise<void>;
  try {
    const item = new ClipboardItem({ 'image/png': png.then((bytes) => new Blob([bytes], { type: 'image/png' })) });
    write = clipboard.write([item]);
  } catch {
    write = Promise.reject(new Error('clipboard item refused'));
  }
  return write.then(
    async (): Promise<ExportResult> => ((await produced) ? { ok: true } : { ok: false, code: 'export_failed' }),
    async (): Promise<ExportResult> => ({ ok: false, code: (await produced) ? 'clipboard' : 'export_failed' }),
  );
}

/**
 * F-012.R2 / ADR-0007 §5: downloads the result as `downloadName(...)` (RULE-15). Success = the file was
 * handed to the browser (an embedding frame without `allow-downloads` blocks it silently, RULE-16).
 */
export async function downloadResult(scene: Scene, image: DecodedImage, localTime: Date): Promise<ExportResult> {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await renderPng(scene, image);
  } catch {
    return { ok: false, code: 'export_failed' };
  }
  const fileName = downloadName(image.info.sourceName, localTime);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, code: 'export_failed' };
  }
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  return { ok: true, fileName };
}
