// MOD-App — the app-level commands (MOD-App public surface). Phase 3.3 scaffold: each throws until
// its feature is built; the signals of ADR-0008 are added with F-008/F-009.
const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-App ${name}`);
};

export const commands = {
  load: (_file: File): void => notImplemented('load'),
  clear: (): void => notImplemented('clear'),
  undo: (): void => notImplemented('undo'),
  redo: (): void => notImplemented('redo'),
  setTool: (_tool: string): void => notImplemented('setTool'),
  setStyle: (_patch: object): void => notImplemented('setStyle'),
  setFields: (_fields: object): void => notImplemented('setFields'),
  resetFrame: (): void => notImplemented('resetFrame'),
  setPadding: (_size: string): void => notImplemented('setPadding'),
  setBackground: (_background: string): void => notImplemented('setBackground'),
  copy: (): void => notImplemented('copy'),
  download: (): void => notImplemented('download'),
  showShortcuts: (): void => notImplemented('showShortcuts'),
};
