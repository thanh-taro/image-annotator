// MOD-App — the custom swatch of CMP-StylePanel's annotation colour groups (F-019, RULE-21): what it
// shows, choosing it, and one opening of the browser's colour picker. Choosing the swatch applies the
// colour it shows, if any (nothing when it is already checked); each colour the picker reports previews at once; the swatch and the
// colours of one opening form one undo step for a selection (RULE-11), ending when the picker closes or
// focus moves to another control; a cancel restores the colour from before the swatch was chosen and
// records no step. A value equal to a palette colour is that palette colour (RULE-21).
// Implements: F-019.R1, F-019.R2, F-019.R8, RULE-21, RULE-11 (the picker chain), D-047 (the drawing colour);
// F-020.R1/R2/R3 (the same custom swatch for the fill colour and text background colour, one remembered colour).
import { PALETTE_HEX } from '../canvas';
import { fillColourOf, isHexColour, pickedColour, type CurrentStyles, type HexColour, type StyleColour } from '../core';
import { panelModel, setDrawingColour, setStyle, type PanelModel } from './drawing';
import {
  commit,
  currentStyleModel,
  currentStyles,
  customColour,
  doc,
  loaded,
  selection,
  textEditing,
  tool,
} from './state';

/**
 * Which colour a group sets: the subject's colour (tool or selection), the drawing colour (D-047), or the
 * subject's fill colour or text background colour (F-020.R1/R3, RULE-22).
 */
export type ColourTarget = 'style' | 'drawing' | 'fill';

/** F-020.R1/R3: the fill colour or text background colour the panel shows (as drawn), if offered. */
const fillShown = (model: PanelModel): StyleColour | null | undefined =>
  model.fillColor !== undefined ? model.fillColor : model.textBackgroundColor;

/** The colour a group of `target` shows: the drawing colour, the subject's colour, or its fill colour. */
export const shownColour = (model: PanelModel, target: ColourTarget): StyleColour | null | undefined =>
  target === 'fill' ? fillShown(model) : model.canvas ? model.canvas.drawColor : model.color;

/**
 * F-019.R2: the custom swatch — the subject's custom colour, marked, or else the colour last picked on
 * the page, unmarked (null before any is picked). A palette colour, or a multi-selection whose colours
 * differ, leaves it unmarked. F-020.R1: the same for the fill colour and text background colour (as drawn:
 * an automatic text background colour in a custom colour marks the custom swatch, F-020.R4), with one remembered colour.
 */
export function customSwatch(
  model: PanelModel,
  target: ColourTarget = 'style',
): { colour: HexColour | null; checked: boolean } {
  const subject = shownColour(model, target);
  if (isHexColour(subject)) return { colour: subject, checked: true };
  return { colour: customColour.value, checked: false };
}

/** The panel model now (the size field's preset widths do not matter here). */
const modelNow = (): PanelModel =>
  panelModel(tool.value, selection.value, doc.value, currentStyles.value, textEditing.value !== null);

/** The subject's colour: the drawing colour, the shared colour, or else the first selected annotation's. */
function subjectColour(model: PanelModel, target: ColourTarget): StyleColour | null {
  const shown = shownColour(model, target);
  if (shown) return shown;
  // A multi-selection whose colours differ: the first selected annotation's colour (F-019.R1 names "the
  // subject's colour"; with several colours the first in the selection's order stands for it); for a fill
  // colour or text background colour its colour as drawn (F-020.R1).
  const first = selection.value[0];
  const a = doc.value?.annotations.find((x) => x.id === first);
  if (!a) return null;
  return target === 'fill' ? fillColourOf(a.kind, a.style) : a.style.color;
}

/**
 * F-019.R1: where the picker starts — the swatch's colour, or when none is remembered the subject's
 * colour (a palette colour as its value, `#rrggbb`).
 */
export function pickerStart(target: ColourTarget): HexColour | null {
  const model = modelNow();
  const swatch = customSwatch(model, target).colour;
  if (swatch) return swatch;
  const subject = subjectColour(model, target);
  if (!subject) return null;
  return isHexColour(subject) ? subject : (PALETTE_HEX[subject].toLowerCase() as HexColour);
}

function apply(target: ColourTarget, color: StyleColour, coalesceKey?: string): void {
  if (target === 'drawing') setDrawingColour(color);
  else if (target === 'fill')
    setStyle({ fillColor: color }, coalesceKey); // F-020.R1/R2: a picked fill colour (a text background: no longer automatic)
  else setStyle({ color }, coalesceKey);
}

/**
 * F-019.R1: the custom swatch chosen without the picker (arrow keys): the colour it shows applies like a
 * palette colour — nothing when it is already checked. False when it shows none: it only takes focus.
 */
export function chooseCustomSwatch(target: ColourTarget): boolean {
  const swatch = customSwatch(modelNow(), target);
  if (swatch.checked) return true;
  if (!swatch.colour) return false;
  apply(target, swatch.colour);
  return true;
}

interface PickSession {
  readonly target: ColourTarget;
  readonly key: string;
  /** For a cancel: the current styles and the remembered colour from before the swatch was chosen. */
  readonly styles: CurrentStyles;
  readonly remembered: HexColour | null;
}

let session: PickSession | null = null;
let openings = 0;

/**
 * A picker opening is in progress (between `beginCustomPick` and its end or cancel) — with `target`, one
 * opened by a group of that target (the colour and the fill colour groups each watch their own, F-020.R1).
 */
export const customPickOpen = (target?: ColourTarget): boolean =>
  session !== null && (target === undefined || session.target === target);

/**
 * F-019.R1/R8: the swatch was clicked or tapped, or Enter or Space pressed on it — `choose` applies the
 * colour the swatch shows (nothing when it is already checked) and the picker opens. Its changes chain into
 * one step from here.
 */
export function beginCustomPick(target: ColourTarget, choose: boolean): void {
  endCustomPick();
  const swatch = customSwatch(modelNow(), target);
  session = {
    target,
    key: `custom-colour:${++openings}:${selection.value.join(',')}`,
    styles: currentStyleModel.value,
    remembered: customColour.value,
  };
  if (choose && !swatch.checked && swatch.colour) apply(target, swatch.colour, session.key);
}

/**
 * F-019.R8: a colour the picker reports while open (`#rrggbb`): the subject follows it at once. One
 * reported after the opening ended (the subject may have changed since) is ignored.
 */
export function previewCustomColour(value: string): void {
  const color = pickedColour(value, PALETTE_HEX);
  if (!color || !session) return;
  apply(session.target, color, session.key);
}

/**
 * F-019.R8: the picker closed (with or without a choice), or focus moved to another control: the chain
 * ends, so the next change is a step of its own.
 */
export function endCustomPick(): void {
  if (!session) return;
  session = null;
  loaded.value?.session.history.breakChain();
}

/**
 * F-019.R8: the picker reported a cancel — the subject returns to the colour it had before the swatch was
 * chosen, and no step is recorded (the opening's step is dropped); the remembered colour goes back too.
 */
export function cancelCustomPick(): void {
  const s = session;
  if (!s) return;
  session = null;
  const restore = loaded.value?.session.history.discardChain(s.key);
  if (restore) commit(restore);
  currentStyleModel.value = s.styles;
  customColour.value = s.remembered;
}
