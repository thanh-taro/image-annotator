// MOD-Keys — the RULE-19 keyboard map as a pure function of event and focus scope
// (specs/40-technical/modules/MOD-Keys.md). The pure core imports no DOM code; a thin adapter
// (added with F-013) reads the event, focus and platform into `KeyInfo`.
// F-002 builds the View keys and the arrow-key pan of RULE-19; F-003 the Tools keys, Enter (place) and
// Esc; F-005 the keys while a text annotation is edited and Enter on a selected text; F-012 the Export
// keys (Mod+C copy, Mod+S download); F-008 the Edit keys (Delete/Backspace, Mod+D, Mod+A, ] and [,
// arrow-key moves and Alt+arrow resizes of the selection); F-009 the History keys (Mod+Z, Mod+Shift+Z,
// Ctrl+Y off macOS); F-010 the arrow keys on the crop frame; the other groups
// resolve to nothing (and are not yet kept from the browser) until F-013.

/** What the adapter reads from a keyboard event (platform-mapping.md "Letter keys by layout"). */
export interface KeyInfo {
  readonly key: string;
  readonly code: string;
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly mac: boolean;
}

/**
 * Where focus is, the active tool and the selection shape (RULE-19 scope). `textAnnotation` is
 * CMP-TextEditor (a text annotation being edited); `text` is any other text or number field.
 */
export interface Scope {
  readonly focus: 'canvas' | 'control' | 'text' | 'textAnnotation' | 'dialog';
  readonly tool: string;
  readonly selection: 'none' | 'one' | 'many';
  /** The single selected annotation is a text (RULE-19: Enter with the select tool edits it). */
  readonly textSelected?: boolean;
  /** Text is selected somewhere on the page (RULE-19: Mod+C is then the browser's own copy). */
  readonly pageTextSelected?: boolean;
}

/** The closed set of action groups (MOD-Keys public surface); members are defined with F-013. */
export type ActionGroup = 'tool' | 'canvas' | 'edit' | 'history' | 'view' | 'load' | 'export' | 'help';

/** An action named by its group and name (members are defined per feature; F-013 closes the set). */
export interface NamedAction {
  readonly kind: 'named';
  readonly group: ActionGroup;
  readonly name: string;
}

/**
 * RULE-19 arrow keys with nothing selected: move the view by (dx, dy) screen pixels — positive dx shows
 * more of the right side, positive dy more of the bottom.
 */
export interface PanAction {
  readonly kind: 'pan';
  readonly group: 'view';
  readonly dx: number;
  readonly dy: number;
}

/**
 * RULE-19 Edit (F-008.R2/R3): arrow keys move the selection by (dx, dy) image pixels (`nudge`);
 * Alt+arrows make a single selection (dx, dy) wider and taller, keeping its top-left corner (`resize`).
 */
export interface EditStepAction {
  readonly kind: 'nudge' | 'resize';
  readonly group: 'edit';
  readonly dx: number;
  readonly dy: number;
}

/**
 * RULE-19 with the crop tool (F-010.R6): arrow keys move the frame by (dx, dy) image pixels (`frameMove`);
 * Alt+arrows resize it by its right or bottom edge, (dx, dy) wider and taller (`frameResize`).
 */
export interface FrameStepAction {
  readonly kind: 'frameMove' | 'frameResize';
  readonly group: 'edit';
  readonly dx: number;
  readonly dy: number;
}

export type Action = NamedAction | PanAction | EditStepAction | FrameStepAction;

/** RULE-19: arrow keys move the selection 1 image pixel, 10 with Shift (Alt+arrows resize by the same). */
export const NUDGE_STEP = 1;
export const NUDGE_STEP_SHIFT = 10;

/** RULE-19: arrow keys pan the view 40 screen pixels, 200 with Shift. */
export const PAN_STEP = 40;
export const PAN_STEP_SHIFT = 200;

export interface Resolution {
  readonly action?: Action;
  readonly preventDefault: boolean;
}

/** One row of CMP-ShortcutHelp: key labels plus the COPY ID of its description. */
export interface ShortcutRow {
  readonly keys: readonly string[];
  readonly copyId: string;
}

const notImplemented = (name: string): never => {
  throw new Error(`not implemented: MOD-Keys ${name}`);
};

const NONE: Resolution = { preventDefault: false };
/** Kept from the browser with nothing to do (RULE-19: every key in scope is kept). */
const KEEP: Resolution = { preventDefault: true };
const act = (group: ActionGroup, name: string): Resolution => ({
  action: { kind: 'named', group, name },
  preventDefault: true,
});

/** RULE-19 Tools keys: the letter → the tool's name (CMP-Toolbar order). */
const TOOL_LETTERS: Readonly<Record<string, string>> = {
  v: 'select',
  r: 'rectangle',
  o: 'ellipse',
  a: 'arrow',
  l: 'line',
  p: 'pen',
  h: 'highlight',
  t: 'text',
  n: 'step',
  x: 'redact',
  c: 'crop',
};

/** Tools that do not place an annotation on Enter (RULE-19 "Enter with a drawing tool"). */
const NOT_DRAWING = new Set(['select', 'crop']);

/**
 * The letter a key press stands for (platform-mapping.md "Letter keys by layout"): the typed character
 * on Latin layouts, else the key's position on a US layout (`KeyR` → r).
 */
function letterOf(key: KeyInfo): string | undefined {
  const typed = key.key.toLowerCase();
  if (/^[a-z]$/.test(typed)) return typed;
  const m = /^Key([A-Z])$/.exec(key.code);
  return m?.[1]?.toLowerCase();
}

