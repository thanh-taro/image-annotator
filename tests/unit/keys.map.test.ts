// MOD-Keys — the whole RULE-19 keyboard map, row by row (F-013), and the shortcut list CMP-ShortcutHelp
// shows (`shortcutList`). Earlier features test their own groups in detail (keys.*.test.ts); this file
// audits every row of RULE-19 once, in its focus scope, and the keys F-013 adds (Tab, ?, Mod+O, Mod+V).
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../src/copy/messages.gen';
import { keyText, resolveKey, shortcutList, type KeyInfo, type Resolution, type Scope } from '../../src/keys';

const key = (k: Partial<KeyInfo> & { key: string }): KeyInfo => ({
  code: '',
  mod: false,
  shift: false,
  alt: false,
  mac: false,
  ...k,
});
const scope = (s: Partial<Scope> = {}): Scope => ({ focus: 'canvas', tool: 'select', selection: 'none', ...s });
const named = (r: Resolution) =>
  r.action?.kind === 'named' ? `${r.action.group}:${r.action.name}` : (r.action?.kind ?? undefined);

/** Every RULE-19 key press (Windows/Linux spelling), the scope it is tried in, and what it does. */
const RULE_19: readonly (readonly [string, KeyInfo, Partial<Scope>, string | undefined])[] = [
  // Tools
  ['V', key({ key: 'v', code: 'KeyV' }), {}, 'tool:select'],
  ['R', key({ key: 'r', code: 'KeyR' }), {}, 'tool:rectangle'],
  ['O', key({ key: 'o', code: 'KeyO' }), {}, 'tool:ellipse'],
  ['A', key({ key: 'a', code: 'KeyA' }), {}, 'tool:arrow'],
  ['L', key({ key: 'l', code: 'KeyL' }), {}, 'tool:line'],
  ['P', key({ key: 'p', code: 'KeyP' }), {}, 'tool:pen'],
  ['H', key({ key: 'h', code: 'KeyH' }), {}, 'tool:highlight'],
  ['T', key({ key: 't', code: 'KeyT' }), {}, 'tool:text'],
  ['N', key({ key: 'n', code: 'KeyN' }), {}, 'tool:step'],
  ['X', key({ key: 'x', code: 'KeyX' }), {}, 'tool:redact'],
  ['C', key({ key: 'c', code: 'KeyC' }), {}, 'tool:crop'],
  // Canvas
  [
    'Enter (drawing tool)',
    key({ key: 'Enter', code: 'Enter' }),
    { tool: 'rectangle', selection: 'one' },
    'canvas:place',
  ],
  [
    'Enter (select, one text)',
    key({ key: 'Enter', code: 'Enter' }),
    { selection: 'one', textSelected: true },
    'canvas:editText',
  ],
  ['Tab', key({ key: 'Tab', code: 'Tab' }), {}, 'canvas:next'],
  ['Shift+Tab', key({ key: 'Tab', code: 'Tab', shift: true }), { selection: 'one' }, 'canvas:previous'],
  // Edit
  ['Delete', key({ key: 'Delete', code: 'Delete' }), { selection: 'one' }, 'edit:delete'],
  ['Backspace', key({ key: 'Backspace', code: 'Backspace' }), { selection: 'one' }, 'edit:delete'],
  ['Mod+D', key({ key: 'd', code: 'KeyD', mod: true }), { selection: 'one' }, 'edit:duplicate'],
  ['Mod+A', key({ key: 'a', code: 'KeyA', mod: true }), {}, 'edit:selectAll'],
  [']', key({ key: ']', code: 'BracketRight' }), { selection: 'one' }, 'edit:bringForward'],
  ['[', key({ key: '[', code: 'BracketLeft' }), { selection: 'one' }, 'edit:sendBackward'],
  ['arrow (selection)', key({ key: 'ArrowRight', code: 'ArrowRight' }), { selection: 'one' }, 'nudge'],
  ['Alt+arrow (one)', key({ key: 'ArrowRight', code: 'ArrowRight', alt: true }), { selection: 'one' }, 'resize'],
  ['arrow (crop)', key({ key: 'ArrowRight', code: 'ArrowRight' }), { tool: 'crop' }, 'frameMove'],
  ['Alt+arrow (crop)', key({ key: 'ArrowDown', code: 'ArrowDown', alt: true }), { tool: 'crop' }, 'frameResize'],
  ['arrow (nothing selected)', key({ key: 'ArrowLeft', code: 'ArrowLeft' }), {}, 'pan'],
  ['Esc', key({ key: 'Escape', code: 'Escape' }), {}, 'edit:escape'],
  // History
  ['Mod+Z', key({ key: 'z', code: 'KeyZ', mod: true }), {}, 'history:undo'],
  ['Mod+Shift+Z', key({ key: 'Z', code: 'KeyZ', mod: true, shift: true }), {}, 'history:redo'],
  ['Ctrl+Y', key({ key: 'y', code: 'KeyY', mod: true }), {}, 'history:redo'],
  // View
  ['Mod+=', key({ key: '=', code: 'Equal', mod: true }), {}, 'view:zoomIn'],
  ['Mod++', key({ key: '+', code: 'Equal', mod: true, shift: true }), {}, 'view:zoomIn'],
  ['Mod+-', key({ key: '-', code: 'Minus', mod: true }), {}, 'view:zoomOut'],
  ['Shift+1', key({ key: '!', code: 'Digit1', shift: true }), {}, 'view:fit'],
  ['Shift+0', key({ key: ')', code: 'Digit0', shift: true }), {}, 'view:actualSize'],
  ['Space', key({ key: ' ', code: 'Space' }), {}, 'view:panHold'],
  // Load
  ['Mod+O', key({ key: 'o', code: 'KeyO', mod: true }), {}, 'load:open'],
  // Export
  ['Mod+C', key({ key: 'c', code: 'KeyC', mod: true }), {}, 'export:copy'],
  ['Mod+S', key({ key: 's', code: 'KeyS', mod: true }), {}, 'export:download'],
  // Help
  ['?', key({ key: '?', code: 'Slash', shift: true }), {}, 'help:shortcuts'],
];

