"""Parade partnerships carousel, built for engagement on LinkedIn and Instagram. Logos are the hero.

    python3 tools/parade_posts.py spec.json out_dir [linkedin|instagram|both]   (default both)

Every slide is 1080 x 1350 (4:5 portrait): the most feed space on both platforms, and Instagram's grid
crops it cleanly. One idea per slide, so each swipe is another page turn (dwell time).

LinkedIn (out_dir/linkedin/): the slides as PNGs AND one PDF, parade-<date>.pdf. Upload the PDF as a
document post: document carousels get the highest engagement rate on LinkedIn.
  1 cover       lockup | number | photo (see "layout")
  2 partnership fact tiles from the database row ("facts")
  3 why         one line of analysis ("why")
  4 quote       a named person's words, word for word ("quote")      <- the person to tag and DM
  5 round-up    recent partnerships with logo pairs ("others")
  6 save        "Save this." + every partnership, filed

Instagram (out_dir/instagram/): PNGs for a feed carousel. Same story, more visual: the cover leads with
the photo when there is one, the round-up is shorter (max 4), and the last slide asks for a save or
share and points to the link in bio.

Slides with no data are skipped (no facts -> no partnership slide, etc.), so old specs still work.

Spec (tools/linkedin_graphics.py format, plus optional fields):
 {"date":"YYYY-MM-DD","layout":"lockup|photo|number","status":"New",
  "headline_lines":["QANTAS","LOCKS IN","THE","WALLABIES."],"highlight":"LOCKS IN","number":"10 YEARS",
  "deal":"Brand x Property","descriptor":"Partnership type","image":"<unsplash or assets/ path>",
  "logos":{"brand":"assets/logos/a.png","property":"assets/logos/b.png"},
  "facts":[{"value":"5 years","label":"Length"}],
  "why":"One sentence on why it matters, with one highlight word.","why_highlight":"word",
  "quote":{"text":"Word for word from the release.","name":"Jane Smith","title":"CMO","org":"Brand"},
  "others":[{"deal":"Brand x Property","sub":"Sport - partnership type","logos":[...]}]}

Logos only ever come from the verified library (entities.json "logo" files in assets/logos/),
never assets/logos/_pending/. A missing logo falls back to the name in type.
"""
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parade_look as PL  # noqa: E402
from linkedin_graphics import photo, FIT  # noqa: E402

W, H = 1080, 1350
e = PL.esc

