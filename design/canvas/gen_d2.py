"""Generates the D2 artboards (Main + FLOW-01 steps 1-5) from the D1 component markup.

Run: python3 design/canvas/gen_d2.py  (writes into design/canvas/project/)
The specs stay the source of truth; this only keeps the six screens consistent.
"""
import os

OUT = os.path.join(os.path.dirname(__file__), 'project')

# Sample image: 1,756 x 1,098 px shown at 50 % -> 878 x 549 on screen.
# The sample is drawn in a 720 x 450 space and scaled by K.
K = 878 / 720
IMG_LEFT, IMG_TOP = 24, 69          # image position inside the 926 x 688 work area
TO_IMG = 1756 / 720                 # inner -> image pixels


def sx(x): return round(IMG_LEFT + x * K, 1)
def sy(y): return round(IMG_TOP + y * K, 1)
def ip(v): return round(v * TO_IMG)


STROKE = 7 / TO_IMG     # RULE-04 M stroke: max(3, 0.006 x 1,098) = 7 image px
TEXT = 44 / TO_IMG      # RULE-04 M text: max(16, 0.04 x 1,098) = 44 image px
OUTLINE = 4 / TO_IMG    # RULE-08 outline: max(1, 0.08 x 44) = 4 image px
RED = 'var(--ann-red)'

TOOLS = [
    ('select', 'Select (V)', 'M5 3l14 8-6 2-3 6z'),
    ('rectangle', 'Rectangle (R)', 'M4 6h16v12H4z'),
    ('ellipse', 'Ellipse (O)', 'M4 12a8 6 0 1016 0a8 6 0 10-16 0'),
    ('arrow', 'Arrow (A)', 'M5 19L19 5M10 5h9v9'),
    ('line', 'Line (L)', 'M5 19L19 5'),
    ('pen', 'Pen (P)', 'M4 17c3-6 5 2 8-3s4-6 8-5'),
    ('highlight', 'Highlight (H)', 'M9 15l6-10 4 2-6 10zM9 15l-2 4h4M4 21h16'),
    ('text', 'Text (T)', 'M5 6h14M12 6v13'),
    ('step', 'Step (N)', 'M4 12a8 8 0 1016 0a8 8 0 10-16 0M11 9l2-1v8'),
    ('redact', 'Redact (X)', 'M3 8h18v8H3zM6 11h12M6 13h12'),
    ('crop', 'Crop (C)', 'M7 3v14h14M3 7h14v14'),
]
PAL = [('Red', '#D62828'), ('Orange', '#F28C28'), ('Yellow', '#FFD60A'), ('Green', '#2DB84D'),
       ('Blue', '#0B63E5'), ('Purple', '#8E44EC'), ('Black', '#000000'), ('White', '#FFFFFF')]

ICON = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
I_OPEN = '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'
I_COPY = '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>'
I_DL = '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'
I_UNDO = '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>'
I_REDO = '<path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3"/>'
I_SHIELD = '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'
I_WARN = '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/>'
I_X = '<path d="M6 6l12 12M18 6L6 18"/>'
GH = ('M12 2a10 10 0 00-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 015 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0012 2z')


def svg(paths, size=20, extra=ICON):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" {extra}>{paths}</svg>'


