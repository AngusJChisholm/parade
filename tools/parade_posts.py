"""Parade partnerships carousel (LinkedIn, 1080x1080): logos are the hero.

    python3 tools/parade_posts.py spec.json out_dir

Three slides, all in the Parade look (tools/parade_look.py: volt, ink, white, Archivo, 6px corners):
  slide1  Cover, one of three layouts ("layout" in the spec, or picked automatically):
          lockup  both logos verified: big brand x property logo lockup, headline under it
          photo   the lead photo with an ink band, white logos (or names) and the headline
          number  one huge verified figure on volt ("number"), small lockup, headline
  slide2  The partnership: ink slide, logo strip, up to four fact tiles ("facts")
          (skipped when there are no facts, so old specs still make two slides)
  slide3  Recent partnerships: logo pair, name and "Sport - type" for each of "others"

Spec (same as tools/linkedin_graphics.py, plus the optional new fields):
 {"date":"YYYY-MM-DD","label":"Recent partnerships","layout":"lockup|photo|number","status":"New",
  "headline_lines":["QANTAS","LOCKS IN","THE","WALLABIES."],"highlight":"LOCKS IN","number":"10 YEARS",
  "deal":"Brand x Property","descriptor":"Partnership type","image":"<unsplash or assets/ path>",
  "logos":{"brand":"assets/logos/a.png","property":"assets/logos/b.png"},
  "facts":[{"value":"5 years","label":"Length"}],
  "others":[{"deal":"Brand x Property","sub":"Sport - partnership type","logos":[...]}]}

Logos only ever come from the verified library (entities.json "logo" files in assets/logos/),
never assets/logos/_pending/. A missing logo falls back to the name in type.
Writes parade-<date>-slide1.png, -slide2.png (facts) and the round-up as the last slide.
"""
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parade_look as PL  # noqa: E402
from linkedin_graphics import photo, FIT  # noqa: E402

e = PL.esc

CSS = """
.pf{width:1080px;height:1080px;padding:64px 72px}
.ink{background:#111;color:#fff}
.ink .meta{color:#A3A39E}.ink .meta b{color:#fff}
.top{display:flex;justify-content:space-between;align-items:center;flex:none;height:40px}
.date{font-weight:800;font-size:18px;letter-spacing:.18em;color:#8A8A85}
/* the lockup: two logos joined by the big x */
.lock{display:flex;align-items:center;justify-content:center;gap:44px}
.lock .side{flex:1;height:100%;display:flex;align-items:center;justify-content:center;min-width:0}
.lock img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.lock .nm{font-weight:800;font-stretch:72%;text-transform:uppercase;line-height:.9;text-align:center;font-size:72px;letter-spacing:-.01em;overflow-wrap:anywhere}
.lock .bx{flex:none;font-weight:800;font-stretch:80%;line-height:.7;color:#111}
.ink .lock .bx{color:#D2FF3C}
.tagrow{display:flex;gap:12px;align-items:center}
/* fact tiles */
.facts{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.tile{background:#fff;color:#111;border-radius:6px;padding:34px 36px 30px;display:flex;flex-direction:column;justify-content:space-between;min-height:250px}
.tile .val{font-weight:800;font-stretch:70%;text-transform:uppercase;font-size:112px;line-height:.86;letter-spacing:-.015em}
.tile .lab{font-weight:800;font-size:20px;letter-spacing:.16em;text-transform:uppercase;color:#5C5C57;margin-top:22px}
.tile.vt{background:#D2FF3C}
.strip{background:#fff;border-radius:6px;height:170px;padding:26px 40px}
/* round-up rows */
.rows{display:flex;flex-direction:column}
.row{display:flex;align-items:center;gap:30px;padding:22px 0;border-top:2px solid #111}
.row:last-child{border-bottom:2px solid #111}
.row .lp{flex:none;width:250px;height:88px;display:flex;align-items:center;gap:14px}
.row .lp .s{flex:1;height:100%;display:flex;align-items:center;justify-content:center;min-width:0}
.row .lp img{max-width:100%;max-height:100%;object-fit:contain}
.row .lp .sx{font-weight:800;font-size:30px;color:#8A8A85}
.row .lp .ini{width:100%;height:100%;border-radius:6px;background:#F4F4F1;display:flex;align-items:center;justify-content:center;font-weight:800;font-stretch:72%;font-size:30px;text-transform:uppercase;color:#5C5C57}
.row b{display:block;font-weight:800;font-stretch:72%;font-size:40px;text-transform:uppercase;line-height:.95}
.row span{display:block;font-size:22px;color:#5C5C57;margin-top:8px}
/* big number */
.num{background:#D2FF3C;border-radius:6px;display:flex;align-items:center;justify-content:center;padding:0 40px}
.num div{font-weight:800;font-stretch:66%;text-transform:uppercase;line-height:.8;letter-spacing:-.02em;color:#111;white-space:nowrap}
/* photo layout */
.ph{position:absolute;inset:0 0 400px 0;background-size:cover;background-position:center 35%}
.band{position:absolute;left:0;right:0;bottom:0;height:400px;background:#111;padding:44px 72px 60px;display:flex;flex-direction:column;justify-content:flex-end;gap:26px}
.band .phl{color:#fff}
"""


