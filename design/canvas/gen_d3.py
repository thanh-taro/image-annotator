"""Generates the D3 artboards: SCR-Annotator states at embedded 1200 (reuses gen_d2 parts).

Run: python3 design/canvas/gen_d3.py  (writes into design/canvas/project/)
'default' and 'editing-text' are Main.dc.html and FLOW-01_step3.dc.html (D2).
"""
import os
import gen_d2 as g

OUT = g.OUT

EXTRA_CSS = """.tk-dark{--danger:#FF8595;--dangerBg:#3A1622;--scrim:#07050BB3;--cropDim:#07050BA6}
.tk-light{--danger:#C0243B;--dangerBg:#FCE8EC;--scrim:#16111F66;--cropDim:#16111F8C}
.app{position:relative}
.n.err{background:var(--dangerBg);border-color:var(--danger)}
.n .nb{height:28px;flex:none;display:inline-flex;align-items:center;padding:0 12px;border:1px solid var(--danger);border-radius:7px;background:transparent;color:var(--fg);font:600 13px Manrope,sans-serif}
.ring{display:none;stroke-dasharray:2 4}
@media (prefers-reduced-motion:reduce){.spin .arc{display:none}.spin .ring{display:inline}}
.empty{position:absolute;inset:24px;border:2px dashed var(--muted);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:var(--fg)}
.empty h2{font:700 17px Manrope,sans-serif;margin:0}
.empty p{font:500 14px/1.55 Manrope,sans-serif;color:var(--muted);margin:0;max-width:360px}
kbd{font:500 12px 'JetBrains Mono',monospace;padding:0 4px;border:1px solid var(--lineStrong);border-bottom-width:2px;border-radius:7px;color:var(--fg);background:var(--surface);white-space:nowrap}
.ebtn{height:32px;display:inline-flex;align-items:center;gap:8px;padding:0 12px;border:1px solid var(--lineStrong);border-radius:7px;background:var(--surface);color:var(--fg);font:600 13px Manrope,sans-serif}
.empty~.n{bottom:40px}
.zslot{display:inline-block;width:40px}
.bgw{display:contents}
.help .hb:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.chip{position:absolute;padding:4px 8px;border-radius:7px;background:var(--surface);color:var(--fg);border:1px solid var(--lineStrong);font:500 12px 'JetBrains Mono',monospace;white-space:nowrap}
.dim{position:absolute;background:var(--cropDim)}
.scrim{position:absolute;inset:0;background:var(--scrim);display:flex;align-items:center;justify-content:center;z-index:5}
.dlg{position:relative;width:420px;max-width:calc(100% - 32px);box-sizing:border-box;padding:16px;background:var(--surface);border:1px solid var(--lineStrong);border-radius:10px;color:var(--fg)}
.dlg h2{margin:0 0 8px;font:700 17px Manrope,sans-serif}
.dlg p{margin:0 0 16px;font:500 13px/1.5 Manrope,sans-serif;color:var(--muted);text-wrap:pretty}
.drow{display:flex;justify-content:flex-end;gap:8px}
.dbtn{height:32px;display:inline-flex;align-items:center;padding:0 12px;border:1px solid var(--lineStrong);border-radius:7px;background:transparent;color:var(--fg);font:600 13px Manrope,sans-serif}
.dbtn.quiet{border-color:transparent}
.dbtn.dng{border-color:var(--danger);color:var(--danger)}
.focus{outline:2px solid var(--accent);outline-offset:2px}
.help{width:640px;max-height:calc(100% - 32px);display:flex;flex-direction:column;padding:16px}
.help .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex:none}
.help .hd h2{margin:0}
.help .note{margin:0 0 12px;font:500 12px/1.55 Manrope,sans-serif;color:var(--muted);flex:none}
.help .hb{flex:1 1 auto;overflow-y:auto;min-height:0;display:grid;grid-template-columns:1fr 1fr;column-gap:24px;align-items:start;border-top:1px solid var(--line);padding-top:12px;background:linear-gradient(var(--surface) 30%,transparent) center top/100% 40px no-repeat local,linear-gradient(transparent,var(--surface) 70%) center bottom/100% 40px no-repeat local,radial-gradient(farthest-side at 50% 0,var(--lineStrong),transparent) center top/100% 12px no-repeat scroll,radial-gradient(farthest-side at 50% 100%,var(--lineStrong),transparent) center bottom/100% 12px no-repeat scroll}
.grp{break-inside:avoid;margin:0 0 12px}
.grp h3{margin:0 0 4px;font:600 12px Manrope,sans-serif;color:var(--muted)}
.grp ul{list-style:none;margin:0;padding:0}
.r{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:24px;border-bottom:1px solid var(--line);font:500 12px Manrope,sans-serif}
.dx{width:32px;height:32px;border:0;background:transparent;color:var(--muted);border-radius:7px;display:inline-flex;align-items:center;justify-content:center;padding:0}
.drop{position:absolute;inset:0;background:color-mix(in srgb,var(--workArea) 88%,transparent);z-index:6}
.drop .zone{position:absolute;inset:12px;border:2px dashed var(--fg);border-radius:10px;display:flex;align-items:center;justify-content:center}
.drop .pill2{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:10px;background:var(--surface);border:1px solid var(--lineStrong);color:var(--fg);font:700 18px Manrope,sans-serif}"""

