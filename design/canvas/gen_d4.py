"""Generates the D4 artboards: narrow 390 states (incl. vi-VN) and FLOW-02 steps (embedded 1200).

Run: python3 design/canvas/gen_d4.py  (writes into design/canvas/project/)
Reuses gen_d2 (tokens, icons, panels) and gen_d3 (screen with custom image/panel, empty state).
Text comes from specs/30-experience/copy.md so the vi-VN board stays in step with the spec.
"""
import os
import re
import gen_d2 as g
import gen_d3 as d3

OUT = g.OUT
svg = g.svg
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def load_copy():
    rows = {}
    for line in open(os.path.join(ROOT, 'specs/30-experience/copy.md'), encoding='utf-8'):
        m = re.match(r'\| \*\*(COPY-[\w.]+)\*\* \| (.*?) \| (.*?) \|', line)
        if m:
            rows[m.group(1)] = {'en': m.group(2), 'vi': m.group(3)}
    return rows


COPY = load_copy()


def tr(cid, lang, **kw):
    """Copy text in a language; plural strings use their 'other' form."""
    s = COPY[cid][lang]
    if 'other:' in s:
        s = s.split('other:')[1].strip()
    for k, v in kw.items():
        s = s.replace('{' + k + '}', str(v))
    return s


def num(n, lang):
    return f'{n:,}'.replace(',', '.') if lang == 'vi' else f'{n:,}'


# ---------------------------------------------------------------- narrow 390

NW, NH = 390, 760
WORK_W, WORK_H = 388, 564          # 760 - 2 border - 97 toolbar - 1 - 48 summary bar - 48 status
NK = 356 / 720                     # inner -> screen (fit: 356 / 1,756 = 20 %)
NL, NT = 16, 170                   # image position in the work area


def at(top, fn, *a):
    """Build fn(*a) with the image at another top (the view moves above an open sheet)."""
    global NT
    old, NT = NT, top
    try:
        return fn(*a)
    finally:
        NT = old


def nsx(x): return round(NL + x * NK, 1)
def nsy(y): return round(NT + y * NK, 1)


NCSS = """.nw{width:390px;height:760px}
.ntb{flex:none;background:var(--surface);border-bottom:1px solid var(--line);position:relative}
.ntb .r{height:48px;display:flex;align-items:center;gap:4px;padding:0 4px;box-sizing:border-box}
.ntb .r+.r{border-top:1px solid var(--line)}
.ntb .ib{width:44px;height:44px}
.ntb .tbtn{height:44px}
.ntb .scroll{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;gap:8px}
.ntb .fade{position:absolute;right:0;bottom:0;width:24px;height:48px;background:linear-gradient(90deg,transparent,var(--surface) 85%);pointer-events:none;display:flex;align-items:center;justify-content:flex-end;color:var(--muted)}
.nbody{flex:1;display:flex;flex-direction:column;min-height:0;position:relative}
.nbody .work{order:1}
.npanel{order:2;flex:none;height:48px;position:relative;z-index:3}
.npanel .in{position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-top:1px solid var(--line);display:flex;flex-direction:column}
.npanel.open .in{border:1px solid var(--lineStrong);border-bottom:0;border-radius:10px 10px 0 0}
.sbar{height:47px;flex:none;width:100%;display:flex;align-items:center;gap:8px;padding:0 16px;border:0;background:transparent;color:var(--fg);font:600 13px Manrope,sans-serif;text-align:left}
.sbar .chip2{width:16px;height:16px;border-radius:999px;border:1px solid var(--lineStrong);box-sizing:border-box;flex:none}
.sbar .chev{margin-left:auto;color:var(--muted);display:inline-flex}
.sheet{max-height:235px;overflow-y:auto;padding:4px 16px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;border-top:1px solid var(--line);-webkit-mask-image:linear-gradient(#000 calc(100% - 24px),transparent);mask-image:linear-gradient(#000 calc(100% - 24px),transparent)}
.sheet>*{flex:none}
.sheet .sec:first-child{padding-top:8px}
.ntb .fadeL{position:absolute;left:0;bottom:0;width:24px;height:48px;background:linear-gradient(270deg,transparent,var(--surface) 85%);pointer-events:none}
.sheet .sws .sw{width:44px;height:44px}
.sheet .seg button{height:44px}
.sheet .btn{height:44px}
.sheet .fields{gap:8px 24px}
.sheet .fl input{width:72px;height:44px}
.st.nar{height:48px;gap:4px;padding:0 4px}
.st.nar .ok,.st.nar .lnk,.st.nar .zb{min-width:44px;min-height:44px;width:auto;height:44px;justify-content:center}
.st.nar .tbtn{height:44px}
.nw .empty{inset:16px}
.nw .empty p{max-width:300px}
.nw .ebtn{height:44px}
.nw .img{left:16px;width:356px;height:222.6px}
.nw .chip{font-size:12px}"""