CSS = """body{margin:0;font-family:Manrope,system-ui,sans-serif}
.board{--board:#0B0812;--boardLabel:#9C92B0}
.tk-dark{--bg:#0F0B16;--surface:#18121F;--surface2:#221A2F;--line:#2D2440;--lineStrong:#6F6290;--fg:#EFEAF8;--muted:#9C92B0;--accent:#A47BFF;--accentHover:#B79BFF;--onAccent:#0F0B16;--accent2Fg:#FFC48A;--selection:#2A1D47;--success:#5BD6A0;--warnBg:#33240F;--workArea:#0B0812;--checkerA:#2A2333;--checkerB:#1E1828;--selectionOutline:#A47BFF;--handleFill:#FFFFFF;--handleBorder:#6837E0}
.tk-light{--bg:#FBFAFE;--surface:#FFFFFF;--surface2:#F1EDFA;--line:#E2DCF0;--lineStrong:#8C82A2;--fg:#16111F;--muted:#5E566F;--accent:#6837E0;--accentHover:#5429C0;--onAccent:#FFFFFF;--accent2Fg:#8F4705;--selection:#F0EAFE;--success:#13744C;--warnBg:#FDEBD8;--workArea:#ECE8F4;--checkerA:#FFFFFF;--checkerB:#E6E1F0;--selectionOutline:#6837E0;--handleFill:#FFFFFF;--handleBorder:#6837E0}
.tk-dark,.tk-light{--ann-red:#D62828;--ann-orange:#F28C28;--ann-yellow:#FFD60A;--ann-green:#2DB84D;--ann-blue:#0B63E5;--ann-purple:#8E44EC;--ann-black:#000000;--ann-white:#FFFFFF}
.lab{font:600 12px Manrope,sans-serif;color:var(--boardLabel);margin:0 0 8px}
.app{width:1200px;height:760px;display:flex;flex-direction:column;background:var(--bg);color:var(--fg);border:1px solid var(--line);box-sizing:border-box;overflow:hidden}
.tb{height:40px;flex:none;display:flex;align-items:center;gap:4px;padding:0 8px;background:var(--surface);border-bottom:1px solid var(--line);box-sizing:border-box}
.sep{width:1px;height:20px;background:var(--line);margin:0 4px;flex:none}
.ib{width:32px;height:32px;flex:none;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:7px;background:transparent;color:var(--fg);padding:0}
.ib.on{background:var(--selection);box-shadow:inset 0 0 0 2px var(--accent);color:var(--accent)}
.ib:disabled,.tbtn:disabled{color:var(--muted);background:transparent}
.tbtn{height:32px;flex:none;display:inline-flex;align-items:center;gap:8px;padding:0 12px;border:0;border-radius:7px;background:transparent;color:var(--fg);font:600 13px Manrope,sans-serif}
.primary{background:var(--accent);color:var(--onAccent)}
.pill{height:24px;flex:none;display:inline-flex;align-items:center;gap:4px;padding:0 8px;border-radius:999px;background:var(--surface2);color:var(--fg);font:600 12px Manrope,sans-serif}
.body{flex:1;display:flex;min-height:0}
.work{flex:1;position:relative;overflow:hidden;background:var(--workArea)}
.work:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.img{position:absolute;left:24px;top:69px;width:878px;height:549px;overflow:hidden;box-shadow:0 0 0 1px var(--lineStrong)}
.inner{position:absolute;left:0;top:0;width:720px;height:450px;transform:scale(1.219444);transform-origin:0 0;background:#F6F7F9;font-family:system-ui,sans-serif;color:#1F2430}
.ov{position:absolute;inset:0;pointer-events:none}
.h{position:absolute;width:10px;height:10px;background:var(--handleFill);border:2px solid var(--handleBorder);box-sizing:border-box}
.sel{position:absolute;border:2px solid var(--selectionOutline);box-shadow:0 0 0 1px var(--workArea);box-sizing:border-box}
.ed{position:absolute;padding:4px;border:2px dashed var(--selectionOutline);box-shadow:0 0 0 1px var(--workArea);white-space:pre;color:transparent;caret-color:var(--ann-red);outline:2px solid var(--accent);outline-offset:2px}
.caret{display:inline-block;width:2px;background:var(--ann-red);vertical-align:top}
.panel{order:2;width:272px;flex:none;background:var(--surface);border-left:1px solid var(--line);padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;color:var(--fg);font-size:13px}
.sec{display:flex;flex-direction:column;gap:8px}
.ph{font:600 12px Manrope,sans-serif;color:var(--muted)}
.sws{display:flex;justify-content:space-between}
.sw{width:24px;height:24px;border-radius:7px;border:1px solid var(--lineStrong);box-sizing:border-box;padding:0;flex:none}
.sw.on{border:2px solid var(--accent);box-shadow:inset 0 0 0 2px var(--surface)}
.seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--lineStrong);border-radius:7px}
.seg4{grid-template-columns:repeat(4,minmax(0,1fr))}
.seg button{height:28px;border:0;border-right:1px solid var(--line);background:transparent;color:var(--fg);font:600 13px Manrope,sans-serif;padding:0 4px}
.seg button:first-child{border-radius:7px 0 0 7px}
.seg button:last-child{border-right:0;border-radius:0 7px 7px 0}
.seg button.on{background:var(--selection);box-shadow:inset 0 0 0 2px var(--accent)}
.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px}
.fl{display:flex;align-items:center;justify-content:space-between;gap:4px;font:500 12px Manrope,sans-serif;color:var(--muted)}
.fl input{width:56px;height:28px;box-sizing:border-box;border:1px solid var(--lineStrong);border-radius:7px;background:var(--bg);color:var(--fg);font:400 16px 'JetBrains Mono',monospace;padding:0 4px}
.sub{font:600 12px Manrope,sans-serif;color:var(--fg)}
.acts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.btn{height:28px;border:1px solid var(--lineStrong);border-radius:7px;background:transparent;color:var(--fg);font:600 13px Manrope,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px}
.kind{display:flex;flex-direction:column;gap:4px}
.kind button{height:32px;display:flex;align-items:center;gap:8px;padding:0 8px;border:1px solid var(--lineStrong);border-radius:7px;background:transparent;color:var(--fg);font:600 13px Manrope,sans-serif;text-align:left}
.kind button.on{background:var(--selection);border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.tag{margin-left:auto;display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 4px;border-radius:7px;background:var(--warnBg);color:var(--accent2Fg);font:600 12px Manrope,sans-serif}
.st{height:28px;flex:none;display:flex;align-items:center;gap:8px;padding:0 8px;background:var(--surface);border-top:1px solid var(--line);box-sizing:border-box;font:500 12px Manrope,sans-serif;color:var(--muted)}
.mono{font-family:'JetBrains Mono',monospace;color:var(--fg)}
.ok{min-height:24px;color:var(--success);display:inline-flex;align-items:center;gap:4px;border:0;border-radius:7px;background:transparent;font:600 12px Manrope,sans-serif;padding:0 4px}
.lnk{min-height:24px;color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:4px;padding:0 4px;border-radius:7px}
.zb{width:24px;height:24px;border:0;background:transparent;color:var(--fg);border-radius:7px;display:inline-flex;align-items:center;justify-content:center;padding:0}
.st .tbtn{height:24px;padding:0 8px;gap:4px}
.n{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:680px;max-width:calc(100% - 32px);min-height:44px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:8px 8px 8px 12px;background:var(--surface);border:1px solid var(--lineStrong);border-radius:10px;color:var(--fg);font:500 13px/1.45 Manrope,sans-serif}
.n p{margin:0;flex:1}
.x{width:28px;height:28px;flex:none;border:0;background:transparent;color:var(--muted);border-radius:7px;display:inline-flex;align-items:center;justify-content:center;padding:0}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fx{position:absolute;display:flex;align-items:center;padding:0 10px;box-sizing:border-box}"""


