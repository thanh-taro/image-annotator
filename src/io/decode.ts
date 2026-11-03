// MOD-IO — checks and decode of an input file (ADR-0005 as amended by ADR-0023; promoted from spike
// SP-decode, ADR-0018): file size → magic bytes → the header's declared size → (over RULE-02: the
// scale-down offer, before any decode) → createImageBitmap with the recorded orientation → the decoded
// size re-checked (a lying header). Nothing here touches the current session: the result is a decoded
// image, a scale-down offer, or a refusal code (MOD-App maps codes to COPY-error.*).
// Implements: F-001.R4, F-001.R5, F-001.R6; RULE-01, RULE-02, RULE-03, RULE-15 (source name);
// INV-03 (sRGB at draw time); NFR-04 (one decode, no full-size bitmap kept when scaling down).
import {
  checkLimits,
  HEADER_BYTES,
  MAX_FILE_BYTES,
  readImageHeader,
  scaleDownSize,
  sniffFormat,
  type ImageInfo,
  type SourceType,
} from '../core';
import { AVIF_PROBE } from './avif-probe';

export interface DecodedImage {
  readonly info: ImageInfo;
  readonly bitmap: ImageBitmap;
}

/** Refusal codes (F-001.R7 order: size, magic bytes, decode). */
export type Refusal = 'file_too_large' | 'unsupported_format' | 'decode_failed';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** An image over RULE-02, not decoded yet: decode it at `scaleDownOffer` with `scaleDown`. */
export interface Oversize {
  readonly file: File;
  readonly sourceName: string | null;
  readonly sourceType: SourceType;
  readonly scaleDownOffer: Size;
}

export type DecodeResult =
  | { readonly ok: true; readonly image: DecodedImage }
  | ({ readonly ok: true; readonly image?: undefined } & Oversize)
  | { readonly ok: false; readonly refused: Refusal };

/** The engine pieces decoding needs (replaced in unit tests). */
export interface DecodeEnv {
  createImageBitmap(source: ImageBitmapSource, options?: ImageBitmapOptions): Promise<ImageBitmap>;
  avifSupported(): boolean;
}

/** ADR-0005 §2: orientation from the image (RULE-03), default colour conversion and alpha. */
export const DECODE_OPTIONS: ImageBitmapOptions = {
  imageOrientation: 'from-image',
  colorSpaceConversion: 'default',
  premultiplyAlpha: 'default',
};

let avif = false;

/**
 * ADR-0005 §1: AVIF is accepted only if decoding a tiny AVIF embedded in the bundle succeeds. Run
 * once at start-up; until it settles AVIF counts as unsupported.
 */
export async function probeAvif(): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(new Blob([AVIF_PROBE]), DECODE_OPTIONS);
    avif = bitmap.width > 0;
    bitmap.close();
  } catch {
    avif = false;
  }
  return avif;
}

const browserEnv: DecodeEnv = {
  createImageBitmap: (source, options) => createImageBitmap(source, options),
  avifSupported: () => avif,
};

/** The RULE-01 format names this browser decodes, for COPY-error.unsupported_format. */
export function supportedFormatNames(env: Pick<DecodeEnv, 'avifSupported'> = browserEnv): string[] {
  return ['PNG', 'JPEG', 'WebP', 'GIF', 'BMP', ...(env.avifSupported() ? ['AVIF'] : [])];
}

/**
 * Checks and decodes one file without touching the session (F-001.R7, ADR-0023). `sourceName` is the
 * file name for picked or dropped files and null for pasted ones (RULE-15; see ./input.ts).
 */
export async function decodeInput(
  file: File,
  sourceName: string | null,
  env: DecodeEnv = browserEnv,
): Promise<DecodeResult> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, refused: 'file_too_large' };

  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const sourceType = sniffFormat(head);
  if (!sourceType || (sourceType === 'avif' && !env.avifSupported())) {
    return { ok: false, refused: 'unsupported_format' };
  }

  // ADR-0023 §2: over the limits by the header → ask before decoding anything.
  const declared = readImageHeader(head);
  if (declared && !checkLimits(declared.width, declared.height).ok) {
    return { ok: true, file, sourceName, sourceType, scaleDownOffer: scaleDownSize(declared.width, declared.height) };
  }

  let bitmap: ImageBitmap;
  try {
    // A fresh Blob without a type: the magic bytes decided, not the MIME type (ADR-0005).
    bitmap = await env.createImageBitmap(new Blob([file]), DECODE_OPTIONS);
  } catch {
    return { ok: false, refused: 'decode_failed' };
  }

  // ADR-0023 §3–4: the bitmap's real size wins over the header (or stands in for a missing one).
  const limits = checkLimits(bitmap.width, bitmap.height);
  if (!limits.ok) {
    const real = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    if (limits.reason === 'too_small') return { ok: false, refused: 'decode_failed' };
    return { ok: true, file, sourceName, sourceType, scaleDownOffer: scaleDownSize(real.width, real.height) };
  }
  return { ok: true, image: { bitmap, info: { width: bitmap.width, height: bitmap.height, sourceName, sourceType } } };
}

/**
 * RULE-02 / ADR-0023 §2: one decode at the offered size (orientation applied first, so the offer is
 * the upright size). Throws when the engine can't decode it.
 */
export async function scaleDown(image: Oversize, env: DecodeEnv = browserEnv): Promise<DecodedImage> {
  const { width, height } = image.scaleDownOffer;
  const bitmap = await env.createImageBitmap(new Blob([image.file]), {
    ...DECODE_OPTIONS,
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high',
  });
  if (!checkLimits(bitmap.width, bitmap.height).ok) {
    bitmap.close();
    throw new Error('scaled image outside RULE-02');
  }
  return {
    bitmap,
    info: { width: bitmap.width, height: bitmap.height, sourceName: image.sourceName, sourceType: image.sourceType },
  };
}

/** Frees a decoded image that will not be loaded (cancelled replace, NFR-04). */
export function discard(image: DecodedImage): void {
  image.bitmap.close();
}
