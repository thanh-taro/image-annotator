// MOD-IO — after load, the image's pixels are read once, in idle time, and transferred to MOD-Effects
// (ADR-0005 §5, MOD-IO "Responsibility"); a new image first clears the previous one, which terminates
// the effects worker so a fresh one gets the new pixels (ADR-0022, NFR-04).
// Implements: F-007.R3 (the effects need the pixels), ADR-0005 §4/§5, ADR-0022.
import { clearImage, setImage } from '../effects';
import { PALETTE_HEX } from '../render';

let generation = 0;

type IdleScope = { requestIdleCallback?: (fn: () => void, options?: { timeout: number }) => number };

/** Feeds a newly loaded image to MOD-Effects; a later call (another image) supersedes a pending one. */
export function feedEffects(bitmap: ImageBitmap): void {
  const mine = ++generation;
  clearImage();
  const run = () => {
    // A closed bitmap (replaced meanwhile) is 0 × 0.
    if (mine !== generation || bitmap.width === 0 || typeof OffscreenCanvas !== 'function') return;
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    // ADR-0005 §4: an sRGB canvas, and the pixels read as sRGB.
    const ctx = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, width, height, { colorSpace: 'srgb' }).data;
    canvas.width = 0; // frees the copy's canvas at once (NFR-04)
    canvas.height = 0;
    setImage(data.buffer as ArrayBuffer, width, height, bitmap, PALETTE_HEX);
  };
  const idle = (globalThis as IdleScope).requestIdleCallback;
  // Idle time, but never later than 200 ms after load (a blur drawn at once waits for the pixels).
  if (idle) idle(run, { timeout: 200 });
  else setTimeout(run, 0);
}