def sample(annots):
    """The made-up checkout screenshot (data-sample) plus annotations, in 720 x 450 inner units."""
    rows = [('Desk lamp', '$48.00', 108), ('Cable set', '$22.40', 132), ('Shipping', '$29.00', 156), ('Shipping', '$29.00', 180)]
    r = ''.join(f'<div class="fx" style="left:456px;top:{y}px;width:228px;height:20px;font-size:13px">{a}<span style="margin-left:auto">{b}</span></div>' for a, b, y in rows)
    return f'''<div class="inner" data-sample="screenshot" aria-hidden="true">
<div class="fx" style="left:0;top:0;width:720px;height:44px;padding:0 20px;background:#FFFFFF;border-bottom:1px solid #E3E6EB;font-weight:700;font-size:15px">Checkout<span style="margin-left:auto;font-weight:400;font-size:13px;color:#5B6372">Step 3 of 3</span></div>
<div style="position:absolute;left:20px;top:64px;width:400px;height:236px;background:#FFFFFF;border:1px solid #E3E6EB;border-radius:8px;box-sizing:border-box"></div>
<div class="fx" style="left:26px;top:72px;height:20px;font-weight:700;font-size:13px">Contact</div>
<div class="fx" style="left:26px;top:100px;height:20px;font-size:12px;color:#5B6372">Email</div>
<div class="fx" style="left:36px;top:130px;width:368px;height:32px;border:1px solid #CBD0D8;border-radius:6px;font-size:13px">alex.morgan@example.com</div>
<div class="fx" style="left:26px;top:166px;height:20px;font-size:12px;color:#5B6372">API key for invoices</div>
<div class="fx" style="left:36px;top:194px;width:368px;height:32px;border:1px solid #CBD0D8;border-radius:6px;font:12px ui-monospace,monospace">tok_7f3a91c2e8b04d55</div>
<div class="fx" style="left:36px;top:244px;width:368px;height:36px;justify-content:center;background:#2F6FEB;color:#FFFFFF;border-radius:6px;font-weight:700;font-size:13px">Place order</div>
<div style="position:absolute;left:440px;top:64px;width:260px;height:182px;background:#FFFFFF;border:1px solid #E3E6EB;border-radius:8px;box-sizing:border-box"></div>
<div class="fx" style="left:446px;top:76px;height:20px;font-weight:700;font-size:13px">Order summary</div>
{r}
<div style="position:absolute;left:456px;top:206px;width:228px;height:1px;background:#E3E6EB"></div>
<div class="fx" style="left:456px;top:214px;width:228px;height:20px;font-weight:700;font-size:13px">Total<span style="margin-left:auto">$128.40</span></div>
{annots}
</div>'''


