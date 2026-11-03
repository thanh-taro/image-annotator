// MOD-Canvas — view, pointer and touch input, tool state machine, handles, crop, text overlay
// (specs/40-technical/modules/MOD-Canvas.md, ADR-0004, ADR-0009, ADR-0016, ADR-0020, ADR-0022).
// <Canvas> shows the loaded image (F-001, ./Canvas.tsx) in a view that zooms and pans (F-002,
// ./view.ts); shapes, pen strokes and highlights are drawn with ./draw.ts (F-003, F-004); the other
// drawing commands are built with F-005…F-008 and F-010. The canvas is not a Preact tree: it is painted imperatively on rAF (ADR-0002).
import type { Point } from '../core';
import { activeCanvas } from './Canvas';

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Canvas ${name}`);
};

/** The canvas component (CMP-Canvas): the loaded image in a zoomable, pannable view (F-001, F-002). */
export { Canvas, viewTransform, type CanvasProps } from './Canvas';
export { ViewController, type WheelInput } from './view';
export { InputController, type PanCursor, type PointerInput, type ToolInput } from './input';
export { DRAFT_ID, DrawTool, drawKindOf, shapeKindOf, type DragKind, type DrawSetup } from './draw';
export { DragLayers, type DragFrame } from './drag';

/**
 * The view commands (F-002.R2/R4; CMP-StatusBar and the RULE-19 View keys). With no image shown they
 * do nothing (SCR-Annotator "empty": zoom disabled). `panView` and `holdSpace` serve the arrow-key pan
 * and Space+drag of RULE-19.
 */
export const viewCommands = {
  zoomIn: (): void => activeCanvas()?.controller.zoomIn(),
  zoomOut: (): void => activeCanvas()?.controller.zoomOut(),
  fit: (): void => activeCanvas()?.controller.fit(),
  actualSize: (): void => activeCanvas()?.controller.actualSize(),
  setBottomInset: (px: number): void => activeCanvas()?.setBottomInset(px),
  /** F-002.R3: `zoom` (percent, within RULE-12's range) keeping the image point under `at` (CSS px in the work area). */
  zoomAt: (zoom: number, at: Point): void => activeCanvas()?.controller.zoomAt(zoom, at),
  /** RULE-19 arrow keys: moves the view by (dx, dy) screen pixels (positive dx shows more of the right). */
  panView: (dx: number, dy: number): void => activeCanvas()?.controller.panView(dx, dy),
  holdSpace: (held: boolean): void => activeCanvas()?.holdSpace(held),
};

export const canvasCommands = {
  /** RULE-19 Enter (F-003.R5): the active tool's default annotation at the centre of the view; true if placed. */
  placeAtCentre: (): boolean => activeCanvas()?.placeAtCentre() ?? false,
  /** RULE-19 Esc: cancels the current drag; true if there was one (nothing is created). */
  cancelDrag: (): boolean => activeCanvas()?.cancelDrag() ?? false,
  nudge: (_dx: number, _dy: number): void => notImplemented('canvasCommands.nudge'),
  altResize: (_dx: number, _dy: number): void => notImplemented('canvasCommands.altResize'),
  selectNext: (): void => notImplemented('canvasCommands.selectNext'),
  selectPrevious: (): void => notImplemented('canvasCommands.selectPrevious'),
  beginTextEdit: (): void => notImplemented('canvasCommands.beginTextEdit'),
  endTextEdit: (): void => notImplemented('canvasCommands.endTextEdit'),
};