CSS = f"""
.pf{{width:{W}px;height:{H}px;padding:68px 72px 64px}}
.ink{{background:#111;color:#fff}}
.ink .meta{{color:#A3A39E}}.ink .meta b{{color:#fff}}
.top{{display:flex;justify-content:space-between;align-items:center;flex:none;height:44px}}
.cnt{{font-weight:800;font-size:20px;letter-spacing:.16em;color:#8A8A85;font-variant-numeric:tabular-nums}}
.lock{{display:flex;align-items:center;justify-content:center;gap:44px}}
.lock .side{{flex:1;height:100%;display:flex;align-items:center;justify-content:center;min-width:0}}
.lock img{{max-width:100%;max-height:100%;object-fit:contain;display:block}}
.lock .nm{{font-weight:800;font-stretch:72%;text-transform:uppercase;line-height:.9;text-align:center;letter-spacing:-.01em;overflow-wrap:anywhere}}
.lock .bx{{flex:none;font-weight:800;font-stretch:80%;line-height:.7;color:#111}}
.ink .lock .bx{{color:#D2FF3C}}
.facts{{display:grid;gap:20px}}
.tile{{background:#fff;color:#111;border-radius:6px;padding:36px 38px 32px;display:flex;flex-direction:column;justify-content:space-between}}
.tile .val{{font-weight:800;font-stretch:70%;text-transform:uppercase;font-size:120px;line-height:.86;letter-spacing:-.015em}}
.tile .lab{{font-weight:800;font-size:20px;letter-spacing:.16em;text-transform:uppercase;color:#5C5C57;margin-top:22px}}
.tile.vt{{background:#D2FF3C}}
.strip{{background:#fff;border-radius:6px;height:180px;padding:28px 44px}}
.rows{{display:flex;flex-direction:column}}
.row{{display:flex;align-items:center;gap:30px;padding:26px 0;border-top:2px solid #111}}
.row:last-child{{border-bottom:2px solid #111}}
.row .lp{{flex:none;width:250px;height:92px;display:flex;align-items:center;gap:14px}}
.row .lp .s{{flex:1;height:100%;display:flex;align-items:center;justify-content:center;min-width:0}}
.row .lp img{{max-width:100%;max-height:100%;object-fit:contain}}
.row .lp .sx{{font-weight:800;font-size:30px;color:#8A8A85}}
.row .lp .ini{{width:100%;height:100%;border-radius:6px;background:#F4F4F1;display:flex;align-items:center;justify-content:center;font-weight:800;font-stretch:72%;font-size:30px;text-transform:uppercase;color:#5C5C57}}
.row b{{display:block;font-weight:800;font-stretch:72%;font-size:46px;text-transform:uppercase;line-height:.95}}
.row span{{display:block;font-size:23px;color:#5C5C57;margin-top:8px}}
.num{{background:#D2FF3C;border-radius:6px;display:flex;align-items:center;justify-content:center;padding:0 40px}}
.num div{{font-weight:800;font-stretch:66%;text-transform:uppercase;line-height:.8;letter-spacing:-.02em;color:#111;white-space:nowrap}}
.ph{{position:absolute;left:0;right:0;top:0;background-size:cover;background-position:center 35%}}
.band{{position:absolute;left:0;right:0;bottom:0;background:#111;padding:48px 72px 64px;display:flex;flex-direction:column;justify-content:flex-end;gap:28px}}
.band .phl{{color:#fff}}
.qmark{{font-weight:800;font-stretch:70%;font-size:300px;line-height:.6;color:#D2FF3C;height:150px}}
.qt{{font-weight:800;font-stretch:74%;font-size:84px;line-height:1.0;letter-spacing:-.01em}}
.who b{{display:block;font-weight:800;font-size:34px;text-transform:uppercase;letter-spacing:.04em}}
.who span{{display:block;font-size:26px;color:#A3A39E;margin-top:8px}}
.big{{font-weight:800;font-stretch:70%;text-transform:uppercase;line-height:.92;letter-spacing:-.015em}}
.cta{{display:inline-flex;align-items:center;gap:18px;background:#D2FF3C;color:#111;border-radius:6px;padding:22px 30px;font-weight:800;font-size:28px;letter-spacing:.1em;text-transform:uppercase}}
"""


def page(body, ink=False, pad=True):
    style = "" if pad else ' style="padding:0"'
    return (f"<style>{PL.font_css()}{PL.CSS}{CSS}</style>"
            f'<div class="pf{" ink" if ink else ""}"{style}>{body}</div>')


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
        has_white = bool(path) and "." in path and (PL.ROOT / (path.rsplit(".", 1)[0] + "-white." + path.rsplit(".", 1)[1])).exists()
        chip = ' style="background:#fff;border-radius:6px;padding:14px 26px"' if (white and src and not has_white) else ""
        sides.append(f'<div class="side"{chip}><img src="{src}" alt=""></div>' if src else
                     f'<div class="side"><div class="nm" style="font-size:{name_size}px">{e(name)}</div></div>')
    return (f'<div class="lock" style="height:{height}px">{sides[0]}'
            f'<div class="bx" style="font-size:{x_size}px">&times;</div>{sides[1]}</div>')


def meta(s):
    b, p = PL.split_pair(s.get("deal"))
    pair = f"<b>{e(b)} &times; {e(p)}</b>" if p else f"<b>{e(b)}</b>"
    d = s.get("descriptor")
    return f'<div class="meta">{pair}{" &middot; " + e(d) if d else ""}</div>'


def top(colour="black", right=""):
    return f'<div class="top">{PL.mark(colour, 36)}{right}</div>'


def count(n, total):
    return f'<div class="cnt">{n:02d} / {total:02d}</div>'


def item_of(s):
    return {"deal": s.get("deal"), "logos": s.get("logos")}