CSS = g.CSS + '\n' + EXTRA_CSS
svg = g.svg


def toolbar_empty():
    t = ''.join(f'<button class="ib" disabled aria-pressed="false" aria-label="{lab}" data-copy="COPY-tool.shortcut_hint">{svg(f"<path d=\'{d}\'/>")}</button>' for k, lab, d in g.TOOLS)
    return f'''<div class="tb" role="toolbar" aria-label="Tools and actions" data-copy="COPY-a11y.toolbar">
<button class="tbtn" data-copy="COPY-action.open" aria-keyshortcuts="Control+O">{svg(g.I_OPEN, 16)}Open image</button>
<div class="sep"></div>
{t}
<div class="sep"></div>
<button class="ib" disabled aria-label="Undo" aria-keyshortcuts="Control+Z" data-copy="COPY-action.undo">{svg(g.I_UNDO)}</button>
<button class="ib" disabled aria-label="Redo" aria-keyshortcuts="Control+Shift+Z Control+Y" data-copy="COPY-action.redo">{svg(g.I_REDO)}</button>
<div style="flex:1"></div>
<button class="tbtn primary" disabled data-copy="COPY-action.copy" aria-keyshortcuts="Control+C">{svg(g.I_COPY, 16)}Copy</button>
<button class="tbtn" disabled data-copy="COPY-action.download" aria-keyshortcuts="Control+S">{svg(g.I_DL, 16)}Download</button>
<button class="ib" aria-label="More actions" aria-haspopup="menu" aria-expanded="false" data-copy="COPY-action.more"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg></button>
</div>'''


STATUS_EMPTY = f'''<footer class="st">
<button class="ok" data-copy="COPY-privacy.badge" aria-haspopup="dialog" aria-expanded="false">{svg(g.I_SHIELD, 16)}Runs locally, nothing uploaded</button>
<a class="lnk" href="https://github.com/thanh-taro/image-annotator" target="_blank" rel="noopener" data-copy="COPY-privacy.source_label"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="{g.GH}"/></svg>Source code on GitHub<span class="sr" data-copy="COPY-a11y.new_tab">(opens in a new tab)</span></a>
<div style="flex:1"></div>
<button class="zb" disabled aria-label="Zoom out" data-copy="COPY-action.zoom_out">{svg('<path d="M5 12h14"/>', 16)}</button>
<span class="zslot" aria-hidden="true"></span>
<button class="zb" disabled aria-label="Zoom in" data-copy="COPY-action.zoom_in">{svg('<path d="M5 12h14M12 5v14"/>', 16)}</button>
<button class="tbtn" disabled data-copy="COPY-action.zoom_fit">Fit to view</button><button class="tbtn" disabled data-copy="COPY-action.zoom_actual">Actual size</button>
</footer>'''