I_MORE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>'
I_REDACT_PILL = "<rect x='3' y='8' width='18' height='8' rx='2' fill='currentColor'/>"
TOOL_IDS = [k for k, _, _ in g.TOOLS]


def ntoolbar(lang, active=None, count=0, empty=False, scrolled=False):
    dis = ' disabled' if empty else ''
    tools = ''
    for k, lab, d in g.TOOLS:
        key = lab[-2]
        name = tr('COPY-tool.shortcut_hint', lang, tool=tr('COPY-tool.' + k, lang), key=key)
        on = k == active
        ml = ' style="margin-left:-184px"' if scrolled and not tools else ''   # scrolled to the end: 11 x 44 + 10 x 8 - 380
        tools += (f'<button class="ib{" on" if on else ""}"{dis}{ml} aria-pressed="{"true" if on else "false"}" aria-label="{name}" data-copy="COPY-tool.shortcut_hint">'
                  f'{svg(f"<path d=\'{d}\'/>")}</button>')
    pill = ''
    if count:
        full = tr('COPY-export.redaction_count', lang, count=count)
        if lang == 'vi':   # count fallback (CMP-Toolbar): icon + number, full text as the name
            pill = f'<span class="pill" role="img" aria-label="{full}" data-copy="COPY-export.redaction_count">{svg(I_REDACT_PILL, 16, "aria-hidden=\'true\'")}{count}</span>'
        else:
            pill = f'<span class="pill" data-copy="COPY-export.redaction_count">{svg(I_REDACT_PILL, 16, "aria-hidden=\'true\'")}{full}</span>'
    return f'''<div class="ntb" role="toolbar" aria-label="{tr('COPY-a11y.toolbar', lang)}" data-copy="COPY-a11y.toolbar">
<div class="r">
<button class="ib" aria-label="{tr('COPY-action.open', lang)}" aria-keyshortcuts="Control+O" data-copy="COPY-action.open">{svg(g.I_OPEN)}</button>
<button class="ib"{dis} aria-label="{tr('COPY-action.undo', lang)}" aria-keyshortcuts="Control+Z" data-copy="COPY-action.undo">{svg(g.I_UNDO)}</button>
<button class="ib" disabled aria-label="{tr('COPY-action.redo', lang)}" aria-keyshortcuts="Control+Shift+Z Control+Y" data-copy="COPY-action.redo">{svg(g.I_REDO)}</button>
<div style="flex:1"></div>
{pill}
<button class="tbtn primary"{dis} data-copy="COPY-action.copy" aria-keyshortcuts="Control+C">{tr('COPY-action.copy', lang)}</button>
<button class="ib" aria-label="{tr('COPY-action.more', lang)}" aria-haspopup="menu" aria-expanded="false" data-copy="COPY-action.more">{I_MORE}</button>
</div>
<div class="r scroll">{tools}</div>
{'<div class="fadeL" aria-hidden="true"></div>' if scrolled else '<div class="fade" aria-hidden="true">' + svg('<path d="M9 6l6 6-6 6"/>', 16) + '</div>'}
</div>'''


def nstatus(lang, zoom=None):
    dis = '' if zoom else ' disabled'
    mid = (f'<button class="tbtn mono" aria-haspopup="menu" aria-expanded="false" aria-label="{tr("COPY-a11y.zoom_menu", lang, percent=zoom)}" data-copy="COPY-a11y.zoom_menu">'
           f'<span data-copy="COPY-status.zoom">{zoom} %</span>{svg("<path d=\'M7 10l5 5 5-5\'/>", 16)}</button>') if zoom else '<span class="zslot" aria-hidden="true"></span>'
    return f'''<footer class="st nar">
<button class="ok" aria-label="{tr('COPY-privacy.badge_label', lang)}" data-copy="COPY-privacy.badge_label" aria-haspopup="dialog" aria-expanded="false">{svg(g.I_SHIELD, 16)}</button>
<a class="lnk" href="https://github.com/thanh-taro/image-annotator" target="_blank" rel="noopener"><span class="sr" data-copy="COPY-privacy.source_label">{tr('COPY-privacy.source_label', lang)}</span> <span class="sr" data-copy="COPY-a11y.new_tab">{tr('COPY-a11y.new_tab', lang)}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="{g.GH}"/></svg></a>
<div style="flex:1"></div>
<button class="zb"{dis} aria-label="{tr('COPY-action.zoom_out', lang)}" data-copy="COPY-action.zoom_out">{svg('<path d="M5 12h14"/>', 16)}</button>
{mid}
<button class="zb"{dis} aria-label="{tr('COPY-action.zoom_in', lang)}" data-copy="COPY-action.zoom_in">{svg('<path d="M5 12h14M12 5v14"/>', 16)}</button>
</footer>'''