def page(body, ink=False):
    return (f"<style>{PL.font_css()}{PL.CSS}{CSS}</style>"
            f'<div class="pf{" ink" if ink else ""}">{body}</div>')


def logo_paths(item):
    lg = item.get("logos")
    if isinstance(lg, dict):
        paths = [lg.get("brand"), lg.get("property")]
    elif isinstance(lg, list):
        paths = (list(lg) + [None, None])[:2]
    else:
        b, p = PL.split_pair(item.get("deal"))
        paths = [PL.logo_path(b), PL.logo_path(p)]
    return [p if p and "/_pending/" not in str(p) else None for p in paths]


def lockup(item, height, x_size, white=False, name_size=72):
    """Brand x property. A side with no verified logo shows its name in type."""
    names = PL.split_pair(item.get("deal"))
    sides = []
    for path, name in zip(logo_paths(item), names):
        src = PL.data_uri(path, prefer_white=white) if path else ""
        sides.append(f'<div class="side"><img src="{src}" alt=""></div>' if src else
                     f'<div class="side"><div class="nm" style="font-size:{name_size}px">{e(name)}</div></div>')
    return (f'<div class="lock" style="height:{height}px">{sides[0]}'
            f'<div class="bx" style="font-size:{x_size}px">&times;</div>{sides[1]}</div>')


def both_logos(item):
    return all(logo_paths(item))


def meta(s):
    b, p = PL.split_pair(s.get("deal"))
    pair = f"<b>{e(b)} &times; {e(p)}</b>" if p else f"<b>{e(b)}</b>"
    d = s.get("descriptor")
    return f'<div class="meta">{pair}{" &middot; " + e(d) if d else ""}</div>'


def top(s, colour="black", pill=True):
    st = s.get("status")
    right = f'<span class="pill pv">{e(st)}</span>' if (pill and st) else f'<div class="date">{e(s.get("date", ""))}</div>'
    return f'<div class="top">{PL.mark(colour, 34)}{right}</div>'


def pick_layout(s):
    lay = s.get("layout")
    if lay == "number" and s.get("number"):
        return "number"
    if lay == "photo" and photo(s.get("image")):
        return "photo"
    if lay == "lockup" or both_logos(s):
        return "lockup"
    return "photo" if photo(s.get("image")) else "lockup"


