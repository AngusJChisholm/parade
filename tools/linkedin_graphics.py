"""Render the two daily LinkedIn graphics (1080x1080) in the fixed house layout.

    python3 tools/linkedin_graphics.py spec.json out_dir

spec.json: {"date":"YYYY-MM-DD","headline_lines":["MONACO'S","SHIRT FOR","EUROPE","ONLY."],
 "highlight":"EUROPE","deal":"Brand x Property","descriptor":"Deal type",
 "others":[{"deal":"Brand x Property","sub":"Sport - deal type"}, ...]}
Optional "label": slide 2 heading (default "Recent deals"), e.g. "The numbers" on a data drop.
Optional "image": the lead's photo ("assets/..." file or an images.unsplash.com link,
same as its deals.json "image"). Slide 1 then sits on the photo; leave it out for plain black.
Optional "logos": {"brand":"assets/logos/<slug>.png","property":"assets/logos/<slug>.png"} for the lead,
and "logos": [brand_path, property_path] on each "others" item. Only verified files in assets/logos/ are drawn;
a missing or unknown path is skipped and the name stays as text.
Writes sss-<date>-slide1.png (headline) and sss-<date>-slide2.png (other deals).
"""
import base64, html, json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
e = lambda s: html.escape(str(s))

def css():
    f = base64.b64encode((ROOT / "assets/fonts/Archivo[wdth,wght].ttf").read_bytes()).decode()
    return f"""@font-face{{font-family:Archivo;src:url(data:font/ttf;base64,{f});font-weight:100 900;font-stretch:62% 125%}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;height:1080px;background:#000;color:#fff;font-family:Archivo;position:relative;overflow:hidden;-webkit-font-smoothing:antialiased}}
.lab{{position:absolute;left:97px;top:96px;font-weight:800;font-size:25px;letter-spacing:.2em;text-transform:uppercase}}
.wm{{position:absolute;right:97px;bottom:84px;width:124px}}
.v{{color:#D2FF3C}}"""

def wordmark(colour="white"):
    return base64.b64encode((ROOT / f"assets/wordmark-{colour}.svg").read_bytes()).decode()

def photo(img):
    img = str(img or "")
    if re.fullmatch(r"assets/[\w/.-]+\.(jpe?g|png|webp)", img) and (ROOT / img).exists():
        return "data:image/jpeg;base64," + base64.b64encode((ROOT / img).read_bytes()).decode()
    m = re.match(r"^https://images\.unsplash\.com/(photo-[\w-]+)", img)
    if m and (ROOT / "assets/img/u" / f"{m.group(1)}.jpg").exists():  # site copy works offline too
        return "data:image/jpeg;base64," + base64.b64encode((ROOT / "assets/img/u" / f"{m.group(1)}.jpg").read_bytes()).decode()
    return f"https://images.unsplash.com/{m.group(1)}?w=1080&h=1080&q=80&auto=format&fit=crop" if m else ""

def logo(p):
    """A verified logo from assets/logos/ as a data URI, or "" (never fetched from the web)."""
    p = str(p or "")
    if not re.fullmatch(r"assets/logos/[\w.-]+\.(png|svg|webp)", p) or not (ROOT / p).exists():
        return ""
    mime = {"png": "image/png", "svg": "image/svg+xml", "webp": "image/webp"}[p.rsplit(".", 1)[1]]
    return f"data:{mime};base64," + base64.b64encode((ROOT / p).read_bytes()).decode()

def logo_pair(paths, cls, on_photo=False):
    def pick(q):
        q = str(q or "")
        if on_photo and "." in q:  # a white version (assets/logos/<slug>-white.png) reads better on a photo
            w = logo(q.rsplit(".", 1)[0] + "-white." + q.rsplit(".", 1)[1])
            if w: return w
        return logo(q)
    srcs = [x for x in (pick(q) for q in paths) if x]
    if not srcs:
        return ""
    sep = '<span class="x">\u00d7</span>' if len(srcs) == 2 else ""
    return f'<div class="{cls}">' + sep.join(f'<img src="{x}">' for x in srcs) + '</div>'