EMPTY = f'''<div class="empty">
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" style="color:var(--muted)"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>
<h2 data-copy="COPY-load.empty_title">Paste, drop or open an image</h2>
<p data-copy="COPY-load.click_to_paste">Click here, then press <kbd>Ctrl+V</kbd> to paste, or choose Open image.</p>
<button class="ebtn" data-copy="COPY-action.open">{svg(g.I_OPEN, 16)}Open image</button>
</div>'''


def notice(kind, copy_id, text, action=None):
    if kind == 'progress':
        icon = ('<svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" style="color:var(--accent);flex:none">'
                '<path class="arc" d="M12 3a9 9 0 019 9"/><circle class="ring" cx="12" cy="12" r="9"/></svg>')
        return f'<div class="n">{icon}<p data-copy="{copy_id}">{text}</p></div>'
    icon = ('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" style="color:var(--danger);flex:none">'
            '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>')
    act = f'<button class="nb" data-copy="{action[0]}">{action[1]}</button>' if action else ''
    return (f'<div class="n err">{icon}<p data-copy="{copy_id}">{text}</p>{act}'
            f'<button class="x" aria-label="Close" data-copy="COPY-action.close">{svg(g.I_X, 16)}</button></div>')


def panel_multi():
    return ('<aside class="panel" aria-label="Style" data-copy="COPY-a11y.style_panel">'
            '<div class="sub" style="font-size:13px;padding-bottom:8px;border-bottom:1px solid var(--line)" data-copy="COPY-a11y.selected_count">2 annotations selected</div>'
            + g.color_sec(0) + g.size_seg(1) + g.ACTS4 + '</aside>')


def panel_canvas_padded():
    names = [('COPY-canvas.padding_none', 'None'), ('COPY-style.size_s', 'Small'), ('COPY-style.size_m', 'Medium'), ('COPY-style.size_l', 'Large')]
    seg = ''.join(f'<button{" class=\'on\'" if i == 2 else ""} role="radio" aria-checked="{"true" if i == 2 else "false"}" data-copy="{c}">{n}</button>' for i, (c, n) in enumerate(names))
    bg = ''.join(f'<button class="sw{" on" if n == "White" else ""}" role="radio" aria-checked="{"true" if n == "White" else "false"}" aria-label="{n}" data-copy="COPY-color.{n.lower()}" style="background:var(--ann-{n.lower()})"></button>' for n, h in g.PAL)
    return ('<aside class="panel" aria-label="Style" data-copy="COPY-a11y.style_panel">'
            f'<div class="sec"><div class="ph" data-copy="COPY-canvas.padding">Padding</div><div class="seg seg4" role="radiogroup" aria-label="Padding" data-copy="COPY-canvas.padding">{seg}</div></div>'
            '<div class="sec"><div class="ph" data-copy="COPY-canvas.background">Background</div><div class="sws" role="radiogroup" aria-label="Background" data-copy="COPY-canvas.background">'
            '<button class="sw" role="radio" aria-checked="false" aria-label="Transparent" data-copy="COPY-canvas.transparent" style="background-color:var(--checkerA);background-image:linear-gradient(45deg,var(--checkerB) 25%,transparent 25%,transparent 75%,var(--checkerB) 75%),linear-gradient(45deg,var(--checkerB) 25%,transparent 25%,transparent 75%,var(--checkerB) 75%);background-size:8px 8px;background-position:0 0,4px 4px"></button>'
            f'{bg}</div></div></aside>')


# Crop frame (inner units) and its image-pixel size
CROP = (12, 52, 700, 280)


