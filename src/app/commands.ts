// MOD-App — the app-level commands (MOD-App public surface). Phase 3.3 scaffold: each throws until
// its feature is built; the signals of ADR-0008 are added with F-008/F-009. `copy` and `download` are
// built (F-012, ./exporter.ts); `undo` and `redo` by F-009 (./history.ts).
import { copyNow, downloadNow } from './exporter';
import { redo, undo } from './history';

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-App ${name}`);
};

export const commands = {
  load: (_file: File): void => notImplemented('load'),
  clear: (): void => notImplemented('clear'),
  undo,
  redo,
  setTool: (_tool: string): void => notImplemented('setTool'),
  setStyle: (_patch: object): void => notImplemented('setStyle'),
  setFields: (_fields: object): void => notImplemented('setFields'),
  resetFrame: (): void => notImplemented('resetFrame'),
  setPadding: (_size: string): void => notImplemented('setPadding'),
  setBackground: (_background: string): void => notImplemented('setBackground'),
  copy: copyNow,
  download: downloadNow,
  showShortcuts: (): void => notImplemented('showShortcuts'),
};
