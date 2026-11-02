// MOD-Canvas — view, pointer and touch input, tool state machine, handles, crop, text overlay
// (specs/40-technical/modules/MOD-Canvas.md, ADR-0004, ADR-0009, ADR-0016, ADR-0020, ADR-0022).
// Phase 3.3 scaffold: the surface is typed; the <Canvas> component and the commands are built with
// F-002…F-008 and F-010. The canvas is not a Preact tree: it is painted imperatively on rAF (ADR-0002).
import type { AnnotationKind } from '../core';

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Canvas ${name}`);
};

/** The interactive canvas component (CMP-Canvas, CMP-TextEditor). */
export function Canvas(): never {
  return notImplemented('Canvas');
}

export const viewCommands = {
  zoomIn: (): void => notImplemented('viewCommands.zoomIn'),
  zoomOut: (): void => notImplemented('viewCommands.zoomOut'),
  fit: (): void => notImplemented('viewCommands.fit'),
  actualSize: (): void => notImplemented('viewCommands.actualSize'),
  setBottomInset: (_px: number): void => notImplemented('viewCommands.setBottomInset'),
};

export const canvasCommands = {
  placeAtCentre: (_tool: AnnotationKind): void => notImplemented('canvasCommands.placeAtCentre'),
  nudge: (_dx: number, _dy: number): void => notImplemented('canvasCommands.nudge'),
  altResize: (_dx: number, _dy: number): void => notImplemented('canvasCommands.altResize'),
  selectNext: (): void => notImplemented('canvasCommands.selectNext'),
  selectPrevious: (): void => notImplemented('canvasCommands.selectPrevious'),
  cancelDrag: (): void => notImplemented('canvasCommands.cancelDrag'),
  beginTextEdit: (): void => notImplemented('canvasCommands.beginTextEdit'),
  endTextEdit: (): void => notImplemented('canvasCommands.endTextEdit'),
};