def panel_crop():
    x, y, w, h = CROP
    return ('<aside class="panel" aria-label="Style" data-copy="COPY-a11y.style_panel">'
            f'<div class="sec"><div class="ph" data-copy="COPY-tool.crop">Crop</div><div class="mono" style="font-size:13px" data-copy="COPY-crop.size">{g.ip(w):,} × {g.ip(h):,} px</div></div>'
            '<fieldset class="sec" style="border:0;margin:0;padding:0"><legend class="ph" style="padding:0;margin-bottom:8px" data-copy="COPY-geometry.title">Position and size</legend><div class="fields">'
            + g.field('COPY-geometry.x', 'X', g.ip(x)) + g.field('COPY-geometry.y', 'Y', g.ip(y)) + g.field('COPY-geometry.width', 'Width', g.ip(w)) + g.field('COPY-geometry.height', 'Height', g.ip(h))
            + '</div></fieldset><button class="btn" data-copy="COPY-action.crop_reset">Reset crop</button></aside>')


def crop_overlay():
    x, y, w, h = CROP
    L, T, R, B = g.sx(x), g.sy(y), g.sx(x + w), g.sy(y + h)
    iL, iT, iR, iB = g.IMG_LEFT, g.IMG_TOP, g.IMG_LEFT + 878, g.IMG_TOP + 549
    d = (f'<div class="dim" style="left:{iL}px;top:{iT}px;width:878px;height:{T-iT:.1f}px"></div>'
         f'<div class="dim" style="left:{iL}px;top:{T}px;width:{L-iL:.1f}px;height:{B-T:.1f}px"></div>'
         f'<div class="dim" style="left:{R}px;top:{T}px;width:{iR-R:.1f}px;height:{B-T:.1f}px"></div>'
         f'<div class="dim" style="left:{iL}px;top:{B}px;width:878px;height:{iB-B:.1f}px"></div>')
    frame = f'<div class="sel" style="left:{L}px;top:{T}px;width:{R-L:.1f}px;height:{B-T:.1f}px"></div>'
    hs = ''
    for hx in (L, (L + R) / 2, R):
        for hy in (T, (T + B) / 2, B):
            if hx == (L + R) / 2 and hy == (T + B) / 2:
                continue
            hs += f'<div class="h" style="left:{hx-5:.1f}px;top:{hy-5:.1f}px"></div>'
    return d + frame + hs


def crop_chip():
    x, y, w, h = CROP
    L, R, B = g.sx(x), g.sx(x + w), g.sy(y + h)
    return f'<span class="chip" aria-hidden="true" style="left:{(L+R)/2-52:.1f}px;top:{B+12:.1f}px" data-copy="COPY-crop.size">{g.ip(w):,} × {g.ip(h):,} px</span>'


def multi_overlay():
    x, y, w, h = g.RECT
    out = f'<div class="sel" style="left:{g.sx(x)-4}px;top:{g.sy(y)-4}px;width:{w*g.K+8:.1f}px;height:{h*g.K+8:.1f}px"></div>'
    tx, ty, _ = g.TEXTA
    tw, th = 202 * g.K, g.TEXT * 1.25 * g.K
    out += f'<div class="sel" style="left:{g.sx(tx)-4}px;top:{g.sy(ty)-4}px;width:{tw+8:.1f}px;height:{th+8:.1f}px"></div>'
    return out


# Padded canvas (RULE-14 M = round(0.06 x 1,756) = 105 px; canvas 1,966 x 1,308 fitted at 44.7 %)
F = 878 / 1966
PAD = round(105 * F)
CANVAS_H = round(1308 * F)
IMG_W, IMG_H = 1756 * F, 1098 * F


def padded_image(annots):
    top = (688 - CANVAS_H) // 2
    return (f'<div class="img" style="top:{top}px;height:{CANVAS_H}px;background:var(--ann-white)">'
            f'<div style="position:absolute;left:{PAD}px;top:{PAD}px;width:{IMG_W:.1f}px;height:{IMG_H:.1f}px;overflow:hidden">'
            + g.sample(annots).replace('class="inner"', f'class="inner" style="transform:scale({IMG_W/720:.5f})"', 1)
            + '</div></div>')


