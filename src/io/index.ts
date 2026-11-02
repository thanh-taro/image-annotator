// MOD-IO — paste, drop and open; decode; export to clipboard and file; leave-page warning
// (specs/40-technical/modules/MOD-IO.md, ADR-0005, ADR-0007, ADR-0018, ADR-0019, ADR-0021, ADR-0022).
// Only this module touches the clipboard, the file input, downloads and `beforeunload` (lint-enforced).
// Phase 3.3 scaffold: the surface is typed; everything throws until F-001, F-012 and F-014 are built.
import type { ImageInfo } from '../core';
import type { Scene } from '../render';

export interface DecodedImage {
  readonly info: ImageInfo;
  readonly bitmap: ImageBitmap;
}

/** Refusal codes map to COPY-error.* in MOD-App (F-001.R7 order: size, magic bytes, decode, limits). */
export type Refusal = 'file_too_large' | 'unsupported_format' | 'decode_failed' | 'too_large';

export type DecodeResult =
  | { readonly ok: true; readonly image: DecodedImage }
  | { readonly ok: false; readonly refused: Refusal; readonly scaleDownOffer?: { width: number; height: number } };

export type ExportResult =
  | { readonly ok: true; readonly fileName?: string }
  | { readonly ok: false; readonly code: 'clipboard' | 'export_failed' };

export type ImageInput = { readonly file: File; readonly via: 'paste' | 'drop' | 'pick'; readonly extraFiles: boolean };

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-IO ${name}`);
};

export function onImageInput(_handler: (input: ImageInput) => void): () => void {
  return notImplemented('onImageInput');
}
export function openPicker(): void {
  notImplemented('openPicker');
}
export function decodeInput(_file: File): Promise<DecodeResult> {
  return notImplemented('decodeInput');
}
export function scaleDown(_image: DecodedImage): Promise<DecodedImage> {
  return notImplemented('scaleDown');
}
export function copyResult(_scene: Scene, _image: DecodedImage): Promise<ExportResult> {
  return notImplemented('copyResult');
}
export function downloadResult(_scene: Scene, _image: DecodedImage, _localTime: Date): Promise<ExportResult> {
  return notImplemented('downloadResult');
}
export function setLeaveWarning(_enabled: boolean): void {
  notImplemented('setLeaveWarning');
}