def pick_layout(s, platform):
    lay = s.get("layout")
    has_photo = bool(photo(s.get("image")))
    if lay == "number" and s.get("number"):
        return "number"
    if lay == "photo" and has_photo:
        return "photo"
    if platform == "instagram" and has_photo and lay != "lockup":
        return "photo"  # Instagram is a visual feed: lead with the picture when there is one
    if lay == "lockup" or all(logo_paths(s)):
        return "lockup"
    return "photo" if has_photo else "lockup"


# ---------- slides ----------

def cover(s, platform, n, total):
    lay = pick_layout(s, platform)
    head = PL.highlight(" ".join(s.get("headline_lines") or []), s.get("highlight"))
    st = s.get("status")
    right = f'<span class="pill pv">{e(st)}</span>' if st else count(n, total)
    if lay == "lockup":
        return page(f"""{top(right=right)}
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 20px">{lockup(item_of(s), 360, 170, name_size=84)}</div>
<div style="flex:none;display:flex;flex-direction:column;gap:24px">
<h1 class="phl" data-fit="400" data-min="56" style="font-size:160px">{head}</h1>{meta(s)}</div>""")
    if lay == "number":
        return page(f"""{top(right=right)}
<div class="num" style="flex:none;height:520px;margin-top:40px"><div data-fit="480" data-min="80" style="font-size:400px;width:100%;text-align:center">{e(s["number"])}</div></div>
<div style="flex:none;margin-top:44px;padding:0 70px">{lockup(item_of(s), 150, 80, name_size=48)}</div>
<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:22px">
<h1 class="phl" data-fit="230" data-min="48" style="font-size:110px">{head}</h1>{meta(s)}</div>""")
    src = photo(s.get("image"))
    has_logo = any(logo_paths(s))
    band_h = 500 if has_logo else 400
    logos = (f'<div style="height:120px;padding:0 100px">{lockup(item_of(s), 120, 70, white=True, name_size=50)}</div>'
             if has_logo else "")
    return page(f"""<div class="ph" style="bottom:{band_h}px;background-image:url('{src}')"></div>
<div style="position:absolute;left:72px;right:72px;top:64px">{top("white", right)}</div>
<div class="band" style="height:{band_h}px">{logos}
<h1 class="phl" data-fit="200" data-min="44" style="font-size:112px">{head}</h1>{meta(s)}</div>""", ink=True, pad=False)


def facts_slide(s, n, total):
    facts = [f for f in (s.get("facts") or []) if f.get("value") and f.get("label")][:4]
    tiles = "".join(
        f'<div class="tile{" vt" if i == 0 else ""}"><div class="val" data-fit="230" data-min="40">{e(f["value"])}</div>'
        f'<div class="lab">{e(f["label"])}</div></div>' for i, f in enumerate(facts))
    cols = "1fr 1fr" if len(facts) > 1 else "1fr"
    return page(f"""{top("white", count(n, total))}
<h2 class="phl" style="font-size:96px;color:#fff;margin-top:48px">The <span class="v">partnership.</span></h2>
<div class="strip" style="margin-top:40px">{lockup(item_of(s), 124, 70, name_size=46)}</div>
<div class="facts" style="margin-top:20px;flex:1;grid-template-columns:{cols};grid-auto-rows:1fr">{tiles}</div>""", ink=True)


def why_slide(s, n, total):
    return page(f"""{top(right=count(n, total))}
<div class="meta" style="margin-top:64px">Why it matters</div>
<div style="flex:1;display:flex;align-items:center">
<div class="big" data-fit="900" data-min="56" style="font-size:132px">{PL.highlight(s["why"], s.get("why_highlight"))}</div></div>
{meta(s)}""")


def quote_slide(s, n, total):
    q = s["quote"]
    who = ", ".join(x for x in (q.get("title"), q.get("org")) if x)
    return page(f"""{top("white", count(n, total))}
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:10px">
<div class="qmark">&ldquo;</div>
<div class="qt" data-fit="700" data-min="40">{e(q["text"])}</div></div>
<div class="who" style="border-top:2px solid #D2FF3C;padding-top:30px"><b>{e(q.get("name"))}</b><span>{e(who)}</span></div>""", ink=True)