# Annotations (inner units)
RECT = (448, 150, 244, 54)
ARROW = ((420, 372), (540, 210))
TEXTA = (300, 380, 'Shipping charged twice')
RED_EMAIL = (36, 130, 368, 32)
RED_TOKEN = (36, 194, 368, 32)


def a_rect():
    x, y, w, h = RECT
    return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;border:{STROKE}px solid {RED};box-sizing:border-box"></div>'


def a_arrow():
    import math
    (x1, y1), (x2, y2) = ARROW
    L = math.hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    hl, hw = 4 * STROKE, 3 * STROKE / 2          # F-003.R2 head 4x long, 3x wide
    bx, by = x2 - ux * hl, y2 - uy * hl
    px, py = -uy, ux
    c1 = (bx + px * hw, by + py * hw)
    c2 = (bx - px * hw, by - py * hw)
    f = lambda p: f'{p[0]:.1f} {p[1]:.1f}'
    return (f'<svg width="720" height="450" style="position:absolute;left:0;top:0"><path d="M{x1} {y1} L{bx:.1f} {by:.1f}" stroke="{RED}" stroke-width="{STROKE}" stroke-linecap="round"/>'
            f'<path d="M{x2} {y2} L{f(c1)} L{f(c2)} Z" fill="{RED}"/></svg>')


def a_text():
    x, y, t = TEXTA
    return (f'<div data-sample="text-annotation" style="position:absolute;left:{x}px;top:{y}px;font:600 {TEXT}px/1.25 Manrope,sans-serif;color:{RED};white-space:pre;'
            f'-webkit-text-stroke:{2*OUTLINE:.2f}px var(--ann-white);paint-order:stroke fill">{t}</div>')


def a_redact(r):
    x, y, w, h = r
    return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:var(--ann-black)"></div>'


def handles_box(r):
    x, y, w, h = r
    L, T, R, B = sx(x), sy(y), sx(x + w), sy(y + h)
    out = f'<div class="sel" style="left:{L-4}px;top:{T-4}px;width:{R-L+8:.1f}px;height:{B-T+8:.1f}px"></div>'
    for hx in (L - 4, (L + R) / 2, R + 4):
        for hy in (T - 4, (T + B) / 2, B + 4):
            if hx == (L + R) / 2 and hy == (T + B) / 2:
                continue
            out += f'<div class="h" style="left:{hx-5:.1f}px;top:{hy-5:.1f}px"></div>'
    return out


def handles_line(p1, p2):
    return ''.join(f'<div class="h" style="left:{sx(p[0])-5:.1f}px;top:{sy(p[1])-5:.1f}px"></div>' for p in (p1, p2))