describe('MOD-Keys: the RULE-19 map, row by row (F-013)', () => {
  for (const [label, k, s, expected] of RULE_19) {
    it(`RULE-19 F-013.R1 ${label} on the canvas: ${expected}, kept from the browser`, () => {
      const r = resolveKey(k, scope(s));
      expect(named(r)).toBe(expected);
      expect(r.preventDefault).toBe(true);
    });
  }

  it('F-013.AC1 A picks the arrow tool, R the rectangle and X the redaction tool', () => {
    expect(named(resolveKey(key({ key: 'a', code: 'KeyA' }), scope()))).toBe('tool:arrow');
    expect(named(resolveKey(key({ key: 'r', code: 'KeyR' }), scope({ tool: 'arrow' })))).toBe('tool:rectangle');
    expect(named(resolveKey(key({ key: 'x', code: 'KeyX' }), scope({ tool: 'rectangle' })))).toBe('tool:redact');
  });

  it('RULE-19 Mod+V is never kept from the browser, so the paste event fires (MOD-Keys)', () => {
    for (const focus of ['canvas', 'control'] as const)
      expect(resolveKey(key({ key: 'v', code: 'KeyV', mod: true }), scope({ focus }))).toEqual({
        preventDefault: false,
      });
  });

  it('RULE-19 Load, Export, History and Mod+= / Mod+- work on any control; Mod+O follows the US position too', () => {
    const control = scope({ focus: 'control' });
    expect(named(resolveKey(key({ key: 'o', code: 'KeyO', mod: true }), control))).toBe('load:open');
    expect(named(resolveKey(key({ key: 'щ', code: 'KeyO', mod: true }), control))).toBe('load:open');
    expect(named(resolveKey(key({ key: 'z', code: 'KeyZ', mod: true }), control))).toBe('history:undo');
    expect(named(resolveKey(key({ key: '=', code: 'Equal', mod: true }), control))).toBe('view:zoomIn');
    expect(named(resolveKey(key({ key: 'c', code: 'KeyC', mod: true }), control))).toBe('export:copy');
  });

  it('RULE-19 the single-character keys ?, Shift+1 and Shift+0, and the Tools, Canvas and Edit keys, act only on the canvas', () => {
    const control = scope({ focus: 'control', selection: 'one' });
    for (const k of [
      key({ key: '?', code: 'Slash', shift: true }),
      key({ key: '!', code: 'Digit1', shift: true }),
      key({ key: ')', code: 'Digit0', shift: true }),
      key({ key: 'r', code: 'KeyR' }),
      key({ key: 'Tab', code: 'Tab' }),
      key({ key: 'Enter', code: 'Enter' }),
      key({ key: 'Delete', code: 'Delete' }),
      key({ key: 'ArrowRight', code: 'ArrowRight' }),
      key({ key: ' ', code: 'Space' }),
    ])
      expect(resolveKey(k, control), k.key).toEqual({ preventDefault: false });
  });

  it('RULE-19 ? follows the typed character on every layout (a German Shift+ß types ?)', () => {
    expect(named(resolveKey(key({ key: '?', code: 'Minus', shift: true }), scope()))).toBe('help:shortcuts');
    expect(resolveKey(key({ key: '/', code: 'Slash' }), scope())).toEqual({ preventDefault: false });
  });

  it('F-013.R5 while a dialog or menu is open no key acts (Esc is the dialog’s own)', () => {
    const dialog = scope({ focus: 'dialog', selection: 'one' });
    for (const k of [
      key({ key: 'Delete', code: 'Delete' }),
      key({ key: 'r', code: 'KeyR' }),
      key({ key: '?', code: 'Slash', shift: true }),
      key({ key: 'Tab', code: 'Tab' }),
      key({ key: 's', code: 'KeyS', mod: true }),
    ])
      expect(resolveKey(k, dialog), k.key).toEqual({ preventDefault: false });
    // Mod+O does nothing but stays kept from the browser (its own open-file would leave the page).
    expect(resolveKey(key({ key: 'o', code: 'KeyO', mod: true }), dialog)).toEqual({ preventDefault: true });
  });

  it('F-013.R5 while text is edited only Esc and Mod+S act; Tab, ? and Mod+O are the field’s own', () => {
    for (const focus of ['text', 'textAnnotation'] as const) {
      const s = scope({ focus });
      expect(resolveKey(key({ key: 'Tab', code: 'Tab' }), s)).toEqual({ preventDefault: false });
      expect(resolveKey(key({ key: '?', code: 'Slash', shift: true }), s)).toEqual({ preventDefault: false });
      expect(resolveKey(key({ key: 'o', code: 'KeyO', mod: true }), s)).toEqual({ preventDefault: false });
      expect(named(resolveKey(key({ key: 's', code: 'KeyS', mod: true }), s))).toBe('export:download');
    }
  });

  it('F-013.AC7 Alt+Left with nothing selected is kept from the browser (no Back) and does nothing', () => {
    expect(resolveKey(key({ key: 'ArrowLeft', code: 'ArrowLeft', alt: true }), scope())).toEqual({
      preventDefault: true,
    });
  });

  it('RULE-19 Tab with Ctrl or Alt is the browser’s or the system’s own', () => {
    expect(resolveKey(key({ key: 'Tab', code: 'Tab', mod: true }), scope())).toEqual({ preventDefault: false });
    expect(resolveKey(key({ key: 'Tab', code: 'Tab', alt: true }), scope())).toEqual({ preventDefault: false });
  });
});