/** Unit direction of each arrow key: where the view moves. */
const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * RULE-19 for a key press in a focus scope: the action, and whether the key is kept from the browser.
 * Implements (F-002): View — Mod+= zoom in, Mod+- zoom out (anywhere in the tool), Shift+1 fit and
 * Shift+0 100 % (canvas only, by digit-row position), Space held for Space+drag (canvas only); arrow
 * keys pan 40 px (Shift: 200) with nothing selected and no crop tool, Alt+arrows are kept (canvas
 * only, F-002.R4). Nothing acts while text is
 * edited, or while a dialog or menu is open (Esc there is the dialog's or menu's own).
 */
export function resolveKey(key: KeyInfo, scope: Scope): Resolution {
  if (scope.focus === 'dialog') return NONE;
  // F-012 / RULE-19 Export: Mod+S downloads wherever focus is in the tool, also while text is edited
  // (a text annotation, or a text or number field: the one key besides Esc that keeps its meaning there).
  const exportKey = key.mod && !key.alt && !key.shift ? letterOf(key) : undefined;
  if (exportKey === 's') return act('export', 'download');
  // F-005.R2 / RULE-19: while a text is edited only Esc and Mod+S keep their meaning; every other key
  // edits the text as in any text field, and undo/redo act within it.
  if (scope.focus === 'textAnnotation')
    return !key.mod && !key.alt && key.key === 'Escape' ? act('edit', 'escape') : NONE;
  if (scope.focus === 'text') return NONE;
  // F-009.R1 / RULE-19 History: Mod+Z undo, Mod+Shift+Z redo, Ctrl+Y redo on Windows/Linux — wherever
  // focus is in the tool (not in a text field, above), kept from the browser even with nothing to undo.
  if (key.mod && !key.alt) {
    const letter = letterOf(key);
    if (letter === 'z') return act('history', key.shift ? 'redo' : 'undo');
    if (letter === 'y' && !key.shift && !key.mac) return act('history', 'redo');
  }
  // F-012.R1 / RULE-19: Mod+C copies the result when no text is selected on the page.
  if (exportKey === 'c') return scope.pageTextSelected ? NONE : act('export', 'copy');
  const plain = !key.mod && !key.alt;
  if (key.mod && !key.alt) {
    // `=` and `-` follow the typed character; `+` is the browser's own zoom-in key too (Mod++).
    if (key.key === '=' || key.key === '+') return act('view', 'zoomIn');
    if (key.key === '-' && !key.shift) return act('view', 'zoomOut');
  }
  if (scope.focus !== 'canvas') return NONE;
  // F-003: Tools — a plain letter picks its tool; Enter places; Esc runs the RULE-19 Esc chain.
  if (plain && !key.shift) {
    const letter = letterOf(key);
    const tool = letter && TOOL_LETTERS[letter];
    if (tool) return act('tool', tool);
    // RULE-19: kept from the browser with every tool, even with nothing to act on (select, crop);
    // F-005.R4: with the select tool and one text selected, Enter edits it.
    if (key.key === 'Enter') {
      if (scope.tool === 'select' && scope.selection === 'one' && scope.textSelected) return act('canvas', 'editText');
      return NOT_DRAWING.has(scope.tool) ? KEEP : act('canvas', 'place');
    }
  }
  if (plain && key.key === 'Escape') return act('edit', 'escape');
  // F-008.R5 / RULE-19 Edit: Delete or Backspace delete the selection; Mod+D duplicates; Mod+A selects all;
  // ] brings forward and [ sends backward (by the typed character). Kept even with nothing to act on.
  if (plain && !key.shift && (key.key === 'Delete' || key.key === 'Backspace')) return act('edit', 'delete');
  if (key.mod && !key.alt && !key.shift) {
    const letter = letterOf(key);
    if (letter === 'd') return act('edit', 'duplicate');
    if (letter === 'a') return act('edit', 'selectAll');
  }
  if (!key.mod && key.key === ']') return act('edit', 'bringForward');
  if (!key.mod && key.key === '[') return act('edit', 'sendBackward');
  if (plain && key.shift && key.code === 'Digit1') return act('view', 'fit');
  if (plain && key.shift && key.code === 'Digit0') return act('view', 'actualSize');
  if (plain && !key.shift && (key.code === 'Space' || key.key === ' ')) return act('view', 'panHold');
  const arrow = ARROWS[key.key];
  if (arrow && !key.mod) {
    const step = key.shift ? NUDGE_STEP_SHIFT : NUDGE_STEP;
    // F-010.R6 / RULE-19: with the crop tool the arrows always act on the frame (never pan): they move it,
    // Alt+arrows resize it by its right or bottom edge, 1 image pixel (Shift: 10).
    if (scope.tool === 'crop')
      return {
        action: {
          kind: key.alt ? 'frameResize' : 'frameMove',
          group: 'edit',
          dx: arrow[0] * step,
          dy: arrow[1] * step,
        },
        preventDefault: true,
      };
    const edit = (kind: EditStepAction['kind']): Resolution => ({
      action: { kind, group: 'edit', dx: arrow[0] * step, dy: arrow[1] * step },
      preventDefault: true,
    });
    // F-008.R3 / RULE-19: Alt+arrows resize a single selection; with nothing or several selected they do
    // nothing and are still kept, so Alt+Left never takes the browser back.
    if (key.alt) return scope.selection === 'one' ? edit('resize') : KEEP;
    // F-008.R2 / RULE-19: arrow keys move the selection 1 image pixel (Shift: 10).
    if (scope.selection !== 'none') return edit('nudge');
    {
      const step = key.shift ? PAN_STEP_SHIFT : PAN_STEP;
      return { action: { kind: 'pan', group: 'view', dx: arrow[0] * step, dy: arrow[1] * step }, preventDefault: true };
    }
  }
  return NONE;
}

export function shortcutList(): readonly ShortcutRow[] {
  return notImplemented('shortcutList');
}