def toolbar(active, count, undo=True):
    t = ''.join(f'<button class="ib{" on" if k == active else ""}" aria-pressed="{"true" if k == active else "false"}" aria-label="{lab}" data-copy="COPY-tool.shortcut_hint">{svg(f"<path d=\'{d}\'/>")}</button>' for k, lab, d in TOOLS)
    pill = ''
    if count:
        word = 'redaction' if count == 1 else 'redactions'
        pill = f'<span class="pill" data-copy="COPY-export.redaction_count">{svg("<rect x=\'3\' y=\'8\' width=\'18\' height=\'8\' rx=\'2\' fill=\'currentColor\'/>", 16, "aria-hidden=\'true\'")}{count} {word}</span>'
    return f'''<div class="tb" role="toolbar" aria-label="Tools and actions" data-copy="COPY-a11y.toolbar">
<button class="tbtn" data-copy="COPY-action.open" aria-keyshortcuts="Control+O">{svg(I_OPEN, 16)}Open image</button>
<div class="sep"></div>
{t}
<div class="sep"></div>
<button class="ib"{"" if undo else " disabled"} aria-label="Undo" aria-keyshortcuts="Control+Z" data-copy="COPY-action.undo">{svg(I_UNDO)}</button>
<button class="ib" disabled aria-label="Redo" aria-keyshortcuts="Control+Shift+Z Control+Y" data-copy="COPY-action.redo">{svg(I_REDO)}</button>
<div style="flex:1"></div>
{pill}
<button class="tbtn primary" data-copy="COPY-action.copy" aria-keyshortcuts="Control+C">{svg(I_COPY, 16)}Copy</button>
<button class="tbtn" data-copy="COPY-action.download" aria-keyshortcuts="Control+S">{svg(I_DL, 16)}Download</button>
<button class="ib" aria-label="More actions" aria-haspopup="menu" aria-expanded="false" data-copy="COPY-action.more"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg></button>
</div>'''


def swatches(sel, label='Color', copy='COPY-style.color'):
    b = ''.join(f'<button class="sw{" on" if i == sel else ""}" role="radio" aria-checked="{"true" if i == sel else "false"}" aria-label="{n}" data-copy="COPY-color.{n.lower()}" style="background:var(--ann-{n.lower()})"></button>' for i, (n, h) in enumerate(PAL))
    return f'<div class="sws" role="radiogroup" aria-label="{label}" data-copy="{copy}">{b}</div>'


def size_seg(sel=1):
    names = [('COPY-style.size_s', 'Small'), ('COPY-style.size_m', 'Medium'), ('COPY-style.size_l', 'Large')]
    b = ''.join(f'<button{" class=\'on\'" if i == sel else ""} role="radio" aria-checked="{"true" if i == sel else "false"}" data-copy="{c}">{n}</button>' for i, (c, n) in enumerate(names))
    return f'<div class="sec"><div class="ph" data-copy="COPY-style.size">Size</div><div class="seg" role="radiogroup" aria-label="Size" data-copy="COPY-style.size">{b}</div></div>'


def color_sec(sel):
    return f'<div class="sec"><div class="ph" data-copy="COPY-style.color">Color</div>{swatches(sel)}</div>'


def field(copy, label, v):
    return f'<label class="fl"><span data-copy="{copy}">{label}</span><input inputmode="numeric" value="{v}"></label>'


def geo_box(r):
    x, y, w, h = r
    return ('<fieldset class="sec" style="border:0;margin:0;padding:0"><legend class="ph" style="padding:0;margin-bottom:8px" data-copy="COPY-geometry.title">Position and size</legend><div class="fields">'
            + field('COPY-geometry.x', 'X', ip(x)) + field('COPY-geometry.y', 'Y', ip(y)) + field('COPY-geometry.width', 'Width', ip(w)) + field('COPY-geometry.height', 'Height', ip(h))
            + '</div></fieldset>')


def geo_line(p1, p2):
    return ('<fieldset class="sec" style="border:0;margin:0;padding:0"><legend class="ph" style="padding:0;margin-bottom:8px" data-copy="COPY-geometry.title">Position and size</legend>'
            '<div class="sub" data-copy="COPY-geometry.start">Start</div><div class="fields">' + field('COPY-geometry.x', 'X', ip(p1[0])) + field('COPY-geometry.y', 'Y', ip(p1[1])) + '</div>'
            '<div class="sub" data-copy="COPY-geometry.end">End</div><div class="fields">' + field('COPY-geometry.x', 'X', ip(p2[0])) + field('COPY-geometry.y', 'Y', ip(p2[1])) + '</div></fieldset>')