def sbar(lang, subject, detail, color=None, open_=False, sid='sh'):
    chip = f'<span class="chip2" aria-hidden="true" style="background:var(--ann-{color})"></span>' if color else ''
    chev = '<path d="M7 10l5 5 5-5"/>' if open_ else '<path d="M7 14l5-5 5 5"/>'
    return (f'<button class="sbar" aria-expanded="{"true" if open_ else "false"}" aria-controls="{sid}-{{{{t.name}}}}" aria-labelledby="{sid}l-{{{{t.name}}}} {sid}d-{{{{t.name}}}}">'
            f'<span class="sr" id="{sid}l-{{{{t.name}}}}" data-copy="COPY-style.sheet_toggle">{tr("COPY-style.sheet_toggle", lang)}:</span>{chip}<span id="{sid}d-{{{{t.name}}}}" data-copy="COPY-style.sheet_summary">{tr("COPY-style.sheet_summary", lang, subject=subject, detail=detail)}</span>'
            f'<span class="chev">{svg(chev, 16)}</span></button>')


def fill_sec(sel=0):
    names = [('COPY-style.fill_none', 'None'), ('COPY-style.fill_solid', 'Solid'), ('COPY-style.fill_translucent', 'Translucent')]
    b = ''.join(f'<button{" class=\'on\'" if i == sel else ""} role="radio" aria-checked="{"true" if i == sel else "false"}" data-copy="{c}">{n}</button>' for i, (c, n) in enumerate(names))
    return f'<div class="sec"><div class="ph" data-copy="COPY-style.fill">Fill</div><div class="seg" role="radiogroup" aria-label="Fill" data-copy="COPY-style.fill">{b}</div></div>'


def npanel(lang, bar, sheet=None, sid='sh'):
    if sheet is None:
        return f'<aside class="npanel" aria-label="{tr("COPY-a11y.style_panel", lang)}" data-copy="COPY-a11y.style_panel"><div class="in">{bar}<div id="{sid}-{{{{t.name}}}}" hidden></div></div></aside>'
    return (f'<aside class="npanel open" aria-label="{tr("COPY-a11y.style_panel", lang)}" data-copy="COPY-a11y.style_panel"><div class="in">{bar}'
            f'<div class="sheet" id="{sid}-{{{{t.name}}}}">{sheet}</div></div></aside>')


def nimage(annots):
    return f'<div class="img" style="top:{NT}px">{g.sample(annots).replace(chr(34) + "inner" + chr(34), chr(34) + "inner" + chr(34) + f" style={chr(34)}transform:scale({NK:.5f}){chr(34)}", 1)}</div>'


def nhandles_box(r):
    x, y, w, h = r
    L, T, R, B = nsx(x), nsy(y), nsx(x + w), nsy(y + h)
    out = f'<div class="sel" style="left:{L-4}px;top:{T-4}px;width:{R-L+8:.1f}px;height:{B-T+8:.1f}px"></div>'
    for hx in (L - 4, (L + R) / 2, R + 4):
        for hy in (T - 4, (T + B) / 2, B + 4):
            if hx == (L + R) / 2 and hy == (T + B) / 2:
                continue
            out += f'<div class="h" style="left:{hx-5:.1f}px;top:{hy-5:.1f}px"></div>'
    return out


