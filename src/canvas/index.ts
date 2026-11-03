// MOD-Canvas — view, pointer and touch input, tool state machine, handles, crop, text overlay
// (specs/40-technical/modules/MOD-Canvas.md, ADR-0004, ADR-0009, ADR-0016, ADR-0020, ADR-0022).
// <Canvas> shows the loaded image (F-001, ./Canvas.tsx) in a view that zooms and pans (F-002,
// ./view.ts); the drawing commands are built with F-003…F-008 and F-010. The canvas is not a Preact tree: it is painted imperatively on rAF (ADR-0002).
import type { AnnotationKind } from '../core';
import { activeCanvas } from './Canvas';
import type { PanDirection } from './view';

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Canvas ${name}`);
};

/** The canvas component (CMP-Canvas): the loaded image in a zoomable, pannable view (F-001, F-002). */
export { Canvas, viewTransform, type CanvasProps } from './Canvas';
export { PAN_STEP, ViewController, type PanDirection } from './view';

/**
 * The view commands (F-002.R2/R4; CMP-StatusBar and the RULE-19 View keys). With no image shown they
 * do nothing (SCR-Annotator "empty": zoom disabled). `panKey` and `holdSpace` serve the arrow-key pan
 * and Space+drag of RULE-19.
 */
export const viewCommands = {
  zoomIn: (): void => activeCanvas()?.controller.zoomIn(),
  zoomOut: (): void => activeCanvas()?.controller.zoomOut(),
  fit: (): void => activeCanvas()?.controller.fit(),
  actualSize: (): void => activeCanvas()?.controller.actualSize(),
  setBottomInset: (px: number): void => activeCanvas()?.setBottomInset(px),
  panKey: (direction: PanDirection): void => activeCanvas()?.controller.panKey(direction),
  holdSpace: (held: boolean): void => activeCanvas()?.holdSpace(held),
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