ACTS4 = ('<div class="sec"><div class="acts"><button class="btn" data-copy="COPY-action.duplicate">Duplicate</button><button class="btn" data-copy="COPY-action.delete">Delete</button>'
         '<button class="btn" data-copy="COPY-action.bring_forward">Bring forward</button><button class="btn" data-copy="COPY-action.send_backward">Send backward</button></div></div>')
ACTS2 = '<div class="sec"><div class="acts"><button class="btn" data-copy="COPY-action.duplicate">Duplicate</button><button class="btn" data-copy="COPY-action.delete">Delete</button></div></div>'


def kind_sec():
    tag = f'<span class="tag" data-copy="COPY-redact.not_secure_short">{svg(I_WARN, 16)}Not secure</span>'
    return ('<div class="sec"><div class="ph" data-copy="COPY-redact.kind">Redaction type</div><div class="kind" role="radiogroup" aria-label="Redaction type" data-copy="COPY-redact.kind">'
            f'<button class="on" role="radio" aria-checked="true" data-copy="COPY-redact.solid">{svg(I_SHIELD, 16)}Solid (secure)</button>'
            f'<button role="radio" aria-checked="false">{svg("<circle cx=\'12\' cy=\'12\' r=\'7\' stroke-dasharray=\'2 2\'/>", 16)}<span data-copy="COPY-redact.blur">Blur</span>{tag}</button>'
            '<button role="radio" aria-checked="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/><rect x="13" y="4" width="7" height="7" opacity=".4"/><rect x="4" y="13" width="7" height="7" opacity=".4"/></svg>'
            f'<span data-copy="COPY-redact.pixelate">Pixelate</span>{tag}</button></div></div>')


def panel(kind):
    if kind == 'canvas':
        names = [('COPY-canvas.padding_none', 'None'), ('COPY-style.size_s', 'Small'), ('COPY-style.size_m', 'Medium'), ('COPY-style.size_l', 'Large')]
        seg = ''.join(f'<button{" class=\'on\'" if i == 0 else ""} role="radio" aria-checked="{"true" if i == 0 else "false"}" data-copy="{c}">{n}</button>' for i, (c, n) in enumerate(names))
        bg = ''.join(f'<button class="sw" role="radio" aria-checked="false" aria-label="{n}" data-copy="COPY-color.{n.lower()}" style="background:var(--ann-{n.lower()})"></button>' for n, h in PAL)
        body = (f'<div class="sec"><div class="ph" data-copy="COPY-canvas.padding">Padding</div><div class="seg seg4" role="radiogroup" aria-label="Padding" data-copy="COPY-canvas.padding">{seg}</div></div>'
                '<div class="sec"><div class="ph" data-copy="COPY-canvas.background">Background</div><div class="sws" role="radiogroup" aria-label="Background" data-copy="COPY-canvas.background">'
                '<button class="sw on" role="radio" aria-checked="true" aria-label="Transparent" data-copy="COPY-canvas.transparent" style="background-color:var(--checkerA);background-image:linear-gradient(45deg,var(--checkerB) 25%,transparent 25%,transparent 75%,var(--checkerB) 75%),linear-gradient(45deg,var(--checkerB) 25%,transparent 25%,transparent 75%,var(--checkerB) 75%);background-size:8px 8px;background-position:0 0,4px 4px"></button>'
                f'{bg}</div></div>')
    elif kind == 'tool-arrow' or kind == 'tool-text':
        body = color_sec(0) + size_seg(1)
    elif kind == 'sel-arrow':
        body = color_sec(0) + size_seg(1) + geo_line(*ARROW) + ACTS4
    elif kind == 'sel-solid':
        body = kind_sec() + color_sec(6) + geo_box(RED_EMAIL) + ACTS4
    return f'<aside class="panel" aria-label="Style" data-copy="COPY-a11y.style_panel">{body}</aside>'