def slide1(s):
    """Full photo, text on top. The photo stays bright: only a soft shade on the left, behind the text."""
    src = photo(s.get("image"))
    bg = (f'<div style="position:absolute;inset:0;background:url(\'{src}\') center 30%/cover"></div>'
          '<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.62) 0%,rgba(0,0,0,.38) 45%,rgba(0,0,0,0) 78%)"></div>'
          '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.18) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 70%,rgba(0,0,0,.28) 100%)"></div>') if src else ""
    lines = "".join(
        f'<div>' + (f'<span class="hv">{e(l)}</span>' if l.strip(".,!?\' ").upper()==s.get("highlight","").strip(".,!?\' ").upper() else e(l)) + '</div>'
        for l in s["headline_lines"])
    return f"""<style>{css()}
body{{background:#1a1a1a}}
.lab{{background:#D2FF3C;color:#000;padding:10px 14px 8px;top:86px;border-radius:8px}}
.hv{{background:#D2FF3C;color:#000;padding:0 .08em;text-shadow:none;border-radius:.09em;-webkit-box-decoration-break:clone;box-decoration-break:clone}}
.lg{{position:absolute;left:97px;top:92px;display:flex;align-items:center;gap:22px}}
.lg img{{height:86px;max-width:230px;object-fit:contain;filter:drop-shadow(0 2px 10px rgba(0,0,0,.35))}}
.lg .x{{font-weight:800;font-size:44px;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.4)}}
.c{{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center}}
.h{{margin-left:94px;margin-right:97px;font-weight:800;font-size:140px;font-stretch:94%;line-height:127px;text-transform:uppercase;letter-spacing:-.005em;text-shadow:0 3px 24px rgba(0,0,0,.35)}}
.d{{position:absolute;left:97px;top:892px;font-weight:600;font-size:28px;line-height:43px;letter-spacing:.13em;text-transform:uppercase;max-width:700px;text-shadow:0 2px 14px rgba(0,0,0,.5)}}</style>
{bg}{logo_pair([(s.get("logos") or {}).get("brand"), (s.get("logos") or {}).get("property")], "lg", on_photo=True)}<div class="c"><div class="h">{lines}</div>
</div>
<div class="d">{e(s['deal'])}<br>{e(s['descriptor'])}</div>
<img class="wm" src="data:image/svg+xml;base64,{wordmark()}">"""

def slide2(s):
    """White slide (matches the website round-up). Volt is a fill behind black type, never text on white."""
    rows = "".join(f'<div class="r">{logo_pair(o.get("logos") or [], "rl")}<div class="t"><b>{e(o["deal"])}</b><span>{e(o["sub"])}</span></div></div>' for o in s["others"][:5])
    return f"""<style>{css()}
body{{background:#fff;color:#000}}
.lab{{background:#D2FF3C;color:#000;padding:10px 14px 8px;top:86px;left:97px;border-radius:8px}}
.rows{{position:absolute;left:97px;right:96px;top:180px;border-top:2px solid #000}}
.r{{padding:27px 0 30px;border-bottom:1px solid #DEDED8;display:flex;align-items:center;gap:26px}}.t{{flex:1;min-width:0}}
.rl{{display:flex;align-items:center;gap:10px;flex:none}}.rl img{{width:84px;height:64px;object-fit:contain}}.rl .x{{display:none}}.r:last-child{{border-bottom:0}}
.r b{{display:block;font-weight:800;font-size:47px;font-stretch:96%;line-height:52px;text-transform:uppercase}}
.r span{{display:block;font-weight:400;font-size:27.5px;color:#5C5C57;margin-top:14px}}</style>
<div class="lab">{e(s.get("label") or "Recent partnerships")}</div><div class="rows">{rows}</div>
<img class="wm" src="data:image/svg+xml;base64,{wordmark('black')}">"""

def render(spec, out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1080, "height": 1080})
        for n, h in (("slide1", slide1(spec)), ("slide2", slide2(spec))):
            pg.set_content(h, wait_until="networkidle"); pg.evaluate("document.fonts.ready")
            assert pg.evaluate('document.fonts.check("800 50px Archivo")')
            pg.screenshot(path=str(out / f"sss-{spec['date']}-{n}.png"))
        b.close()

if __name__ == "__main__":
    render(json.load(open(sys.argv[1])), sys.argv[2])