describe('MOD-Keys shortcutList (CMP-ShortcutHelp)', () => {
  const tr = (lang: 'en-US' | 'vi-VN') => (id: string) => {
    const v = (CATALOG[lang] as Record<string, unknown>)[id];
    if (typeof v !== 'string') throw new Error(`no plain COPY string ${id}`);
    return v;
  };
  const rows = (mac: boolean, lang: 'en-US' | 'vi-VN' = 'en-US') =>
    shortcutList(mac).flatMap((g) =>
      g.rows.map((r) => ({
        id: r.copyId,
        printed: keyText(r.printed, tr(lang)),
        spoken: keyText(r.spoken, tr(lang), true),
      })),
    );
  const byId = (mac: boolean, lang: 'en-US' | 'vi-VN' = 'en-US') =>
    new Map(rows(mac, lang).map((r) => [r.id, r] as const));

  it('F-013.AC8 lists every RULE-19 group in order, and every key of RULE-19 with its action', () => {
    expect(shortcutList(false).map((g) => g.copyId)).toEqual([
      'shortcuts.tools',
      'shortcuts.canvas',
      'shortcuts.edit',
      'shortcuts.history',
      'shortcuts.view',
      'shortcuts.pointer',
      'shortcuts.load',
      'shortcuts.export',
      'shortcuts.help',
    ]);
    expect(rows(false).map((r) => `${r.id}=${r.printed}`)).toEqual([
      'tool.select=V',
      'tool.rectangle=R',
      'tool.ellipse=O',
      'tool.arrow=A',
      'tool.line=L',
      'tool.pen=P',
      'tool.highlight=H',
      'tool.text=T',
      'tool.step=N',
      'tool.redact=X',
      'tool.crop=C',
      'shortcut.place=Enter',
      'shortcut.edit_text=Enter',
      'shortcut.next=Tab / Shift+Tab',
      'action.delete=Delete / Backspace',
      'action.duplicate=Ctrl+D',
      'shortcut.select_all=Ctrl+A',
      'action.bring_forward=]',
      'action.send_backward=[',
      'shortcut.move=← ↑ → ↓ / Shift+← ↑ → ↓',
      'shortcut.resize=Alt+← ↑ → ↓ / Alt+Shift+← ↑ → ↓',
      'shortcut.cancel=Esc',
      'action.undo=Ctrl+Z',
      'action.redo=Ctrl+Shift+Z / Ctrl+Y',
      'action.zoom_in=Ctrl+= / Ctrl++',
      'action.zoom_out=Ctrl+-',
      'action.zoom_fit=Shift+1',
      'action.zoom_actual=Shift+0',
      'shortcut.pan=Space+drag / ← ↑ → ↓ / Shift+← ↑ → ↓',
      'shortcut.zoom_pointer=Ctrl+wheel',
      'shortcut.move_while_drawing=Alt+drag',
      'shortcut.paste=Ctrl+V',
      'action.open=Ctrl+O',
      'action.copy=Ctrl+C',
      'action.download=Ctrl+S',
      'action.shortcuts=?',
    ]);
  });

  it('CMP-ShortcutHelp shows ⌘, ⌥ and ⇧ on macOS, with no Ctrl+Y alias', () => {
    const m = byId(true);
    expect(m.get('action.undo')?.printed).toBe('⌘Z');
    expect(m.get('action.redo')?.printed).toBe('⌘⇧Z');
    expect(m.get('shortcut.resize')?.printed).toBe('⌥← ↑ → ↓ / ⌥⇧← ↑ → ↓');
    expect(m.get('shortcut.move_while_drawing')?.printed).toBe('⌥ drag');
    expect(m.get('action.zoom_fit')?.printed).toBe('⇧1');
    expect(m.get('shortcut.next')?.printed).toBe('Tab / ⇧Tab');
    expect(m.get('action.undo')?.spoken).toBe('Command Z');
  });

  it('CMP-ShortcutHelp spoken key names: printed labels as words plus COPY-key.* (en-US)', () => {
    const m = byId(false);
    expect(m.get('action.shortcuts')?.spoken).toBe('question mark');
    expect(m.get('action.zoom_in')?.spoken).toBe('Ctrl equals, or Ctrl plus');
    expect(m.get('shortcut.move')?.spoken).toBe(
      'Left, Up, Right or Down arrow, or Shift Left, Up, Right or Down arrow',
    );
    expect(m.get('shortcut.pan')?.spoken).toBe(
      'Space plus drag, or Left, Up, Right or Down arrow, or Shift Left, Up, Right or Down arrow',
    );
    for (const mac of [false, true])
      for (const r of rows(mac)) {
        // Only printed key labels (letters, digits, brackets) and words; never the symbols alone.
        expect(r.spoken, r.id).not.toMatch(/[⌘⌥⇧←↑→↓]/);
      }
  });

  it('F-013.R3 in vi-VN the pointer words and spoken names are Vietnamese; only key labels stay as printed', () => {
    const m = byId(false, 'vi-VN');
    expect(m.get('shortcut.pan')?.printed).toBe('Space+kéo / ← ↑ → ↓ / Shift+← ↑ → ↓');
    expect(m.get('shortcut.zoom_pointer')?.printed).toBe('Ctrl+con lăn');
    expect(m.get('action.shortcuts')?.spoken).toBe('dấu chấm hỏi');
    expect(m.get('action.delete')?.spoken).toBe('Delete, hoặc Backspace');
    for (const r of rows(false, 'vi-VN')) {
      expect(r.printed, r.id).not.toMatch(/\b(drag|wheel|arrows?)\b/);
      expect(r.spoken, r.id).not.toMatch(/\b(or|plus|minus|equals|question|drag|wheel|arrows?)\b/);
    }
  });

  it('CMP-ShortcutHelp every group, entry and key word is a COPY ID of the catalog (MOD-Keys holds no copy)', () => {
    const catalog = CATALOG['en-US'] as Record<string, unknown>;
    for (const mac of [false, true])
      for (const g of shortcutList(mac)) {
        expect(catalog[g.copyId], g.copyId).toBeDefined();
        for (const r of g.rows) {
          expect(typeof catalog[r.copyId], r.copyId).toBe('string');
          for (const p of [...r.printed, ...r.spoken])
            if (typeof p !== 'string') expect(typeof catalog[p.copyId], p.copyId).toBe('string');
        }
      }
  });
});
