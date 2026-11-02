// MOD-Keys — the RULE-19 keyboard map as a pure function of event and focus scope
// (specs/40-technical/modules/MOD-Keys.md). The pure core imports no DOM code; a thin adapter
// (added with F-013) reads the event, focus and platform into `KeyInfo`.
// Phase 3.3 scaffold: the public surface is typed; resolution throws until F-013 is built.

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

export function resolveKey(_key: KeyInfo, _scope: Scope): Resolution {
  return notImplemented('resolveKey');
}

export function shortcutList(): readonly ShortcutRow[] {
  return notImplemented('shortcutList');
}
