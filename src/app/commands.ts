// MOD-App — the app-level commands (MOD-App public surface). Phase 3.3 scaffold: each throws until
// its feature is built; the signals of ADR-0008 are added with F-008/F-009. `copy` and `download` are
// built (F-012, ./exporter.ts); `undo` and `redo` by F-009 (./history.ts); `resetFrame` by F-010 (./crop.ts);
// `setPadding` and `setBackground` by F-011 (./padding.ts); `showShortcuts` by F-013 (./shortcuts.ts);
// `clear` by F-014 (./clear.ts).
import { clearImage } from './clear';
import { copyNow, downloadNow } from './exporter';
import { resetFrame } from './crop';
import { setBackground, setPadding } from './padding';
import { redo, undo } from './history';
import { showShortcuts } from './shortcuts';

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-App ${name}`);
};

export const commands = {
  load: (_file: File): void => notImplemented('load'),
  clear: (): void => void clearImage(),
  undo,
  redo,
  setTool: (_tool: string): void => notImplemented('setTool'),
  setStyle: (_patch: object): void => notImplemented('setStyle'),
  setFields: (_fields: object): void => notImplemented('setFields'),
  resetFrame,
  setPadding,
  setBackground,
  copy: copyNow,
  download: downloadNow,
  showShortcuts,
};
