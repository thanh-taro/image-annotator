"""QA visual regression, step 3: pair each design render with the app capture (design | app | diff) and
report the share of differing pixels. Usage: python3 tests/visual/pair.py <design-dir> <app-dir> <out-dir>"""
import sys, glob, os
from PIL import Image, ImageChops
d, a, o = sys.argv[1:4]
os.makedirs(o, exist_ok=True)
for dp in sorted(glob.glob(f"{d}/design_*.png")):
    name = os.path.basename(dp)[len("design_"):-4]
    ap = f"{a}/app_{name}.png"
    if not os.path.exists(ap):
        print(name, "NO APP CAPTURE"); continue
    di, ai = Image.open(dp).convert("RGB"), Image.open(ap).convert("RGB")
    size = (max(di.width, ai.width), max(di.height, ai.height))
    pd = Image.new("RGB", size, (255, 0, 255)); pd.paste(di, (0, 0))
    pa = Image.new("RGB", size, (255, 0, 255)); pa.paste(ai, (0, 0))
    diff = ImageChops.difference(pd, pa).convert("L").point(lambda v: 255 if v > 32 else 0)
    pct = 100 * sum(1 for v in diff.getdata() if v) / (size[0] * size[1])
    sheet = Image.new("RGB", (size[0] * 3 + 40, size[1]), (60, 60, 60))
    sheet.paste(pd, (0, 0)); sheet.paste(pa, (size[0] + 20, 0)); sheet.paste(diff.convert("RGB"), (2 * size[0] + 40, 0))
    sheet.save(f"{o}/pair_{name}.png")
    print(f"{name}: design {di.size} app {ai.size} diff {pct:.1f}%")