SHORTCUTS = [
    ('COPY-shortcuts.tools', 'Tools', [('COPY-tool.' + k, lab.split(' (')[0], lab[-2], lab[-2]) for k, lab, d in g.TOOLS]),
    ('COPY-shortcuts.canvas', 'Canvas', [('COPY-shortcut.place', 'Place an annotation', 'Enter', 'Enter'), ('COPY-shortcut.edit_text', 'Edit selected text', 'Enter', 'Enter'),
                                         ('COPY-shortcut.next', 'Next / previous annotation', 'Tab / Shift+Tab', 'Tab, or Shift Tab')]),
    ('COPY-shortcuts.edit', 'Edit', [('COPY-action.delete', 'Delete', 'Delete / Backspace', 'Delete, or Backspace'), ('COPY-action.duplicate', 'Duplicate', 'Ctrl+D', 'Control D'),
                                     ('COPY-shortcut.select_all', 'Select all', 'Ctrl+A', 'Control A'), ('COPY-action.bring_forward', 'Bring forward', ']', 'right bracket'),
                                     ('COPY-action.send_backward', 'Send backward', '[', 'left bracket'), ('COPY-shortcut.move', 'Move selection', '← ↑ → ↓', 'arrow keys; with Shift, 10 pixels'),
                                     ('COPY-shortcut.resize', 'Resize selection', 'Alt+arrows', 'Alt plus arrow keys'), ('COPY-shortcut.cancel', 'Cancel, finish editing, deselect', 'Esc', 'Escape')]),
    ('COPY-shortcuts.history', 'History', [('COPY-action.undo', 'Undo', 'Ctrl+Z', 'Control Z'), ('COPY-action.redo', 'Redo', 'Ctrl+Shift+Z / Ctrl+Y', 'Control Shift Z, or Control Y')]),
    ('COPY-shortcuts.view', 'View', [('COPY-action.zoom_in', 'Zoom in', 'Ctrl+=', 'Control equals'), ('COPY-action.zoom_out', 'Zoom out', 'Ctrl+-', 'Control minus'),
                                     ('COPY-action.zoom_fit', 'Fit to view', 'Shift+1', 'Shift 1'), ('COPY-action.zoom_actual', 'Actual size', 'Shift+0', 'Shift 0'),
                                     ('COPY-shortcut.pan', 'Pan the view', 'Space+drag', 'Space plus drag'), ('COPY-shortcut.zoom_pointer', 'Zoom at pointer', 'Ctrl+wheel', 'Control plus wheel')]),
    ('COPY-shortcuts.pointer', 'Pointer', [('COPY-shortcut.move_while_drawing', 'Move while drawing', 'Alt+drag', 'Alt plus drag')]),
    ('COPY-shortcuts.load', 'Open', [('COPY-shortcut.paste', 'Paste an image', 'Ctrl+V', 'Control V'), ('COPY-action.open', 'Open image', 'Ctrl+O', 'Control O')]),
    ('COPY-shortcuts.export', 'Export', [('COPY-action.copy', 'Copy', 'Ctrl+C', 'Control C'), ('COPY-action.download', 'Download', 'Ctrl+S', 'Control S')]),
    ('COPY-shortcuts.help', 'Help', [('COPY-action.shortcuts', 'Keyboard shortcuts', '?', 'question mark')]),
]


def help_dialog():
    cols = {0: '', 1: ''}
    for gid, name, rows in SHORTCUTS:
        lis = ''.join(f'<li class="r"><span data-copy="{rid}">{lab}</span><kbd aria-hidden="true">{keys}</kbd><span class="sr">{spoken}</span></li>' for rid, lab, keys, spoken in rows)
        col = 1 if gid in ('COPY-shortcuts.edit', 'COPY-shortcuts.history', 'COPY-shortcuts.view', 'COPY-shortcuts.export') else 0
        cols[col] += f'<section class="grp"><h3 data-copy="{gid}">{name}</h3><ul>{lis}</ul></section>'
    groups = f'<div>{cols[0]}</div><div>{cols[1]}</div>'
    return (f'<div class="scrim"><div class="dlg help" role="dialog" aria-modal="true" aria-labelledby="sh-{{{{t.name}}}}">'
            f'<div class="hd"><h2 id="sh-{{{{t.name}}}}" data-copy="COPY-shortcuts.title">Keyboard shortcuts</h2><button class="dx focus" aria-label="Close" data-copy="COPY-action.close">{svg(g.I_X, 16)}</button></div>'
            '<p class="note" data-copy="COPY-shortcuts.scope_note">Single-key and editing shortcuts work while the image has focus.</p>'
            f'<div class="hb" tabindex="0">{groups}</div></div></div>')


