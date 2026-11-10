// MOD-App — the custom swatch of CMP-StylePanel's annotation colour groups (F-019, RULE-21): what it
// shows, choosing it, and one opening of the browser's colour picker. Choosing the swatch applies the
// remembered custom colour, if any; each colour the picker reports previews at once; the swatch and the
// colours of one opening form one undo step for a selection (RULE-11), ending when the picker closes or
// focus moves to another control; a cancel restores the colour from before the swatch was chosen and
// records no step. A value equal to a palette colour is that palette colour (RULE-21).
// Implements: F-019.R1, F-019.R2, F-019.R8, RULE-21, RULE-11 (the picker chain), D-047 (the drawing colour).
import { PALETTE_HEX } from '../canvas';
import { isHexColour, pickedColour, type CurrentStyles, type HexColour, type StyleColour } from '../core';
import { setDrawingColour, setStyle, type PanelModel } from './drawing';
import { commit, currentStyleModel, customColour, loaded, selection } from './state';

/** Which colour a group sets: the subject's style (tool or selection), or the drawing colour (D-047). */
export type ColourTarget = 'style' | 'drawing';

/**
 * F-019.R2: the custom swatch — the subject's custom colour, marked, or else the colour last picked on
 * the page, unmarked (null before any is picked). A palette colour, or a multi-selection whose colours
 * differ, leaves it unmarked.
 */
export function customSwatch(model: PanelModel): { colour: HexColour | null; checked: boolean } {
  const subject = model.canvas ? model.canvas.drawColor : model.color;
  if (isHexColour(subject)) return { colour: subject, checked: true };
  return { colour: customColour.value, checked: false };
}

function apply(target: ColourTarget, color: StyleColour, coalesceKey?: string): void {
  if (target === 'drawing') setDrawingColour(color);
  else setStyle({ color }, coalesceKey);
}

/**
 * F-019.R1: the custom swatch chosen without the picker (arrow keys): the remembered custom colour applies
 * like a palette colour. False when none is remembered: the swatch only takes focus.
 */
export function chooseCustomSwatch(target: ColourTarget): boolean {
  const remembered = customColour.value;
  if (!remembered) return false;
  apply(target, remembered);
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
/** The group whose picker opened last: a colour it reports after its chain ended still applies. */
let lastTarget: ColourTarget = 'style';

/** A picker opening is in progress (between `beginCustomPick` and its end or cancel). */
export const customPickOpen = (): boolean => session !== null;

/**
 * F-019.R1/R8: the swatch was clicked or tapped, or Enter or Space pressed on it — `choose` applies the
 * remembered custom colour (if any) and the picker opens. Its changes chain into one step from here.
 */
export function beginCustomPick(target: ColourTarget, choose: boolean): void {
  endCustomPick();
  lastTarget = target;
  session = {
    target,
    key: `custom-colour:${++openings}:${selection.value.join(',')}`,
    styles: currentStyleModel.value,
    remembered: customColour.value,
  };
  const remembered = customColour.value;
  if (choose && remembered) apply(target, remembered, session.key);
}

/** F-019.R8: a colour the picker reports while open (`#rrggbb`): the subject follows it at once. */
export function previewCustomColour(value: string): void {
  const color = pickedColour(value, PALETTE_HEX);
  if (!color) return;
  // A browser that reports `change` for each colour while its picker stays open ends the chain each time;
  // the colours after it still apply, each as its own step.
  if (session) apply(session.target, color, session.key);
  else apply(lastTarget, color);
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
