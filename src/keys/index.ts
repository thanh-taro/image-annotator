// MOD-Keys — the RULE-19 keyboard map as a pure function of event and focus scope
// (specs/40-technical/modules/MOD-Keys.md). The pure core imports no DOM code; a thin adapter
// (added with F-013) reads the event, focus and platform into `KeyInfo`.
// F-002 builds the View keys and the arrow-key pan of RULE-19; the other groups resolve to nothing
// (and are not yet kept from the browser) until F-013 completes the map.

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

export interface Action {
  readonly group: ActionGroup;
  readonly name: string;
}

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
const act = (group: ActionGroup, name: string): Resolution => ({ action: { group, name }, preventDefault: true });

const PAN: Readonly<Record<string, string>> = {
  ArrowLeft: 'panLeft',
  ArrowRight: 'panRight',
  ArrowUp: 'panUp',
  ArrowDown: 'panDown',
};

/**
 * RULE-19 for a key press in a focus scope: the action, and whether the key is kept from the browser.
 * Implements (F-002): View — Mod+= zoom in, Mod+- zoom out (anywhere in the tool), Shift+1 fit and
 * Shift+0 100 % (canvas only, by digit-row position), Space held for Space+drag (canvas only); arrow
 * keys pan with nothing selected and no crop tool (canvas only, F-002.R4; Shift pans further). Nothing acts while text is
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
  if (plain && key.shift && key.code === 'Digit1') return act('view', 'fit');
  if (plain && key.shift && key.code === 'Digit0') return act('view', 'actualSize');
  if (plain && !key.shift && (key.code === 'Space' || key.key === ' ')) return act('view', 'panHold');
  const pan = PAN[key.key];
  // RULE-19: 40 screen pixels, Shift: 200 (the `…Far` actions).
  if (pan && plain && scope.selection === 'none' && scope.tool !== 'crop')
    return act('view', key.shift ? `${pan}Far` : pan);
  return NONE;
}

export function shortcutList(): readonly ShortcutRow[] {
  return notImplemented('shortcutList');
}
