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

IG_CSS = """
/* v4: cover fades to white with ink type (no black on slide 1) */
.cov{background:#fff !important;color:#111 !important}
.cov .fade{background:linear-gradient(to bottom,rgba(255,255,255,0) 0%,rgba(255,255,255,0) 40%,rgba(255,255,255,.93) 63%,#fff 75%) !important}
.cov .mega{color:#111}
.cov .sup{color:#5C5C57}.cov .sup b{color:#111}
.cov .otag{border-color:#111;color:#111}.cov .otag.g{border-color:#8A8A85;color:#5C5C57}
.cov .swipe{background:#111;color:#fff}

/* v3: full-bleed cover (Kalshi/FOS), ringed logo circles, Stake editorial inner slides, Elevate quote card */
.cov .bg{position:absolute;inset:0;background-size:cover;background-position:center 30%}
.cov .fade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(17,17,17,.45) 0%,rgba(17,17,17,0) 18%,rgba(17,17,17,0) 42%,rgba(17,17,17,.9) 70%,#111 84%)}
.rings{display:flex}
.ring{width:210px;height:210px;border-radius:50%;background:#fff;border:7px solid #D2FF3C;display:flex;align-items:center;justify-content:center;padding:34px;box-shadow:0 14px 40px rgba(0,0,0,.35)}
.ring+.ring{margin-left:-46px}
.ring img{max-width:100%;max-height:100%;object-fit:contain}
.swipe{display:inline-flex;align-items:center;gap:10px;background:#fff;color:#111;border-radius:6px;font-weight:800;font-size:20px;letter-spacing:.14em;text-transform:uppercase;padding:11px 18px 10px}
.ed{background:#fff;color:#111}
.ed h2{margin:0;font-weight:700;font-size:92px;line-height:1.0;letter-spacing:-.02em}
.ed .lede{font-size:36px;line-height:1.4;color:#33332F}
.ed hr{border:0;border-top:2px solid #DEDED8;margin:0}
.ed .src{font-size:20px;color:#8A8A85}
.kv{display:flex;justify-content:space-between;align-items:baseline;padding:24px 0;border-bottom:2px solid #DEDED8}
.kv span{font-size:28px;color:#5C5C57}
.kv b{font-weight:800;font-stretch:70%;font-size:64px;text-transform:uppercase;line-height:.9;text-align:right}
.qbase{display:flex;justify-content:center}
.qbase .lg{height:86px;width:220px;background:#fff;border-radius:6px;padding:14px 22px;display:flex;align-items:center;justify-content:center}
.qbase img{max-height:100%;max-width:100%;object-fit:contain}
.edrow{display:flex;align-items:center;gap:28px;padding:24px 0;border-top:2px solid #DEDED8}
.edrow:last-child{border-bottom:2px solid #DEDED8}
.edrow .lp{flex:none;width:220px;height:76px;display:flex;align-items:center;gap:12px}
.edrow .lp .s{flex:1;height:100%;display:flex;align-items:center;justify-content:center;min-width:0}
.edrow .lp img{max-width:100%;max-height:100%;object-fit:contain}
.edrow .lp .sx{color:#8A8A85;font-weight:800;font-size:26px}
.edrow .lp .nm{font-weight:800;font-stretch:72%;font-size:22px;text-transform:uppercase;color:#5C5C57;text-align:center;line-height:.95}
.edrow b{display:block;font-weight:700;font-size:38px;line-height:1.08;letter-spacing:-.01em}
.edrow span{display:block;font-size:24px;color:#5C5C57;margin-top:6px}

/* Instagram editorial set (Kalshi / Elevate / Stake): full-bleed photo, dark fade, outlined tag, huge white caps */
.ig{background:#111;color:#fff;padding:0}
.ig .bg{position:absolute;inset:0;background-size:cover;background-position:center 30%}
.ig .fade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(17,17,17,.55) 0%,rgba(17,17,17,0) 22%,rgba(17,17,17,0) 38%,rgba(17,17,17,.88) 62%,#111 76%)}
.ig .in{position:absolute;inset:0;padding:60px 64px 64px;display:flex;flex-direction:column}
.wl img{filter:brightness(0) invert(1)}
.wlock{display:inline-flex;align-items:center;gap:22px;height:116px}
.wlock .w{height:100%;width:210px;background:#fff;border-radius:6px;padding:16px 22px;display:flex;align-items:center;justify-content:center}
.wlock img{max-height:100%;max-width:100%;object-fit:contain}
.wlock .t{font-weight:800;font-stretch:72%;font-size:30px;text-transform:uppercase;line-height:.92;color:#111;text-align:center}
.wlock .x{font-weight:800;font-size:52px;color:#D2FF3C;line-height:.8}
.otag{display:inline-block;border:2.5px solid #D2FF3C;color:#D2FF3C;border-radius:6px;font-weight:800;font-size:22px;letter-spacing:.16em;text-transform:uppercase;padding:9px 16px 8px;line-height:1}
.otag.g{border-color:#A3A39E;color:#C9C9C4}.otag.w{border-color:#fff;color:#fff}
.mega{margin:0;font-weight:800;font-stretch:62%;text-transform:uppercase;line-height:.88;letter-spacing:-.01em;color:#fff;text-align:center}
.mega .v{color:#111}
.sup{font-weight:800;font-size:21px;letter-spacing:.16em;text-transform:uppercase;color:#A3A39E;text-align:center}
.sup b{color:#fff}
.igq{font-weight:600;font-size:52px;line-height:1.18;text-align:center;color:#fff;letter-spacing:-.005em}
.igq u{text-decoration:none;box-shadow:inset 0 -.14em 0 #D2FF3C}
.igfoot{display:flex;justify-content:space-between;align-items:flex-end;font-weight:800;font-size:20px;letter-spacing:.12em;text-transform:uppercase}
.igfoot span{color:#A3A39E;font-weight:600;letter-spacing:.04em;text-transform:none;font-size:22px}
.igrow{display:flex;align-items:center;gap:28px;padding:28px 0;border-top:1.5px solid #3A3A36}
.igrow:last-child{border-bottom:1.5px solid #3A3A36}
.igrow .lp{flex:none;width:230px;height:80px;display:flex;align-items:center;gap:16px}
.igrow .lp .s{flex:1;height:100%;display:flex;align-items:center;justify-content:center;min-width:0;background:#fff;border-radius:6px;padding:10px 12px}
.igrow .lp img{max-width:100%;max-height:100%;object-fit:contain}
.igrow .lp .sx{color:#D2FF3C;font-weight:800;font-size:28px}
.igrow .lp .nm{font-weight:800;font-stretch:72%;font-size:22px;text-transform:uppercase;color:#111;text-align:center;line-height:.95}
.igrow b{display:block;font-weight:800;font-stretch:66%;font-size:54px;text-transform:uppercase;line-height:.92;color:#fff}
.igrow span{display:block;font-size:24px;color:#A3A39E;margin-top:8px}
"""