def cover(s):
    lay = pick_layout(s)
    head = PL.highlight(" ".join(s.get("headline_lines") or []), s.get("highlight"))
    item = {"deal": s.get("deal"), "logos": s.get("logos")}
    if lay == "lockup":
        return page(f"""{top(s)}
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:10px 20px 0">{lockup(item, 300, 150)}</div>
<div style="flex:none;display:flex;flex-direction:column;gap:22px">
<h1 class="phl" data-fit="330" data-min="56" style="font-size:150px">{head}</h1>{meta(s)}</div>""")
    if lay == "number":
        return page(f"""{top(s)}
<div class="num" style="flex:none;height:400px;margin-top:34px"><div data-fit="380" data-min="80" style="font-size:330px;width:100%;text-align:center">{e(s["number"])}</div></div>
<div style="flex:none;margin-top:36px;padding:0 60px">{lockup(item, 130, 70, name_size=44)}</div>
<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:20px">
<h1 class="phl" data-fit="190" data-min="48" style="font-size:96px">{head}</h1>{meta(s)}</div>""")
    # photo
    src = photo(s.get("image"))
    return (f"<style>{PL.font_css()}{PL.CSS}{CSS}</style>"
            f'<div class="pf ink" style="padding:0"><div class="ph" style="background-image:url(\'{src}\')"></div>'
            f'<div style="position:absolute;left:72px;right:72px;top:56px">{top(s, "white")}</div>'
            f'<div class="band">' + (f'<div style="height:110px;padding:0 90px">{lockup(item, 110, 64, white=True, name_size=46)}</div>' if any(logo_paths(item)) else '') +
            f'<h1 class="phl" data-fit="150" data-min="44" style="font-size:96px">{head}</h1>{meta(s)}</div></div>')


def facts_slide(s):
    facts = [f for f in (s.get("facts") or []) if f.get("value") and f.get("label")][:4]
    if not facts:
        return ""
    item = {"deal": s.get("deal"), "logos": s.get("logos")}
    tiles = "".join(
        f'<div class="tile{" vt" if i == 0 else ""}"><div class="val" data-fit="200" data-min="40">{e(f["value"])}</div>'
        f'<div class="lab">{e(f["label"])}</div></div>' for i, f in enumerate(facts))
    cols = "1fr 1fr" if len(facts) > 1 else "1fr"
    return page(f"""{top(s, "white", pill=False)}
<h2 class="phl" style="font-size:84px;color:#fff;margin-top:40px">The <span class="v">partnership.</span></h2>
<div class="strip" style="margin-top:34px">{lockup(item, 118, 64, name_size=44)}</div>
<div class="facts" style="margin-top:20px;flex:1;grid-template-columns:{cols};grid-auto-rows:1fr">{tiles}</div>""", ink=True)


def roundup_slide(s):
    rows = []
    for o in (s.get("others") or [])[:5]:
        sub = str(o.get("sub") or "")
        names = PL.split_pair(o.get("deal"))
        cells = []
        for path, name in zip(logo_paths(o), names):
            src = PL.data_uri(path) if path else ""
            ini = "".join(w[0] for w in re.findall(r"[A-Za-z0-9]+", name)[:3]) or "?"
            cells.append(f'<div class="s"><img src="{src}" alt=""></div>' if src else
                         f'<div class="s"><div class="ini">{e(ini)}</div></div>')
        rows.append(f'<div class="row"><div class="lp">{cells[0]}<span class="sx">&times;</span>{cells[1]}</div>'
                    f'<div style="min-width:0"><b>{e(o.get("deal"))}</b><span>{e(sub)}</span></div></div>')
    label = s.get("label") or "Recent partnerships"
    w = e(label).rsplit(" ", 1)
    title = f'{w[0]} <span class="v">{w[1]}.</span>' if len(w) == 2 else f'<span class="v">{e(label)}.</span>'
    return page(f"""{top(s, pill=False)}
<h2 class="phl" style="font-size:96px;margin-top:40px">{title}</h2>
<div class="rows" data-fit="640" data-min="8" style="margin-top:36px;flex:1">{"".join(rows)}</div>
<div class="pfoot" style="margin-top:24px;white-space:nowrap"><div class="meta">Every partnership, filed &middot; sportsportsport.com.au</div></div>""")


def render(spec, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    slides = [cover(spec)]
    f = facts_slide(spec)
    if f:
        slides.append(f)
    slides.append(roundup_slide(spec))
    names = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1080})
        for i, h in enumerate(slides, 1):
            pg.set_content(h, wait_until="networkidle")
            pg.evaluate(FIT)
            fn = out / f"parade-{spec['date']}-slide{i}.png"
            pg.screenshot(path=str(fn))
            names.append(fn.name)
        b.close()
    print("layout:", pick_layout(spec), "|", ", ".join(names))


if __name__ == "__main__":
    render(json.load(open(sys.argv[1])), sys.argv[2])
