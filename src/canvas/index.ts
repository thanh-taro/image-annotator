// MOD-Canvas — view, pointer and touch input, tool state machine, handles, crop, text overlay
// (specs/40-technical/modules/MOD-Canvas.md, ADR-0004, ADR-0009, ADR-0016, ADR-0020, ADR-0022).
// <Canvas> shows the loaded image (F-001, ./Canvas.tsx) in a view that zooms and pans (F-002,
// ./view.ts); shapes, pen strokes, highlights and steps are drawn with ./draw.ts (F-003, F-004, F-006);
// text is placed and edited with ./text.ts and ./editor.ts (F-005); selecting, moving and resizing with
// ./select.ts (F-008); crop arrives with F-010. The canvas is not a Preact tree: it is painted imperatively on rAF (ADR-0002).
import type { Point } from '../core';
import { activeCanvas } from './Canvas';

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Canvas ${name}`);
};

/** The canvas component (CMP-Canvas): the loaded image in a zoomable, pannable view (F-001, F-002). */
export { Canvas, viewTransform, type CanvasProps } from './Canvas';
export { ViewController, type WheelInput } from './view';
export { InputController, type PanCursor, type PointerInput, type ToolInput } from './input';
export {
  DRAFT_ID,
  defaultAt,
  DrawTool,
  drawKindOf,
  placeKindOf,
  type DragKind,
  type DrawSetup,
  type PlaceKind,
} from './draw';
export { connectFontGate, FontGate, fontGate } from './fonts';
export { DragLayers, dragRange, movePatches, type DragFrame, type PatchSource } from './drag';
export { SelectTool, type SelectCallbacks, type SelectSetup } from './select';
export { TextTool, type TextEdit, type TextEndReason, type TextField, type TextSetup } from './text';

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
  /** True while a pointer draw, move or resize is in progress (F-008 review m6: edit keys wait for it). */
  dragging: (): boolean => activeCanvas()?.dragging() ?? false,
  // F-008: arrow-key nudges and Alt+arrow resizes are document edits, so they are MOD-App commands
  // (app/editing.ts `nudgeSelection`, `altResizeSelection`, MOD-App.md).
  selectNext: (): void => notImplemented('canvasCommands.selectNext'),
  selectPrevious: (): void => notImplemented('canvasCommands.selectPrevious'),
  /** F-005.R4 / RULE-19 Enter with the select tool: edits the selected text; true if started. */
  beginTextEdit: (id: string): boolean => activeCanvas()?.beginTextEdit(id) ?? false,
  /** RULE-19 Esc: ends the text edit, keeping the text selected; true if one was open. */
  endTextEdit: (): boolean => activeCanvas()?.endTextEdit() ?? false,
};