def ncrop():
    x, y, w, h = d3.CROP
    L, T, R, B = nsx(x), nsy(y), nsx(x + w), nsy(y + h)
    iL, iT, iR, iB = NL, NT, NL + 356, NT + 222.6
    d = (f'<div class="dim" style="left:{iL}px;top:{iT}px;width:356px;height:{T-iT:.1f}px"></div>'
         f'<div class="dim" style="left:{iL}px;top:{T}px;width:{L-iL:.1f}px;height:{B-T:.1f}px"></div>'
         f'<div class="dim" style="left:{R}px;top:{T}px;width:{iR-R:.1f}px;height:{B-T:.1f}px"></div>'
         f'<div class="dim" style="left:{iL}px;top:{B}px;width:356px;height:{iB-B:.1f}px"></div>')
    hs = ''.join(f'<div class="h" style="left:{hx-5:.1f}px;top:{hy-5:.1f}px"></div>'
                 for hx in (L, (L + R) / 2, R) for hy in (T, (T + B) / 2, B) if not (hx == (L + R) / 2 and hy == (T + B) / 2))
    chip = f'<span class="chip" aria-hidden="true" style="left:{(L+R)/2-52:.1f}px;top:{B+12:.1f}px" data-copy="COPY-crop.size">{g.ip(w):,} × {g.ip(h):,} px</span>'
    return d + f'<div class="sel" style="left:{L}px;top:{T}px;width:{R-L:.1f}px;height:{B-T:.1f}px"></div>' + hs, chip


def nitems(lang, sel_idx=None):
    kinds = [('rectangle', g.RECT), ('arrow', g.ARROW[0]), None, ('redact_solid', g.RED_EMAIL), ('redact_solid', g.RED_TOKEN)]
    out = []
    for i, k in enumerate(kinds):
        sel = i == sel_idx
        if k is None:
            x, y, t = g.TEXTA
            out.append(('COPY-a11y.text_annotation', tr('COPY-a11y.text_annotation', lang, text=t, x=num(g.ip(x), lang), y=num(g.ip(y), lang)), sel))
            continue
        kind, xy = k
        name = tr('COPY-redact.solid', lang) if kind == 'redact_solid' else tr('COPY-tool.' + kind, lang)
        out.append(('COPY-a11y.annotation', tr('COPY-a11y.annotation', lang, kind=name, x=num(g.ip(xy[0]), lang), y=num(g.ip(xy[1]), lang)), sel))
    return out


def nscreen(s):
    lang = s.get('lang', 'en')
    if s.get('empty'):
        empty = d3.EMPTY.replace('class="ebtn"', 'class="ebtn"')
        work = (f'<div class="work" role="region" aria-label="{tr("COPY-a11y.canvas", lang)}" data-copy="COPY-a11y.canvas">{empty}'
                '<div class="sr" role="status" aria-live="polite"></div><div class="sr" role="alert"></div></div>')
        return f'<div class="app nw" lang="{"vi" if lang == "vi" else "en"}">\n{ntoolbar(lang, empty=True)}\n<main class="nbody">\n{work}\n</main>\n{nstatus(lang)}\n</div>'
    items = s.get('items') or nitems(lang)
    n = len(items)
    size = s.get('size', (1756, 1098))
    summary = tr('COPY-a11y.canvas_summary', lang, width=num(size[0], lang), height=num(size[1], lang), count=n)
    opts = ''.join(f'<div role="option" id="an{k}-{{{{t.name}}}}" tabindex="{0 if sel else -1}" aria-selected="{"true" if sel else "false"}" data-copy="{cid}">{txt}</div>' for k, (cid, txt, sel) in enumerate(items))
    listbox = (f'<div class="sr" role="listbox" aria-multiselectable="true" aria-label="{tr("COPY-a11y.annotations_list", lang)}" data-copy="COPY-a11y.annotations_list" aria-describedby="ah-{{{{t.name}}}}">'
               f'<span class="sr" id="ah-{{{{t.name}}}}" data-copy="COPY-a11y.annotations_hint">{tr("COPY-a11y.annotations_hint", lang)}</span>{opts}</div>')
    live = s.get('live')
    live_html = f'<div class="sr" role="status" aria-live="polite"{f" data-copy=\"{live[0]}\"" if live else ""}>{live[1] if live else ""}</div>'
    return f'''<div class="app nw" lang="{"vi" if lang == "vi" else "en"}">
{ntoolbar(lang, s['tool'], s.get('count', 2), scrolled=s.get('scrolled', False))}
<main class="nbody">
{s['panel']}
<div class="work" role="region" tabindex="{-1 if any(x[2] for x in items) else 0}" aria-label="{tr('COPY-a11y.canvas', lang)}" aria-describedby="cs-{{{{t.name}}}}" data-copy="COPY-a11y.canvas">
<span class="sr" id="cs-{{{{t.name}}}}" data-copy="COPY-a11y.canvas_summary">{summary}</span>
{at(s.get('top', NT), nimage, g.ALL)}
<div class="ov" aria-hidden="true">{s.get('overlay', '')}</div>
{s.get('chip', '')}
{listbox}
{live_html}
<div class="sr" role="alert"></div>
</div>
</main>
{nstatus(lang, 20)}
</div>'''


