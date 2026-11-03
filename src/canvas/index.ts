// MOD-Canvas — view, pointer and touch input, tool state machine, handles, crop, text overlay
// (specs/40-technical/modules/MOD-Canvas.md, ADR-0004, ADR-0009, ADR-0016, ADR-0020, ADR-0022).
// <Canvas> shows the loaded image fitted (F-001, ./Canvas.tsx); zoom, pan and the commands are built
// with F-002…F-008 and F-010. The canvas is not a Preact tree: it is painted imperatively on rAF (ADR-0002).
import type { AnnotationKind } from '../core';

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Canvas ${name}`);
};

/** The canvas component (CMP-Canvas): a fit view of the loaded image (F-001); interaction comes later. */
export { Canvas, fitTransform, type CanvasProps } from './Canvas';

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