def confirm_replace():
    return ('<div class="scrim"><div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="r-{{t.name}}" aria-describedby="rd-{{t.name}}">'
            '<h2 id="r-{{t.name}}" data-copy="COPY-confirm.replace_title">Replace this image?</h2>'
            '<p id="rd-{{t.name}}" data-copy="COPY-confirm.replace">Your changes haven\'t been copied or downloaded. They will be lost.</p>'
            '<div class="drow"><button class="dbtn quiet focus" data-copy="COPY-action.cancel">Cancel</button><button class="dbtn dng" data-copy="COPY-action.replace">Replace</button></div></div></div>')


DROP = ('<div class="drop"><div class="zone"><div class="pill2" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" style="color:var(--accent)">'
        '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><span data-copy="COPY-load.drop_here">Drop to open</span></div></div></div>')


ITEMS_ALL = [g.item('Rectangle', g.RECT), g.item('Arrow', g.ARROW[0]), g.text_item(), g.item('Solid (secure)', g.RED_EMAIL), g.item('Solid (secure)', g.RED_TOKEN)]


def screen(s):
    """Like gen_d2.screen, with an empty state, custom panels/images, overlays over the whole app and dialogs."""
    if s.get('empty'):
        work = f'''<div class="work" role="region" aria-label="Image canvas" data-copy="COPY-a11y.canvas">
{EMPTY}
<div class="sr" role="status" aria-live="polite"{f' data-copy="{s["live"][0]}"' if s.get("live") else ''}>{s["live"][1] if s.get("live") else ''}</div>
<div class="sr" role="alert"></div>
{s.get('notice', '')}
</div>'''
        return f'<div class="app">\n{toolbar_empty()}\n<main class="body">\n{work}\n</main>\n{STATUS_EMPTY}\n{s.get("app_over", "")}\n</div>'
    items = s.get('items', ITEMS_ALL)
    n = len(items)
    size = s.get('size', '1,756 × 1,098')
    summary = f'{size} px canvas, {n} annotation{"" if n == 1 else "s"}'
    opts = ''.join(f'<div role="option" id="an{k}-{{{{t.name}}}}" tabindex="{0 if sel else -1}" aria-selected="{"true" if sel else "false"}" data-copy="{cid}">{txt}</div>' for k, (cid, txt, sel) in enumerate(items))
    listbox = (f'<div class="sr" role="listbox" aria-multiselectable="true" aria-label="Annotations" data-copy="COPY-a11y.annotations_list" aria-describedby="ah-{{{{t.name}}}}">'
               f'<span class="sr" id="ah-{{{{t.name}}}}" data-copy="COPY-a11y.annotations_hint">Tab moves to the next annotation; arrow keys move the selected one.</span>{opts}</div>')
    live, alert = s.get('live'), s.get('alert')
    live_html = f'<div class="sr" role="status" aria-live="polite"{f" data-copy=\"{live[0]}\"" if live else ""}>{live[1] if live else ""}</div>'
    alert_html = f'<div class="sr" role="alert"{f" data-copy=\"{alert[0]}\"" if alert else ""}>{alert[1] if alert else ""}</div>'
    image = s.get('image') or f'<div class="img">{g.sample(g.ALL)}</div>'
    inert = ' inert' if s.get('modal') else ''
    return f'''<div class="app">
<div class="bgw"{inert}>
{g.toolbar(s['tool'], s.get('count', 2))}
<main class="body">
{s['panel']}
<div class="work" role="region" tabindex="{-1 if any(x[2] for x in items) else 0}" aria-label="Image canvas" aria-describedby="cs-{{{{t.name}}}}" data-copy="COPY-a11y.canvas">
<span class="sr" id="cs-{{{{t.name}}}}" data-copy="COPY-a11y.canvas_summary">{summary}</span>
{image}
<div class="ov" aria-hidden="true">{s.get('overlay', '')}</div>
{s.get('chip', '')}
{listbox}
{live_html}
{alert_html}
{s.get('notice', '')}
</div>
</main>
{s.get('status', g.STATUS).replace('>1,756 × 1,098 px<', f'>{size} px<')}
</div>
{s.get('app_over', '')}
</div>'''


