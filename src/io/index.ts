// MOD-IO — paste, drop and open; decode; export to clipboard and file; leave-page warning
// (specs/40-technical/modules/MOD-IO.md, ADR-0005, ADR-0007, ADR-0018, ADR-0019, ADR-0021, ADR-0022).
// Only this module touches the clipboard, the file input, downloads and `beforeunload` (lint-enforced).
// Input (paste, drop, pick) and decode are built (F-001: ./input.ts, ./decode.ts), and the export (F-012:
// ./export.ts), and the leave-page warning (F-014: ./leave.ts).

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
export { feedEffects, releaseEffects } from './effects';
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

export { copyResult, downloadResult, EXPORT_WAIT_MS, renderPng, REVOKE_DELAY_MS, type ExportResult } from './export';

export { setLeaveWarning } from './leave';