def nboard(title, label, s):
    css = d3.CSS + '\n' + NCSS
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet">
<style>
{css}
</style>
</helmet>
<div class="board" style="width:900px;height:920px;box-sizing:border-box;padding:40px;background:var(--board);display:flex;gap:40px">
<sc-for list="{{{{themes}}}}" as="t" hint-placeholder-count="2">
<div class="{{{{t.cls}}}}" style="width:390px">
<div class="lab" style="min-height:44px">{label} / {{{{t.name}}}}</div>
{nscreen(s)}
</div>
</sc-for>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":900,"height":920}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{ themes: [{{ name: 'dark', cls: 'tk-dark' }}, {{ name: 'light', cls: 'tk-light' }}] }};
}}
}}
</script>
</body>
</html>
'''


def crop_sheet():
    x, y, w, h = d3.CROP
    return (f'<div class="sec"><div class="ph" data-copy="COPY-tool.crop">Crop</div><div class="mono" style="font-size:13px" data-copy="COPY-crop.size">{g.ip(w):,} × {g.ip(h):,} px</div></div>'
            '<fieldset class="sec" style="border:0;margin:0;padding:0"><legend class="ph" style="padding:0;margin-bottom:8px" data-copy="COPY-geometry.title">Position and size</legend><div class="fields">'
            + g.field('COPY-geometry.x', 'X', g.ip(x)) + g.field('COPY-geometry.y', 'Y', g.ip(y)) + g.field('COPY-geometry.width', 'Width', g.ip(w)) + g.field('COPY-geometry.height', 'Height', g.ip(h))
            + '</div></fieldset><button class="btn" data-copy="COPY-action.crop_reset">Reset crop</button>')


def sel_rect_sheet():
    return (g.color_sec(0) + g.size_seg(1) + fill_sec(0) + g.geo_box(g.RECT) + g.ACTS4)


crop_ov, crop_chip = at(30, ncrop)
OPEN_TOP = 30   # (564 - 282) / 2 - 222.6 / 2: the whole image above a half-height sheet
cx, cy, cw, ch = d3.CROP
NV = 'narrow 390'
NARROW = {
    'SCR-Annotator_empty_narrow.dc.html': ('SCR-Annotator / empty / narrow 390', f'empty (no image; two-row toolbar disabled; no summary bar; icon status bar) / {NV}', dict(empty=True)),
    'SCR-Annotator_default_narrow.dc.html': ('SCR-Annotator / default / narrow 390', f'default (arrow tool; summary bar closed; tools scroll; fit 20 %) / {NV}', dict(
        tool='arrow', panel=npanel('en', sbar('en', 'Arrow', 'Medium', 'red')))),
    'SCR-Annotator_selecting_narrow.dc.html': ('SCR-Annotator / selecting / narrow 390', f'selecting (rectangle selected; sheet opened from the summary bar, scrolls inside; view moved above it) / {NV}', dict(
        tool='select', top=OPEN_TOP, panel=npanel('en', sbar('en', 'Rectangle', 'Medium', 'red', True), sel_rect_sheet()), overlay=at(OPEN_TOP, nhandles_box, g.RECT),
        items=nitems('en', 0), live=('COPY-a11y.annotation', f'Rectangle at {g.ip(g.RECT[0]):,}, {g.ip(g.RECT[1]):,}'))),
    'SCR-Annotator_cropping_narrow.dc.html': ('SCR-Annotator / cropping / narrow 390', f'cropping (crop tool scrolled into view; sheet open with the crop fields; frame above it) / {NV}', dict(
        tool='crop', scrolled=True, top=OPEN_TOP, panel=npanel('en', sbar('en', 'Crop', f'{g.ip(cw):,} × {g.ip(ch):,} px', None, True), crop_sheet()), overlay=crop_ov, chip=crop_chip,
        size=(g.ip(cw), g.ip(ch)), live=('COPY-a11y.tool_active', 'Crop tool'))),
    'SCR-Annotator_canvas-settings_narrow.dc.html': ('SCR-Annotator / canvas-settings / narrow 390', f'canvas-settings (select tool, nothing selected; summary bar names the canvas; transparent background, so no colour dot) / {NV}', dict(
        tool='select', panel=npanel('en', sbar('en', 'Canvas', 'Padding None')))),
    'SCR-Annotator_default_narrow-vi.dc.html': ('SCR-Annotator / default / narrow-vi 390', f'default, vi-VN (count falls back to icon + number; summary bar in Vietnamese) / {NV}', dict(
        lang='vi', tool='arrow', panel=npanel('vi', sbar('vi', tr('COPY-tool.arrow', 'vi'), tr('COPY-style.size_m', 'vi'), 'red')))),
}

# ---------------------------------------------------------------- FLOW-02 (embedded 1200)
# Sample: a made-up settings page, 1,756 x 1,098 px like FLOW-01, so the RULE-04 sizes match
# (stroke M 7, text M 44, step badge M 88, highlight L = 3 x 13 = 40 image px).
STEP_D = 88 / g.TO_IMG
HL_W = 3 * 13 / g.TO_IMG
STEPS = [(500, 156), (500, 204), (508, 348)]       # badge centres (inner units)
HL = ((234, 300), (504, 300))                        # straight highlight under one line of text
CROP2 = (208, 64, 480, 316)                          # snapped to the settings card


def docs_sample(annots, style=''):
    rows = [('Email digest', 'Weekly activity summary.', True, 140), ('Weekly report', 'Usage for your workspace.', False, 188), ('Product updates', 'New features and changes.', True, 236)]
    r = ''
    for name, sub, on, y in rows:
        knob = 'left:20px;background:#FFFFFF' if on else 'left:2px;background:#FFFFFF'
        r += (f'<div class="fx" style="left:228px;top:{y}px;height:20px;font-weight:600;font-size:13px">{name}</div>'
              f'<div class="fx" style="left:228px;top:{y+18}px;height:18px;font-size:12px;color:#5B6372">{sub}</div>'
              f'<div style="position:absolute;left:428px;top:{y+6}px;width:38px;height:20px;border-radius:10px;background:{"#2F6FEB" if on else "#CBD0D8"}"><div style="position:absolute;top:2px;{knob};width:16px;height:16px;border-radius:8px"></div></div>')
    nav = ''.join(f'<div class="fx" style="left:12px;top:{y}px;width:156px;height:28px;border-radius:6px;font-size:13px;{"background:#E8EEFD;color:#1D4FC4;font-weight:600" if a else ""}">{t}</div>'
                  for t, y, a in [('Profile', 64, False), ('Notifications', 96, True), ('Billing', 128, False), ('API keys', 160, False)])
    return f'''<div class="inner" data-sample="screenshot" aria-hidden="true"{style}>