STATUS = f'''<footer class="st">
<button class="ok" data-copy="COPY-privacy.badge" aria-haspopup="dialog" aria-expanded="false">{svg(I_SHIELD, 16)}Runs locally, nothing uploaded</button>
<a class="lnk" href="https://github.com/thanh-taro/image-annotator" target="_blank" rel="noopener" data-copy="COPY-privacy.source_label"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="{GH}"/></svg>Source code on GitHub<span class="sr" data-copy="COPY-a11y.new_tab">(opens in a new tab)</span></a>
<div style="flex:1"></div>
<span class="mono" data-copy="COPY-status.image_size">1,756 × 1,098 px</span><div class="sep"></div>
<button class="zb" aria-label="Zoom out" data-copy="COPY-action.zoom_out">{svg('<path d="M5 12h14"/>', 16)}</button>
<span class="mono" data-copy="COPY-status.zoom">50 %</span>
<button class="zb" aria-label="Zoom in" data-copy="COPY-action.zoom_in">{svg('<path d="M5 12h14M12 5v14"/>', 16)}</button>
<button class="tbtn" data-copy="COPY-action.zoom_fit">Fit to view</button><button class="tbtn" data-copy="COPY-action.zoom_actual">Actual size</button>
</footer>'''


def screen(s):
    count = s.get('count', 0)
    items = s.get('items', [])
    n = len(items)
    summary = f'1,756 × 1,098 px canvas, {n} annotation{"" if n == 1 else "s"}'
    live = s.get('live', '')
    live_html = (f'<div class="sr" role="status" aria-live="polite" data-copy="{live[0]}">{live[1]}</div>' if live
                 else '<div class="sr" role="status" aria-live="polite"></div>')
    # Annotations as options of a multi-selectable list, in drawing order; roving tabindex (CMP-Canvas).
    opts = ''.join(f'<div role="option" id="an{k}-{{{{t.name}}}}" tabindex="{0 if sel and not s.get('editor') else -1}" aria-selected="{"true" if sel else "false"}" data-copy="{cid}">{txt}</div>'
                   for k, (cid, txt, sel) in enumerate(items))
    listbox = (f'<div class="sr" role="listbox" aria-multiselectable="true" aria-label="Annotations" data-copy="COPY-a11y.annotations_list" aria-describedby="ah-{{{{t.name}}}}"><span class="sr" id="ah-{{{{t.name}}}}" data-copy="COPY-a11y.annotations_hint">Tab moves to the next annotation; arrow keys move the selected one.</span>{opts}</div>' if items else '')
    return f'''<div class="app">
{toolbar(s['tool'], count, s.get('undo', True))}
<main class="body">
{panel(s['panel'])}
<div class="work" role="region" tabindex="{-1 if any(x[2] for x in items) else 0}" aria-label="Image canvas" aria-describedby="cs-{{{{t.name}}}}" data-copy="COPY-a11y.canvas">
<span class="sr" id="cs-{{{{t.name}}}}" data-copy="COPY-a11y.canvas_summary">{summary}</span>
<div class="img">{sample(s['annots'])}</div>
<div class="ov" aria-hidden="true">{s.get('overlay', '')}</div>
{listbox}
{s.get('editor', '')}
{live_html}
<div class="sr" role="alert"></div>
{s.get('notice', '')}
</div>
</main>
{STATUS}
</div>'''


