// MOD-IO — paste, drop and open; decode; export to clipboard and file; leave-page warning
// (specs/40-technical/modules/MOD-IO.md, ADR-0005, ADR-0007, ADR-0018, ADR-0019, ADR-0021, ADR-0022).
// Only this module touches the clipboard, the file input, downloads and `beforeunload` (lint-enforced).
// Input (paste, drop, pick) and decode are built (F-001: ./input.ts, ./decode.ts); export and the
// leave-page warning throw until F-012 and F-014 are built.
import type { Scene } from '../render';
import type { DecodedImage } from './decode';

export {
  decodeInput,
  discard,
  probeAvif,
  scaleDown,
  supportedFormatNames,
  type DecodedImage,
  type DecodeResult,
  type Oversize,
  type Refusal,
  type Size,
} from './decode';
export { feedEffects } from './effects';
export {
  droppedFiles,
  isEditing,
  onImageInput,
  openPicker,
  type ImageInput,
  type InputFile,
  type InputHandlers,
  type InputVia,
} from './input';

export type ExportResult =
  | { readonly ok: true; readonly fileName?: string }
  | { readonly ok: false; readonly code: 'clipboard' | 'export_failed' };

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-IO ${name}`);
};

export function copyResult(_scene: Scene, _image: DecodedImage): Promise<ExportResult> {
  return notImplemented('copyResult');
}
export function downloadResult(_scene: Scene, _image: DecodedImage, _localTime: Date): Promise<ExportResult> {
  return notImplemented('downloadResult');
}
export function setLeaveWarning(_enabled: boolean): void {
  notImplemented('setLeaveWarning');
}