<div class="fx" style="left:0;top:0;width:720px;height:40px;padding:0 20px;background:#FFFFFF;border-bottom:1px solid #E3E6EB;font-weight:700;font-size:15px">Acme Cloud<span style="margin-left:auto;font-weight:400;font-size:13px;color:#5B6372">Settings</span></div>
<div style="position:absolute;left:0;top:40px;width:180px;height:410px;background:#FFFFFF;border-right:1px solid #E3E6EB"></div>
{nav}
<div style="position:absolute;left:208px;top:64px;width:480px;height:316px;background:#FFFFFF;border:1px solid #E3E6EB;border-radius:8px;box-sizing:border-box"></div>
<div class="fx" style="left:218px;top:76px;height:24px;font-weight:700;font-size:15px">Notifications</div>
<div class="fx" style="left:218px;top:102px;height:20px;font-size:12px;color:#5B6372">Choose which emails you get.</div>
{r}
<div style="position:absolute;left:228px;top:282px;width:440px;height:1px;background:#E3E6EB"></div>
<div class="fx" style="left:228px;top:290px;height:20px;font-size:12px;color:#1F2430">Digest emails are sent every Monday at 9:00.</div>
<div class="fx" style="left:540px;top:332px;width:128px;height:32px;justify-content:center;background:#2F6FEB;color:#FFFFFF;border-radius:6px;font-weight:700;font-size:13px">Save changes</div>
{annots}
</div>'''


def a_step(c, n):
    x, y = c
    return (f'<div style="position:absolute;left:{x-STEP_D/2:.2f}px;top:{y-STEP_D/2:.2f}px;width:{STEP_D:.2f}px;height:{STEP_D:.2f}px;border-radius:50%;background:var(--ann-red);'
            f'color:var(--ann-white);display:flex;align-items:center;justify-content:center;font:700 {g.TEXT:.2f}px/1 Manrope,sans-serif">{n}</div>')


def a_highlight():
    (x1, y1), (x2, y2) = HL
    return (f'<svg width="720" height="450" style="position:absolute;left:0;top:0"><path d="M{x1} {y1} L{x2} {y2}" stroke="var(--ann-yellow)" stroke-opacity=".4" stroke-width="{HL_W:.2f}" stroke-linecap="round"/></svg>')


STEPS_HTML = ''.join(a_step(c, i + 1) for i, c in enumerate(STEPS))


def f2_image(annots):
    return f'<div class="img">{docs_sample(annots)}</div>'


def f2_items(sel=None, hl=False):
    out = [('COPY-a11y.step_annotation', f'Step {i+1} at {g.ip(c[0]):,}, {g.ip(c[1]):,}', False) for i, c in enumerate(STEPS)]
    if hl:
        out.append(('COPY-a11y.annotation', f'Highlight at {g.ip(HL[0][0]):,}, {g.ip(HL[0][1]):,}', sel == 'hl'))
    return out


def panel_hl():
    return ('<aside class="panel" aria-label="Style" data-copy="COPY-a11y.style_panel">' + g.color_sec(2) + g.size_seg(2) + g.geo_line(*HL) + g.ACTS4 + '</aside>')


def panel_crop2():
    x, y, w, h = CROP2
    return ('<aside class="panel" aria-label="Style" data-copy="COPY-a11y.style_panel">'
            f'<div class="sec"><div class="ph" data-copy="COPY-tool.crop">Crop</div><div class="mono" style="font-size:13px" data-copy="COPY-crop.size">{g.ip(w):,} × {g.ip(h):,} px</div></div>'
            '<fieldset class="sec" style="border:0;margin:0;padding:0"><legend class="ph" style="padding:0;margin-bottom:8px" data-copy="COPY-geometry.title">Position and size</legend><div class="fields">'
            + g.field('COPY-geometry.x', 'X', g.ip(x)) + g.field('COPY-geometry.y', 'Y', g.ip(y)) + g.field('COPY-geometry.width', 'Width', g.ip(w)) + g.field('COPY-geometry.height', 'Height', g.ip(h))
            + '</div></fieldset><button class="btn" data-copy="COPY-action.crop_reset">Reset crop</button></aside>')


def crop2_overlay():
    x, y, w, h = CROP2
    L, T, R, B = g.sx(x), g.sy(y), g.sx(x + w), g.sy(y + h)
    iL, iT, iR, iB = g.IMG_LEFT, g.IMG_TOP, g.IMG_LEFT + 878, g.IMG_TOP + 549
    d = (f'<div class="dim" style="left:{iL}px;top:{iT}px;width:878px;height:{T-iT:.1f}px"></div>'
         f'<div class="dim" style="left:{iL}px;top:{T}px;width:{L-iL:.1f}px;height:{B-T:.1f}px"></div>'
         f'<div class="dim" style="left:{R}px;top:{T}px;width:{iR-R:.1f}px;height:{B-T:.1f}px"></div>'
         f'<div class="dim" style="left:{iL}px;top:{B}px;width:878px;height:{iB-B:.1f}px"></div>')
    hs = ''.join(f'<div class="h" style="left:{hx-5:.1f}px;top:{hy-5:.1f}px"></div>'
                 for hx in (L, (L + R) / 2, R) for hy in (T, (T + B) / 2, B) if not (hx == (L + R) / 2 and hy == (T + B) / 2))
    chip = f'<span class="chip" aria-hidden="true" style="left:{(L+R)/2-52:.1f}px;top:{B+12:.1f}px" data-copy="COPY-crop.size">{g.ip(w):,} × {g.ip(h):,} px</span>'
    return d + f'<div class="sel" style="left:{L}px;top:{T}px;width:{R-L:.1f}px;height:{B-T:.1f}px"></div>' + hs, chip


# Step 5: padding M around the cropped frame (RULE-14, D-020), white background; the view shows the canvas only.
FW, FH = g.ip(CROP2[2]), g.ip(CROP2[3])
PADM = round(0.06 * max(FW, FH))
CW, CH = FW + 2 * PADM, FH + 2 * PADM
FIT = min(878 / CW, 640 / CH)
ZOOM = round(FIT * 100)


def padded_frame(annots):
    s = FIT * g.TO_IMG                                  # inner -> screen
    w, h = CW * FIT, CH * FIT
    left, top = (926 - w) / 2, (688 - h) / 2
    pad = PADM * FIT
    ox, oy = pad - CROP2[0] * s, pad - CROP2[1] * s    # inner origin inside the canvas
    layer = f'style="position:absolute;left:{ox:.1f}px;top:{oy:.1f}px;width:720px;height:450px;transform-origin:0 0;transform:scale({s:.5f})"'
    return (f'<div class="img" style="left:{left:.1f}px;top:{top:.1f}px;width:{w:.1f}px;height:{h:.1f}px;background:var(--ann-white)">'
            f'<div style="position:absolute;left:{pad:.1f}px;top:{pad:.1f}px;width:{FW*FIT:.1f}px;height:{FH*FIT:.1f}px;overflow:hidden">'
            + docs_sample('', f' style="left:{-CROP2[0]*s:.1f}px;top:{-CROP2[1]*s:.1f}px;transform:scale({s:.5f})"') + '</div>'
            f'<div {layer}>{annots}</div></div>')


DL_NOTICE = (f'<div class="n"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" style="color:var(--success);flex:none"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>'
             '<p data-copy="COPY-export.downloaded">Downloaded settings-annotated.png.</p>'
             f'<button class="x" aria-label="Close" data-copy="COPY-action.close">{svg(g.I_X, 16)}</button></div>')

c2ov, c2chip = crop2_overlay()
F2V = 'embedded 1200'
FLOW2 = {
    'FLOW-02_step1.dc.html': ('FLOW-02 / steps 1–2: steps placed', f'FLOW-02 / steps 1–2: settings.png opened (Ctrl+O; the just-opened state is as FLOW-01 step 1), three steps placed with the step tool (N) (F-001.R3, F-006.R1; badge 88 px = 2 × text M) / {F2V}', dict(
        tool='step', count=0, panel='<aside class="panel" aria-label="Style" data-copy="COPY-a11y.style_panel">' + g.color_sec(0) + g.size_seg(1) + '</aside>',
        image=f2_image(STEPS_HTML), items=f2_items(), live=('COPY-a11y.placed', 'Step added'))),
    'FLOW-02_step2.dc.html': ('FLOW-02 / step 3: highlight', f'FLOW-02 / step 3: one line of text highlighted with Shift held (H; yellow, Large; 40 % so the text stays readable) and selected (F-004.R2, R3) / {F2V}', dict(
        tool='highlight', count=0, panel=panel_hl(), image=f2_image(STEPS_HTML + a_highlight()), overlay=g.handles_line(*HL),
        items=f2_items('hl', True), live=('COPY-a11y.placed', 'Highlight added'))),
    'FLOW-02_step3.dc.html': ('FLOW-02 / step 4: crop', f'FLOW-02 / step 4: frame dragged to the settings card (C); outside dimmed (F-010.R1, R2, R4) / {F2V}', dict(
        tool='crop', count=0, panel=panel_crop2(), image=f2_image(STEPS_HTML + a_highlight()), overlay=c2ov, chip=c2chip,
        items=f2_items(None, True), size=f'{FW:,} × {FH:,}', live=('COPY-a11y.tool_active', 'Crop tool'))),
    'FLOW-02_step4.dc.html': ('FLOW-02 / steps 5–6: padded + downloaded', f'FLOW-02 / steps 5–6: padding Medium ({PADM} px around the frame, D-020) on white, then downloaded (Ctrl+S); view shows the canvas only (F-011.R1, R2; F-012.R2, R4) / {F2V}', dict(
        tool='select', count=0, panel=d3.panel_canvas_padded(), image=padded_frame(STEPS_HTML + a_highlight()),
        items=f2_items(None, True), size=f'{CW:,} × {CH:,}', status=g.STATUS.replace('>50 %<', f'>{ZOOM} %<'),
        notice=DL_NOTICE, live=('COPY-export.downloaded', 'Downloaded settings-annotated.png.'))),
}


if __name__ == '__main__':
    for fn, (title, label, s) in NARROW.items():
        with open(os.path.join(OUT, fn), 'w') as f:
            f.write(nboard(title, label, s))
        print('wrote', fn)
    g.screen, g.CSS = d3.screen, d3.CSS
    for fn, (title, label, s) in FLOW2.items():
        with open(os.path.join(OUT, fn), 'w') as f:
            f.write(g.board(title, label, s))
        print('wrote', fn)
    print('FLOW-02 canvas', CW, CH, 'pad', PADM, 'zoom', ZOOM)
