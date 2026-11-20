"""Render the two daily LinkedIn graphics (1080x1080) in the Parade look (tools/parade_look.py).

    python3 tools/linkedin_graphics.py spec.json out_dir

spec.json: {"date":"YYYY-MM-DD","headline_lines":["MONACO'S","SHIRT FOR","EUROPE","ONLY."],
 "highlight":"EUROPE","deal":"Brand x Property","descriptor":"Deal type",
 "others":[{"deal":"Brand x Property","sub":"Sport - deal type"}, ...]}
Optional "label": slide 2 heading (default "Recent deals"), e.g. "The numbers" on a data drop.
Optional "image": the lead's photo ("assets/..." file or an images.unsplash.com link,
same as its deals.json "image"). Slide 1 then sits on the photo; leave it out for plain black.
Optional "status": a tag on the photo, e.g. "New", "Renewal", "Upgrade".
Optional "logos": {"brand":"assets/logos/<slug>.png","property":"assets/logos/<slug>.png"} for the lead,
and "logos": [brand_path, property_path] on each "others" item. Only verified files in assets/logos/ are drawn;
a missing or unknown path is skipped and the name stays as text.
Writes sss-<date>-slide1.png (headline) and sss-<date>-slide2.png (other deals).
"""
import base64, html, json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
import parade_look as PL

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

FIT = """async () => {await document.fonts.ready;
for (const el of document.querySelectorAll('[data-fit]')) {const maxH=parseFloat(el.dataset.fit);let size=parseFloat(getComputedStyle(el).fontSize);const min=parseFloat(el.dataset.min||'40');
while (size>min && (el.scrollHeight>maxH || el.scrollWidth>el.clientWidth+2)) {size-=Math.max(.5,size*.04);el.style.fontSize=size+'px';}}}"""


def _p(body):
    return f"<style>{PL.font_css()}{PL.CSS}.pf{{width:1080px;height:1080px;padding:56px}}</style>{body}"


def slide1(s):
    """Parade look: rounded photo card, verified logos on white, condensed headline, one volt highlight."""
    src = photo(s.get("image"))
    item = {"deal": s.get("deal", ""), "logos": s.get("logos")}
    logos = PL.pair_logos(item)
    status = s.get("status") or ""
    pill = f'<span class="pill pv">{e(status)}</span>' if status else ""
    card = (f'<div class="pcard" style="height:{470 if logos else 560}px;margin-top:32px">'
            f'<div class="img" style="background-image:url(\'{src}\')"></div>{pill}</div>') if src else (f'<div style="margin-top:40px">{pill}</div>' if pill else "")
    head = " ".join(s.get("headline_lines") or [])
    brand, prop = PL.split_pair(s.get("deal"))
    pair = f"<b>{e(brand)} &times; {e(prop)}</b>" if prop else f"<b>{e(brand)}</b>"
    return _p(f"""<div class="pf"><div class="ptop">{PL.mark("black", 30)}<div class="pcount">{e(s.get("date",""))}</div></div>{card}
{f'<div style="margin-top:34px">{logos}</div>' if logos else ""}
<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:20px;margin-top:26px">
<h1 class="phl" data-fit="{230 if src else 520}" data-min="48" style="font-size:{112 if src else 170}px">{PL.highlight(head, s.get("highlight"))}</h1>
<div class="meta">{pair} &middot; {e(s.get("descriptor",""))}</div></div></div>""")


def slide2(s):
    """Recent partnerships: one card per partnership, logos on the left."""
    cards = []
    for o in s.get("others", [])[:5]:
        sub = str(o.get("sub") or "")
        sport, _, rest = sub.partition(" - ")
        if not rest:
            sport, rest = "", sub
        cards.append('<div class="crd">' + PL.pair_logos(o) + '<div class="t">'
                     + (f'<span class="pill pv s">{e(sport)}</span>' if sport else "")
                     + f'<b>{e(o["deal"])}</b>' + (f'<span class="x">{e(rest)}</span>' if rest else "") + "</div></div>")
    label = s.get("label") or "Recent partnerships"
    words = e(label).rsplit(" ", 1)
    title = (words[0] + ' <span class="v">' + words[1] + '.</span>') if len(words) == 2 else f'<span class="v">{e(label)}.</span>'
    return _p(f"""<div class="pf"><div class="ptop">{PL.mark("black", 30)}<div class="pcount">{e(s.get("date",""))}</div></div>
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px">
<h2 class="phl" style="font-size:96px">{title}</h2>
<div class="cards" data-fit="660" data-min="8" style="font-size:16px">{"".join(cards)}</div></div>
<div class="pfoot"><div class="meta">Every partnership, filed &middot; link in comments</div></div></div>""")


def render(spec, out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1080, "height": 1080})
        for n, h in (("slide1", slide1(spec)), ("slide2", slide2(spec))):
            pg.set_content(h, wait_until="networkidle"); pg.evaluate(FIT)
            pg.screenshot(path=str(out / f"sss-{spec['date']}-{n}.png"))
        b.close()

if __name__ == "__main__":
    render(json.load(open(sys.argv[1])), sys.argv[2])
