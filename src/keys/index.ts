// MOD-Keys — the RULE-19 keyboard map as a pure function of event and focus scope
// (specs/40-technical/modules/MOD-Keys.md). The pure core imports no DOM code; a thin adapter
// (added with F-013) reads the event, focus and platform into `KeyInfo`.
// F-002 builds the View keys and the arrow-key pan of RULE-19; F-003 the Tools keys, Enter (place) and
// Esc; F-005 the keys while a text annotation is edited and Enter on a selected text; F-012 the Export
// keys (Mod+C copy, Mod+S download); F-008 the Edit keys (Delete/Backspace, Mod+D, Mod+A, ] and [,
// arrow-key moves and Alt+arrow resizes of the selection); F-009 the History keys (Mod+Z, Mod+Shift+Z,
// Ctrl+Y off macOS); F-010 the arrow keys on the crop frame; F-013 completes the map (Tab / Shift+Tab
// through the annotations, ? for the shortcut list, Mod+O open, Mod+V left to the paste event) and the
// shortcut list CMP-ShortcutHelp shows (`shortcutList`).

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

/**
 * A piece of a key cell: a key label as printed (never translated, e.g. "Ctrl+", "⌘", "← ↑ → ↓"), or a
 * COPY ID that MOD-App translates (COPY-key.drag, COPY-key.wheel, COPY-key.or, COPY-key.spoken_*).
 */
export type KeyText = string | { readonly copyId: string };

/**
 * One row of CMP-ShortcutHelp: the COPY ID of what it does, its keys as printed (pieces joined with
 * nothing; aliases separated by " / "), and the same keys spoken for screen readers (pieces joined with
 * spaces): the printed labels spelled as words, with COPY-key.* for everything else (MOD-Keys holds no copy).
 */
export interface ShortcutRow {
  readonly copyId: string;
  readonly printed: readonly KeyText[];
  readonly spoken: readonly KeyText[];
}

/** A group of CMP-ShortcutHelp (COPY-shortcuts.*), in RULE-19 order. */
export interface ShortcutGroup {
  readonly copyId: string;
  readonly rows: readonly ShortcutRow[];
}

/** A key cell's text with its COPY IDs translated by `tr`: printed (joined) or spoken (spaced). */
export function keyText(pieces: readonly KeyText[], tr: (copyId: string) => string, spoken = false): string {
  const parts = pieces.map((p) => (typeof p === 'string' ? p : tr(p.copyId)));
  return spoken
    ? parts
        .filter((p) => p !== '')
        .join(' ')
        .replace(/ ,/g, ',')
    : parts.join('');
}

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
  // A dialog or menu is open: nothing acts (Esc is the dialog's own). Mod+O is still kept, so the
  // browser's own open-file never replaces the page behind the dialog (F-001: kept since the loader).
  if (scope.focus === 'dialog') return key.mod && !key.alt && !key.shift && letterOf(key) === 'o' ? KEEP : NONE;
  // F-012 / RULE-19 Export: Mod+S downloads wherever focus is in the tool, also while text is edited
  // (a text annotation, or a text or number field: the one key besides Esc that keeps its meaning there).
  const exportKey = key.mod && !key.alt && !key.shift ? letterOf(key) : undefined;
  if (exportKey === 's') return act('export', 'download');
  // F-005.R2 / RULE-19: while a text is edited only Esc and Mod+S keep their meaning; every other key
  // edits the text as in any text field, and undo/redo act within it.
  // F-019.R5 / RULE-19: in a text or number field Esc keeps its meaning too (a field whose text changed
  // restores it and stops the key before it gets here).
  if (scope.focus === 'textAnnotation' || scope.focus === 'text')
    return !key.mod && !key.alt && key.key === 'Escape' ? act('edit', 'escape') : NONE;
  // RULE-19 Load: Mod+V is never kept, so the browser fires the paste event (MOD-IO loads from it);
  // Mod+O opens a file wherever focus is in the tool.
  if (exportKey === 'v') return NONE;
  if (exportKey === 'o') return act('load', 'open');
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
  // F-013.R3 / RULE-19 Help: ? (by the typed character) shows the shortcut list.
  if (plain && key.key === '?') return act('help', 'shortcuts');
  // F-013.R4 / RULE-19 Canvas: Tab / Shift+Tab select the next / previous annotation in drawing order;
  // MOD-Canvas moves focus out of the canvas after the last (or before the first), so the key is kept.
  if (plain && key.key === 'Tab') return act('canvas', key.shift ? 'previous' : 'next');
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

