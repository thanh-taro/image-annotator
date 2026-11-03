// MOD-IO — checks and decode of an input file, in F-001.R7's order (ADR-0005, confirmed by ADR-0018;
// promoted from spike SP-decode): file size → magic bytes → createImageBitmap with the recorded
// orientation → RULE-02 limits with the scale-down offer. Nothing here touches the current session:
// the result is a decoded image or a refusal code (MOD-App maps codes to COPY-error.*).
// Implements: F-001.R4, F-001.R5, F-001.R6; RULE-01, RULE-02, RULE-03; INV-03 (sRGB at draw time).
import { checkLimits, MAX_FILE_BYTES, scaleDownSize, sniffFormat, SNIFF_BYTES, type ImageInfo } from '../core';
import { AVIF_PROBE } from './avif-probe';

export interface DecodedImage {
  readonly info: ImageInfo;
  readonly bitmap: ImageBitmap;
}

/** Refusal codes (F-001.R7 order: size, magic bytes, decode, limits). */
export type Refusal = 'file_too_large' | 'unsupported_format' | 'decode_failed' | 'too_large';

export interface Size {
  readonly width: number;
  readonly height: number;
}

export type DecodeResult =
  | { readonly ok: true; readonly image: DecodedImage }
  | { readonly ok: false; readonly refused: Exclude<Refusal, 'too_large'> }
  /** Over RULE-02: the decoded image is kept (not closed) until the user accepts or cancels. */
  | { readonly ok: false; readonly refused: 'too_large'; readonly scaleDownOffer: Size; readonly image: DecodedImage };

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

/** Checks and decodes one file without touching the session (F-001.R7). */
export async function decodeInput(file: File, env: DecodeEnv = browserEnv): Promise<DecodeResult> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, refused: 'file_too_large' };

  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  const sourceType = sniffFormat(head);
  if (!sourceType || (sourceType === 'avif' && !env.avifSupported())) {
    return { ok: false, refused: 'unsupported_format' };
  }

  let bitmap: ImageBitmap;
  try {
    // A fresh Blob without a type: the magic bytes decided, not the MIME type (ADR-0005).
    bitmap = await env.createImageBitmap(new Blob([file]), DECODE_OPTIONS);
  } catch {
    return { ok: false, refused: 'decode_failed' };
  }

  const limits = checkLimits(bitmap.width, bitmap.height);
  if (!limits.ok && limits.reason === 'too_small') {
    bitmap.close();
    return { ok: false, refused: 'decode_failed' };
  }
  // RULE-15: the source name is recorded for picked or dropped files; pasted ones come in as "image.png"
  // from the clipboard, and MOD-App passes `sourceName: null` for them (see `withoutSourceName`).
  const image: DecodedImage = {
    bitmap,
    info: { width: bitmap.width, height: bitmap.height, sourceName: file.name || null, sourceType },
  };
  if (!limits.ok)
    return { ok: false, refused: 'too_large', scaleDownOffer: scaleDownSize(bitmap.width, bitmap.height), image };
  return { ok: true, image };
}

/** RULE-02 / ADR-0005 §3: the image resized to the offered size; the original bitmap is closed (NFR-04). */
export async function scaleDown(image: DecodedImage, size: Size, env: DecodeEnv = browserEnv): Promise<DecodedImage> {
  try {
    const bitmap = await env.createImageBitmap(image.bitmap, {
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: 'high',
    });
    return { bitmap, info: { ...image.info, width: bitmap.width, height: bitmap.height } };
  } finally {
    image.bitmap.close();
  }
}

/** Frees a decoded image that will not be loaded (cancelled scale-down or replace, NFR-04). */
export function discard(image: DecodedImage): void {
  image.bitmap.close();
}

/** RULE-15: a pasted image has no source name. */
export function withoutSourceName(image: DecodedImage): DecodedImage {
  return { ...image, info: { ...image.info, sourceName: null } };
}