def roundup_slide(s, n, total, limit):
    rows = []
    for o in (s.get("others") or [])[:limit]:
        names = PL.split_pair(o.get("deal"))
        cells = []
        for path, name in zip(logo_paths(o), names):
            src = PL.data_uri(path) if path else ""
            ini = "".join(w[0] for w in re.findall(r"[A-Za-z0-9]+", name)[:3]) or "?"
            cells.append(f'<div class="s"><img src="{src}" alt=""></div>' if src else
                         f'<div class="s"><div class="ini">{e(ini)}</div></div>')
        rows.append(f'<div class="row"><div class="lp">{cells[0]}<span class="sx">&times;</span>{cells[1]}</div>'
                    f'<div style="min-width:0"><b>{e(o.get("deal"))}</b><span>{e(o.get("sub", ""))}</span></div></div>')
    label = s.get("label") or "Recent partnerships"
    w = e(label).rsplit(" ", 1)
    title = f'{w[0]} <span class="v">{w[1]}.</span>' if len(w) == 2 else f'<span class="v">{e(label)}.</span>'
    return page(f"""{top(right=count(n, total))}
<h2 class="phl" style="font-size:100px;margin-top:48px">{title}</h2>
<div class="rows" data-fit="860" data-min="8" style="margin-top:44px;flex:1;justify-content:center">{"".join(rows)}</div>""")


def save_slide(n, total, platform):
    where = "Link in bio" if platform == "instagram" else "sportsportsport.com.au"
    ask = "Save it. Send it to a mate." if platform == "instagram" else "Save it for your next pitch."
    return page(f"""{top("white", count(n, total))}
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px">
<div class="big" style="font-size:150px;color:#fff">Every partnership, <span class="v">filed.</span></div>
<div style="font-size:34px;line-height:1.35;color:#A3A39E;max-width:820px">New partnerships across ANZ, North America and the UK &amp; Ireland, logged as they land.</div></div>
<div style="display:flex;flex-direction:column;align-items:flex-start;gap:26px">
<div class="cta">{e(ask)}</div><div class="meta" style="color:#fff">{e(where)}</div></div>""", ink=True)


def plan(s):
    """Slides in order. Slides without data are skipped."""
    out = ["cover"]
    if [f for f in (s.get("facts") or []) if f.get("value") and f.get("label")]:
        out.append("facts")
    if s.get("why"):
        out.append("why")
    q = s.get("quote") or {}
    if q.get("text") and q.get("name"):
        out.append("quote")
    if s.get("others"):
        out.append("roundup")
    out.append("save")
    return out


def build(s, platform):
    names = plan(s)
    total = len(names)
    pages = []
    for n, k in enumerate(names, 1):
        if k == "cover":
            pages.append(cover(s, platform, n, total))
        elif k == "facts":
            pages.append(facts_slide(s, n, total))
        elif k == "why":
            pages.append(why_slide(s, n, total))
        elif k == "quote":
            pages.append(quote_slide(s, n, total))
        elif k == "roundup":
            pages.append(roundup_slide(s, n, total, 4 if platform == "instagram" else 5))
        else:
            pages.append(save_slide(n, total, platform))
    return names, pages


def render(spec, out, platforms=("linkedin", "instagram")):
    out = Path(out)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": W, "height": H})
        for platform in platforms:
            d = out / platform
            d.mkdir(parents=True, exist_ok=True)
            names, slides = build(spec, platform)
            files = []
            for i, h in enumerate(slides, 1):
                pg.set_content(h, wait_until="networkidle")
                pg.evaluate(FIT)
                fn = d / f"parade-{spec['date']}-slide{i}.png"
                pg.screenshot(path=str(fn))
                files.append(fn)
            if platform == "linkedin":
                from PIL import Image
                imgs = [Image.open(f).convert("RGB") for f in files]
                imgs[0].save(d / f"parade-{spec['date']}.pdf", save_all=True, append_images=imgs[1:], resolution=144)
            print(f"{platform}: cover={pick_layout(spec, platform)} slides={','.join(names)}")
        b.close()


if __name__ == "__main__":
    which = sys.argv[3] if len(sys.argv) > 3 else "both"
    render(json.load(open(sys.argv[1])), sys.argv[2],
           ("linkedin", "instagram") if which == "both" else (which,))
