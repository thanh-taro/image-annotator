// MOD-Core — RULE-02 size limits and the scale-down size.
// Implements: RULE-02. "50 MB" = 50,000,000 bytes (architecture.md assumption A1).

/** A file larger than this is refused before any read (RULE-02, A1). */
export const MAX_FILE_BYTES = 50_000_000;
/** Most pixels an image or a canvas may have (4096 × 4096, RULE-02). */
export const MAX_PIXELS = 16_777_216;
/** Longest side an image or a canvas may have (RULE-02). */
export const MAX_SIDE = 16_384;
/** Smallest side; anything smaller is treated as undecodable (RULE-02). */
export const MIN_SIDE = 1;

export type LimitCheck = { readonly ok: true } | { readonly ok: false; readonly reason: 'too_small' | 'too_large' };

/** Is a `width × height` image or canvas within RULE-02's limits? */
export function checkLimits(width: number, height: number): LimitCheck {
  if (!(width >= MIN_SIDE && height >= MIN_SIDE)) return { ok: false, reason: 'too_small' };
  if (width * height > MAX_PIXELS || Math.max(width, height) > MAX_SIDE) return { ok: false, reason: 'too_large' };
  return { ok: true };
}

/**
 * The largest size within both RULE-02 limits with the same aspect ratio, each side rounded down
 * (never below 1 pixel). Returns the size unchanged when it is already within the limits.
 */
export function scaleDownSize(width: number, height: number): { width: number; height: number } {
  if (checkLimits(width, height).ok) return { width, height };
  const long = Math.max(width, height);
  let k = Math.min(1, MAX_SIDE / long, Math.sqrt(MAX_PIXELS / (width * height)));
  const at = (f: number) => ({
    width: Math.max(MIN_SIDE, Math.floor(width * f)),
    height: Math.max(MIN_SIDE, Math.floor(height * f)),
  });
  let size = at(k);
  // Floating-point rounding may leave the product a hair over the limit: step the longer side down
  // one pixel at a time until it fits.
  while (!checkLimits(size.width, size.height).ok) {
    k = (Math.floor(long * k) - 1) / long;
    size = at(k);
  }
  return size;
}