def page(body, ink=False, pad=True):
    style = "" if pad else ' style="padding:0"'
    return (f"<style>{PL.font_css()}{PL.CSS}{CSS}{IG_CSS}</style>"
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
<div style="position:absolute;right:24px;bottom:{band_h + 14}px">{PL.credit_html(s.get("imageCredit")).replace('class="cred"', 'class="cred" style="font-weight:600;font-size:16px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.7)"')}</div>
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


# ---------- Instagram editorial set ----------

STATUS_TAG = {"new": "", "upgrade": "", "expansion": "", "renewal": " g", "extension": " g", "ended": " w"}


def otag(text):
    if not text:
        return ""
    return f'<span class="otag{STATUS_TAG.get(str(text).lower(), "")}">{e(text)}</span>'


def wlockup(item):
    """White brand x property lockup (Elevate style). Logos become white silhouettes; no logo = the name."""
    names = PL.split_pair(item.get("deal"))
    parts = []
    for path, name in zip(logo_paths(item), names):
        src = PL.data_uri(path) if path else ""
        parts.append(f'<div class="w"><img src="{src}" alt=""></div>' if src else f'<div class="w t">{e(name)}</div>')
    return f'<div class="wlock">{parts[0]}<span class="x">&times;</span>{parts[1]}</div>'


def ig_frame(inner, src=""):
    bg = f'<div class="bg" style="background-image:url(\'{src}\')"></div><div class="fade"></div>' if src else ""
    return page(f'{bg}<div class="in">{inner}</div>', ink=True, pad=False).replace('class="pf ink"', 'class="pf ink ig"')


def ig_top(n, total, colour="white"):
    return f'<div class="top">{PL.mark(colour, 30)}{count(n, total)}</div>'


def rings(item):
    """Kalshi / FOS style: logos in white circles ringed in volt. Only verified logos; none = no circles."""
    out = [f'<div class="ring"><img src="{PL.data_uri(p)}" alt=""></div>' for p in logo_paths(item) if p and PL.data_uri(p)]
    return f'<div class="rings">{"".join(out)}</div>' if out else ""


def ig_cover(s, n, total):
    src = photo(s.get("image"))
    head = PL.highlight(" ".join(s.get("headline_lines") or []), s.get("highlight"))
    b, p = PL.split_pair(s.get("deal"))
    sup = f'<b>{e(b)} &times; {e(p)}</b> &middot; {e(s.get("descriptor", ""))}'
    if not src:  # no photo: the logos carry the cover
        middle = f'<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:0 30px">{lockup(item_of(s), 300, 140, white=True, name_size=80)}</div>'
        bg = ""
    else:
        middle = f'<div style="flex:1;display:flex;justify-content:flex-end;align-items:flex-start;padding-top:30px">{rings(item_of(s))}</div>'
        bg = f'<div class="bg" style="background-image:url(\'{src}\')"></div><div class="fade"></div>'
    cred = PL.credit_html(s.get("imageCredit")).replace('class="cred"', 'class="cred" style="font-weight:600;font-size:16px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.7)"') if src else ""
    body = f"""<div class="top">{PL.mark("white", 30)}{cred}</div>{middle}
<div style="display:flex;flex-direction:column;align-items:center;gap:24px">{otag(s.get("status"))}
<h1 class="mega" data-fit="420" data-min="60" style="font-size:156px;width:100%">{head}</h1>
<div class="sup">{sup}</div><div class="swipe" style="margin-top:6px">Swipe &raquo;</div></div>"""
    return (f"<style>{PL.font_css()}{PL.CSS}{CSS}{IG_CSS}</style>"
            f'<div class="pf ink ig cov" style="padding:0">{bg}<div class="in">{body}</div></div>')


def ed_page(n, total, inner, foot=""):
    """Stake style: calm white editorial slide."""
    return page(f"""{top(right=count(n, total))}
<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px">{inner}</div>
{foot}""").replace('class="pf"', 'class="pf ed"')


def ig_story(s, n, total):
    facts = [f for f in (s.get("facts") or []) if f.get("value") and f.get("label")][:4]
    rows = "".join(f'<div class="kv"><span>{e(f["label"])}</span><b>{e(f["value"])}</b></div>' for f in facts)
    lede = e(s.get("summary") or "")
    src = e(s.get("source") or "Parade database")
    return ed_page(n, total, f"""<h2>The partnership</h2>{f'<div class="lede">{lede}</div>' if lede else ""}
<div>{rows}</div>""", f'<div class="src">Source: {src}</div>')


def ig_why(s, n, total):
    return ed_page(n, total, f"""<h2>Why it matters</h2><hr>
<div class="lede" style="font-size:44px;line-height:1.32;color:#111">{e(s["why"])}</div>""",
                   f'<div class="src">{e(s.get("deal", ""))}</div>')


def ig_quote(s, n, total):
    """Elevate style: dark card, centred quote, one word underlined, name left, title right, logo at the base."""
    q = s["quote"]
    text = e(q["text"])
    hw = q.get("highlight")
    if hw and e(hw) in text:
        text = text.replace(e(hw), f"<u>{e(hw)}</u>", 1)
    who = ", ".join(x for x in (q.get("title"), q.get("org")) if x)
    org_logo = ""
    for path, name in zip(logo_paths(item_of(s)), PL.split_pair(s.get("deal"))):
        if path and q.get("org") and q["org"].lower()[:5] in name.lower():
            org_logo = f'<div class="qbase"><div class="lg"><img src="{PL.data_uri(path)}" alt=""></div></div>'
    return ig_frame(f"""<div class="top" style="justify-content:center">{PL.mark("white", 30)}</div>
<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:0 16px">
<div class="igq" data-fit="760" data-min="30">&ldquo;{text}&rdquo;</div></div>
<div class="igfoot" style="margin-bottom:{40 if org_logo else 0}px"><div>{e(q.get("name"))}</div><span>{e(who)}</span></div>{org_logo}""")


def ig_roundup(s, n, total, limit=4):
    rows = []
    for o in (s.get("others") or [])[:limit]:
        names = PL.split_pair(o.get("deal"))
        cells = []
        for path, name in zip(logo_paths(o), names):
            src = PL.data_uri(path) if path else ""
            cells.append(f'<div class="s"><img src="{src}" alt=""></div>' if src else f'<div class="s"><div class="nm">{e(name)}</div></div>')
        rows.append(f'<div class="edrow"><div class="lp">{cells[0]}<span class="sx">&times;</span>{cells[1]}</div>'
                    f'<div style="min-width:0"><b>{e(o.get("deal"))}</b><span>{e(o.get("sub", ""))}</span></div></div>')
    return ed_page(n, total, f'<h2>Also this week</h2><div data-fit="820" data-min="8">{"".join(rows)}</div>')


def ig_save(n, total):
    return ig_frame(f"""{ig_top(n, total)}
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;text-align:center">
<span class="otag">Who backs who</span>
<div class="mega" style="font-size:168px">Every partnership, <span class="v" style="background:#D2FF3C;border-radius:6px;padding:0 .06em">filed.</span></div>
<div style="font-size:32px;line-height:1.35;color:#A3A39E;max-width:780px">ANZ, North America and the UK &amp; Ireland, logged as they land.</div></div>
<div style="display:flex;flex-direction:column;align-items:center;gap:22px"><div class="cta">Save it. Send it to a mate.</div><div class="sup"><b>Link in bio</b></div></div>""")

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
    ig = platform == "instagram"
    pages = []
    for n, k in enumerate(names, 1):
        if k == "cover":
            pages.append(ig_cover(s, n, total) if ig else cover(s, platform, n, total))
        elif k == "facts":
            pages.append(ig_story(s, n, total) if ig else facts_slide(s, n, total))
        elif k == "why":
            pages.append(ig_why(s, n, total) if ig else why_slide(s, n, total))
        elif k == "quote":
            pages.append(ig_quote(s, n, total) if ig else quote_slide(s, n, total))
        elif k == "roundup":
            pages.append(ig_roundup(s, n, total) if ig else roundup_slide(s, n, total, 5))
        else:
            pages.append(ig_save(n, total) if ig else save_slide(n, total, platform))
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
            print(f"{platform}: cover={'editorial' if platform == 'instagram' else pick_layout(spec, platform)} slides={','.join(names)}")
        b.close()


if __name__ == "__main__":
    which = sys.argv[3] if len(sys.argv) > 3 else "both"
    render(json.load(open(sys.argv[1])), sys.argv[2],
           ("linkedin", "instagram") if which == "both" else (which,))