/**
 * CMP-ShortcutHelp: every RULE-19 key with its action, grouped as RULE-19 groups them, with Ctrl or ⌘
 * for the platform (`mac`). Key labels are printed as on the keyboard and never translated; arrow keys
 * as ← ↑ → ↓; pointer actions with COPY-key.drag and COPY-key.wheel. Aliases (Backspace for Delete,
 * Mod++ for Mod+=, Ctrl+Y for redo off macOS) are listed with the main key; the move, resize and pan
 * rows also show Shift for the larger step, and the crop keys share the move and resize rows.
 * Implements: F-013.R3, CMP-ShortcutHelp "Behavior" and "Accessibility" (spoken key names).
 */
export function shortcutList(mac: boolean): readonly ShortcutGroup[] {
  const key = (id: string) => ({ copyId: `key.${id}` });
  const OR = key('or');
  const ARROWS = '← ↑ → ↓';
  const SAY_ARROWS = key('spoken_arrows');
  // Modifiers as printed (macOS symbols take no "+") and as spoken (the label on the key).
  const M = mac ? '⌘' : 'Ctrl+';
  const S = mac ? '⇧' : 'Shift+';
  const A = mac ? '⌥' : 'Alt+';
  const sayM = mac ? 'Command' : 'Ctrl';
  const sayA = mac ? 'Option' : 'Alt';
  // Before a pointer word the macOS symbols take a space: "⌥ drag", "⌘ wheel".
  const Mw = mac ? '⌘ ' : 'Ctrl+';
  const Aw = mac ? '⌥ ' : 'Alt+';
  const row = (copyId: string, printed: readonly KeyText[], spoken: readonly KeyText[] = printed): ShortcutRow => ({
    copyId,
    printed,
    spoken,
  });
  /** Mod plus a letter: "Ctrl+D" / "⌘D", spoken "Ctrl D" / "Command D". */
  const mod = (copyId: string, letter: string) => row(copyId, [`${M}${letter}`], [sayM, letter]);
  const tools = Object.entries(TOOL_LETTERS).map(([letter, tool]) => row(`tool.${tool}`, [letter.toUpperCase()]));
  return [
    { copyId: 'shortcuts.tools', rows: tools },
    {
      copyId: 'shortcuts.canvas',
      rows: [
        row('shortcut.place', ['Enter']),
        row('shortcut.edit_text', ['Enter']),
        row('shortcut.next', [`Tab / ${S}Tab`], ['Tab,', OR, 'Shift Tab']),
      ],
    },
    {
      copyId: 'shortcuts.edit',
      rows: [
        row('action.delete', ['Delete / Backspace'], ['Delete,', OR, 'Backspace']),
        mod('action.duplicate', 'D'),
        mod('shortcut.select_all', 'A'),
        row('action.bring_forward', [']']),
        row('action.send_backward', ['[']),
        row('shortcut.move', [`${ARROWS} / ${S}${ARROWS}`], [SAY_ARROWS, ',', OR, 'Shift', SAY_ARROWS]),
        row(
          'shortcut.resize',
          [`${A}${ARROWS} / ${A}${S}${ARROWS}`],
          [sayA, SAY_ARROWS, ',', OR, sayA, 'Shift', SAY_ARROWS],
        ),
        row('shortcut.cancel', ['Esc'], ['Escape']),
      ],
    },
    {
      copyId: 'shortcuts.history',
      rows: [
        mod('action.undo', 'Z'),
        mac
          ? row('action.redo', ['⌘⇧Z'], ['Command Shift Z'])
          : row('action.redo', ['Ctrl+Shift+Z / Ctrl+Y'], ['Ctrl Shift Z,', OR, 'Ctrl Y']),
      ],
    },
    {
      copyId: 'shortcuts.view',
      rows: [
        row('action.zoom_in', [`${M}= / ${M}+`], [sayM, key('spoken_equals'), ',', OR, sayM, key('spoken_plus')]),
        row('action.zoom_out', [`${M}-`], [sayM, key('spoken_minus')]),
        row('action.zoom_fit', [`${S}1`], ['Shift 1']),
        row('action.zoom_actual', [`${S}0`], ['Shift 0']),
        row(
          'shortcut.pan',
          ['Space+', key('drag'), ` / ${ARROWS} / ${S}${ARROWS}`],
          ['Space', key('spoken_plus'), key('drag'), ',', OR, SAY_ARROWS, ',', OR, 'Shift', SAY_ARROWS],
        ),
        row('shortcut.zoom_pointer', [Mw, key('wheel')], [sayM, key('spoken_plus'), key('wheel')]),
      ],
    },
    {
      copyId: 'shortcuts.pointer',
      rows: [row('shortcut.move_while_drawing', [Aw, key('drag')], [sayA, key('spoken_plus'), key('drag')])],
    },
    { copyId: 'shortcuts.load', rows: [mod('shortcut.paste', 'V'), mod('action.open', 'O')] },
    { copyId: 'shortcuts.export', rows: [mod('action.copy', 'C'), mod('action.download', 'S')] },
    { copyId: 'shortcuts.help', rows: [row('action.shortcuts', ['?'], [key('spoken_question')])] },
  ];
}
