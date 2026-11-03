// MOD-Keys — the RULE-19 keyboard map as a pure function of event and focus scope
// (specs/40-technical/modules/MOD-Keys.md). The pure core imports no DOM code; a thin adapter
// (added with F-013) reads the event, focus and platform into `KeyInfo`.
// F-002 builds the View keys and the arrow-key pan of RULE-19; F-003 the Tools keys, Enter (place) and
// Esc; the other groups resolve to nothing (and are not yet kept from the browser) until F-013.

/** What the adapter reads from a keyboard event (platform-mapping.md "Letter keys by layout"). */
export interface KeyInfo {
  readonly key: string;
  readonly code: string;
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly mac: boolean;
}

/** Where focus is, the active tool and the selection shape (RULE-19 scope). */
export interface Scope {
  readonly focus: 'canvas' | 'control' | 'text' | 'dialog';
  readonly tool: string;
  readonly selection: 'none' | 'one' | 'many';
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

export type Action = NamedAction | PanAction;

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
  if (scope.focus === 'text' || scope.focus === 'dialog') return NONE;
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
    // RULE-19: kept from the browser with every tool, even with nothing to act on (select, crop).
    if (key.key === 'Enter') return NOT_DRAWING.has(scope.tool) ? KEEP : act('canvas', 'place');
  }
  if (plain && key.key === 'Escape') return act('edit', 'escape');
  if (plain && key.shift && key.code === 'Digit1') return act('view', 'fit');
  if (plain && key.shift && key.code === 'Digit0') return act('view', 'actualSize');
  if (plain && !key.shift && (key.code === 'Space' || key.key === ' ')) return act('view', 'panHold');
  const arrow = ARROWS[key.key];
  if (arrow && !key.mod) {
    // Alt+arrows resize the selection (F-008); with nothing to resize they are still kept (RULE-19),
    // so Alt+Left never takes the browser back.
    if (key.alt) return KEEP;
    if (scope.selection === 'none' && scope.tool !== 'crop') {
      const step = key.shift ? PAN_STEP_SHIFT : PAN_STEP;
      return { action: { kind: 'pan', group: 'view', dx: arrow[0] * step, dy: arrow[1] * step }, preventDefault: true };
    }
  }
  return NONE;
}

export function shortcutList(): readonly ShortcutRow[] {
  return notImplemented('shortcutList');
}