def board(title, label, s):
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
{CSS}
</style>
</helmet>
<div class="board" style="width:2520px;height:880px;box-sizing:border-box;padding:40px;background:var(--board);display:flex;gap:40px">
<sc-for list="{{{{themes}}}}" as="t" hint-placeholder-count="2">
<div class="{{{{t.cls}}}}">
<div class="lab">{label} / {{{{t.name}}}}</div>
{screen(s)}
</div>
</sc-for>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":2520,"height":880}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{ themes: [{{ name: 'dark', cls: 'tk-dark' }}, {{ name: 'light', cls: 'tk-light' }}] }};
}}
}}
</script>
</body>
</html>
'''


def item(kind, xy, sel=False):
    return ('COPY-a11y.annotation', f'{kind} at {ip(xy[0])}, {ip(xy[1])}', sel)


def text_item(sel=False):
    x, y, t = TEXTA
    return ('COPY-a11y.text_annotation', f'Text “{t}” at {ip(x)}, {ip(y)}', sel)


ALL = a_rect() + a_arrow() + a_text() + a_redact(RED_EMAIL) + a_redact(RED_TOKEN)

# Text editor (CMP-TextEditor): an editable field that hugs the text, 4 px padding, caret at the end.
TX, TY, TT = TEXTA
EDITOR = (f'<div class="ed" role="textbox" contenteditable="true" aria-multiline="true" aria-label="Text" data-copy="COPY-tool.text" '
          f'style="left:{sx(TX)-6:.1f}px;top:{sy(TY)-6:.1f}px;font:600 {TEXT*K:.2f}px/1.25 Manrope,sans-serif">'
          f'<span data-sample="text-annotation">{TT}</span><span class="caret" aria-hidden="true" style="height:{TEXT*K*1.25:.1f}px"></span></div>')

NOTICE = (f'<div class="n"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" style="color:var(--success);flex:none"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>'
          '<p data-copy="COPY-export.copied_redactions">Copied, with 2 redactions applied.</p>'
          f'<button class="x" aria-label="Close" data-copy="COPY-action.close">{svg(I_X, 16)}</button></div>')

V = 'embedded 1200'
SCREENS = {
    'Main.dc.html': ('SCR-Annotator / default / embedded', f'SCR-Annotator / default (annotated; arrow tool, nothing selected) / {V}', dict(
        tool='arrow', count=2, annots=ALL, panel='tool-arrow',
        items=[item('Rectangle', RECT), item('Arrow', ARROW[0]), text_item(), item('Solid (secure)', RED_EMAIL), item('Solid (secure)', RED_TOKEN)])),
    'FLOW-01_step1.dc.html': ('FLOW-01 / step 1: pasted', f'FLOW-01 / step 1: screenshot pasted with Ctrl+V (F-001.R1; select tool, canvas settings; focus: canvas) / {V}', dict(
        tool='select', count=0, annots='', panel='canvas', undo=False,
        live=('COPY-a11y.loaded', 'Image opened, 1,756 × 1,098 px'))),
    'FLOW-01_step2.dc.html': ('FLOW-01 / step 2: arrow + rectangle', f'FLOW-01 / step 2: rectangle drawn (R), then arrow drawn (A) and selected; arrow tool stays (F-003.R1, R2, R6; focus: canvas) / {V}', dict(
        tool='arrow', count=0, annots=a_rect() + a_arrow(), panel='sel-arrow', overlay=handles_line(*ARROW),
        items=[item('Rectangle', RECT), item('Arrow', ARROW[0], True)], live=('COPY-a11y.placed', 'Arrow added'))),
    'FLOW-01_step3.dc.html': ('FLOW-01 / step 3: text label', f'FLOW-01 / step 3: text label being typed (T, click) (F-005.R1, R2; CMP-TextEditor; focus: text field; panel styles the edited text) / {V}', dict(
        tool='text', count=0, annots=a_rect() + a_arrow() + a_text(), panel='tool-text', editor=EDITOR, live=('COPY-a11y.tool_active', 'Text tool'),
        items=[item('Rectangle', RECT), item('Arrow', ARROW[0]), text_item(True)])),
    'FLOW-01_step4.dc.html': ('FLOW-01 / step 4: solid redaction', f'FLOW-01 / step 4: two solid redactions (X), the email one selected; count shown (F-007.R1, R2; F-012.R8; focus: canvas) / {V}', dict(
        tool='redact', count=2, annots=ALL, panel='sel-solid', overlay=handles_box(RED_EMAIL),
        items=[item('Rectangle', RECT), item('Arrow', ARROW[0]), text_item(), item('Solid (secure)', RED_EMAIL, True), item('Solid (secure)', RED_TOKEN)],
        live=('COPY-a11y.placed', 'Solid (secure) added'))),
    'FLOW-01_step5.dc.html': ('FLOW-01 / step 5: copied', f'FLOW-01 / step 5: copied with Ctrl+C; success notice (F-012.R1, R4; focus: canvas) / {V}', dict(
        tool='redact', count=2, annots=ALL, panel='sel-solid', overlay=handles_box(RED_EMAIL),
        items=[item('Rectangle', RECT), item('Arrow', ARROW[0]), text_item(), item('Solid (secure)', RED_EMAIL, True), item('Solid (secure)', RED_TOKEN)],
        notice=NOTICE, live=('COPY-export.copied_redactions', 'Copied, with 2 redactions applied.'))),
}

if __name__ == '__main__':
    for fn, (title, label, s) in SCREENS.items():
        with open(os.path.join(OUT, fn), 'w') as f:
            f.write(board(title, label, s))
        print('wrote', fn)