def board(state, label, s):
    g.screen, g.CSS = screen, CSS          # reuse the D2 board template with this module's screen and CSS
    return g.board(ST.format(state), label, s)


ST = 'SCR-Annotator / {} / embedded 1200'
STATES = {
    'empty': ('empty (embedded, tool not focused yet: click_to_paste hint; tools, export and zoom disabled; style panel hidden; focused hint: CMP-EmptyState)', dict(empty=True)),
    'canvas-settings': ('canvas-settings (select tool, nothing selected; padding Medium on a white background; zoom refits to 45 %)', dict(
        tool='select', panel=panel_canvas_padded(), image=padded_image(g.ALL), size='1,966 × 1,308',
        status=g.STATUS.replace('>50 %<', '>45 %<'))),
    'selecting': ('selecting (two selected: outlines, no handles; panel shows shared choices; a single selection with handles is FLOW-01 step 2)', dict(
        tool='select', panel=panel_multi(), overlay=multi_overlay(),
        items=[g.item('Rectangle', g.RECT, True), g.item('Arrow', g.ARROW[0]), g.text_item(True), g.item('Solid (secure)', g.RED_EMAIL), g.item('Solid (secure)', g.RED_TOKEN)],
        live=('COPY-a11y.selected_count', '2 annotations selected'))),
    'cropping': ('cropping (crop tool; outside dimmed but kept; frame size below the frame; status shows the frame size)', dict(
        tool='crop', size='1,707 × 683', panel=panel_crop(), overlay=crop_overlay(), chip=crop_chip(), live=('COPY-a11y.tool_active', 'Crop tool'))),
    'dragging-file': ('dragging-file (drop overlay over the whole tool)', dict(
        tool='arrow', panel=g.panel('tool-arrow'), app_over=DROP, live=('COPY-load.drop_here', 'Drop to open'))),
    'loading': ('loading (decoding over 0.5 s; shown over the empty state; over an image it sits like the exporting notice)', dict(
        empty=True, notice=notice('progress', 'COPY-load.loading', 'Opening image…'), live=('COPY-load.loading', 'Opening image…'))),
    'exporting': ('exporting (export over 0.5 s; editing stays available)', dict(
        tool='arrow', panel=g.panel('tool-arrow'), notice=notice('progress', 'COPY-export.preparing', 'Preparing image…'), live=('COPY-export.preparing', 'Preparing image…'))),
    'error': ('error (clipboard blocked; Download offered; stays until dismissed or the next action; load errors use the same notice, see CMP-Notice)', dict(
        tool='arrow', panel=g.panel('tool-arrow'), notice=notice('error', 'COPY-error.clipboard', 'The browser blocked copying the image. Download it instead.', ('COPY-action.download', 'Download')),
        alert=('COPY-error.clipboard', 'The browser blocked copying the image. Download it instead.'))),
    'shortcut-help': ('shortcut-help (over default; focus on Close; the rest of the tool inert)', dict(
        tool='arrow', modal=True, panel=g.panel('tool-arrow'), app_over=help_dialog())),
    'confirm-replace': ('confirm-replace (over default; another image pasted with unexported changes; focus on Cancel; the rest of the tool inert)', dict(
        tool='arrow', modal=True, panel=g.panel('tool-arrow'), app_over=confirm_replace())),
}

if __name__ == '__main__':
    for state, (desc, s) in STATES.items():
        fn = f'SCR-Annotator_{state}_embedded.dc.html'
        with open(os.path.join(OUT, fn), 'w') as f:
            f.write(board(state, ST.format(desc), s))
        print('wrote', fn)
