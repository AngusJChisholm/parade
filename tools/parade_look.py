"""Parade social look (from 20 Nov 2026), shared by tools/instagram_render.py and tools/linkedin_graphics.py.

White canvas, rounded photo card, logos straight on white (never boxed), condensed Archivo caps,
one volt highlight with rounded corners, Parade mark top left, quiet grey counter top right.
Logos come only from the verified library: entities.json "logo" files in assets/logos/.

Corners: one curve across the brand, taken from the logo square (6px at the 1000px profile size).
Every highlight, tag, button, card and photo uses R = 6px on a 1080px canvas. Nothing is fully round.
"""
import base64
import html
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOLT = "#D2FF3C"
INK = "#111111"
esc = lambda s: html.escape(str(s or ""), quote=True)

_FONT = None


def font_css():
    """Archivo with its width axis, so headlines can use the condensed cut (font-stretch 70%)."""
    global _FONT
    if _FONT is None:
        f = base64.b64encode((ROOT / "assets/fonts/Archivo[wdth,wght].ttf").read_bytes()).decode()
        _FONT = ("@font-face{font-family:PArchivo;src:url(data:font/ttf;base64," + f +
                 ");font-weight:100 900;font-stretch:62% 125%}")
    return _FONT


def mark(colour="black", height=30):
    name = "parade-mark-white.svg" if colour == "white" else "parade-mark-black.svg"
    src = "data:image/svg+xml;base64," + base64.b64encode((ROOT / "assets" / name).read_bytes()).decode()
    return f'<img class="pm" src="{src}" alt="Parade" style="height:{height}px;width:auto;display:block">'


# ---------- logos (verified library only) ----------

_LOGOS = None


def _norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _logo_index():
    global _LOGOS
    if _LOGOS is None:
        _LOGOS = {}
        try:
            ents = json.loads((ROOT / "entities.json").read_text())["entities"]
        except Exception:
            ents = {}
        for v in ents.values():
            p = v.get("logo")
            if not p or not (ROOT / p).exists():
                continue
            for n in [v.get("name")] + list(v.get("aliases") or []):
                if n:
                    _LOGOS.setdefault(_norm(n), p)
    return _LOGOS


def logo_path(name):
    """Verified logo file for a brand or property name, or None."""
    return _logo_index().get(_norm(name)) if name else None


def split_pair(deal):
    parts = re.split(r"\s+[x×]\s+", str(deal or ""), maxsplit=1)
    return (parts + [""])[:2]


def data_uri(p, prefer_white=False):
    p = str(p or "")
    if prefer_white and "." in p:
        w = p.rsplit(".", 1)[0] + "-white." + p.rsplit(".", 1)[1]
        if (ROOT / w).exists():
            p = w
    if not re.fullmatch(r"assets/logos/[\w.-]+\.(png|svg|webp)", p) or not (ROOT / p).exists():
        return ""
    mime = {"png": "image/png", "svg": "image/svg+xml", "webp": "image/webp"}[p.rsplit(".", 1)[1]]
    return f"data:{mime};base64," + base64.b64encode((ROOT / p).read_bytes()).decode()


def pair_logos(item, cls="lgp"):
    """Brand × property logos for a queue/spec item. Uses explicit "logos" first, then the library.
    Returns "" when neither side has a verified logo (the name stays as text)."""
    lg = item.get("logos")
    if isinstance(lg, dict):
        paths = [lg.get("brand"), lg.get("property")]
    elif isinstance(lg, list):
        paths = (lg + [None, None])[:2]
    else:
        b, p = split_pair(item.get("deal"))
        paths = [logo_path(b), logo_path(item.get("property") or p)]
    srcs = [data_uri(x) for x in paths]
    srcs = [s for s in srcs if s]
    if not srcs:
        return ""
    sep = '<span class="lx">×</span>' if len(srcs) == 2 else ""
    return f'<div class="{cls}">' + sep.join(f'<img src="{s}" alt="">' for s in srcs) + "</div>"


def highlight(text, word):
    t = esc(text)
    if not word:
        return t
    w = esc(word)
    i = t.lower().find(w.lower())
    return t if i < 0 else t[:i] + f'<span class="v">{t[i:i + len(w)]}</span>' + t[i + len(w):]


CSS = """
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:PArchivo,'Helvetica Neue',Arial,sans-serif;font-weight:500;color:#111;background:#fff;-webkit-font-smoothing:antialiased}
.pf{position:relative;overflow:hidden;background:#fff;color:#111;display:flex;flex-direction:column}
.ptop{display:flex;justify-content:space-between;align-items:center;flex:none}
.pcount{font-weight:800;font-size:20px;letter-spacing:.18em;color:#8A8A85}
.phl{margin:0;font-weight:800;font-stretch:70%;text-transform:uppercase;line-height:.88;letter-spacing:-.015em;color:#111}
.v{background:#D2FF3C;color:#111;border-radius:6px;padding:0 .07em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.pcard{position:relative;border-radius:6px;overflow:hidden;background:#F4F4F1;flex:none}
.pcard .img{position:absolute;inset:0;background-size:cover;background-position:center 30%}
.pill{display:inline-flex;align-items:center;border-radius:6px;font-weight:800;font-size:20px;letter-spacing:.14em;text-transform:uppercase;padding:12px 20px 11px;line-height:1;white-space:nowrap}
.pv{background:#D2FF3C;color:#111}.pg{background:#F4F4F1;color:#5C5C57}.pk{background:#111;color:#fff}
.pcard .pill{position:absolute;left:28px;bottom:28px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.pcard .cred{position:absolute;right:16px;bottom:12px;font-weight:600;font-size:15px;letter-spacing:.02em;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.7)}
.lgp{display:flex;align-items:center;gap:22px}
.lgp img{height:88px;max-width:260px;object-fit:contain;display:block}
.lgp .lx{font-weight:800;font-size:40px;color:#8A8A85}
.meta{font-weight:800;font-size:20px;letter-spacing:.16em;text-transform:uppercase;color:#5C5C57;line-height:1.5}
.meta b{color:#111}
.cards{display:flex;flex-direction:column;gap:1em;font-size:16px}
.crd{display:flex;align-items:center;gap:1.6em;background:#F7F7F4;border-radius:6px;padding:1.5em 1.8em}
.crd .n{flex:none;width:3.4em;height:3.4em;border-radius:6px;background:#111;color:#fff;font-weight:800;font-size:1em;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}
.crd .t{flex:1;min-width:0}
.crd b{display:block;font-weight:800;font-stretch:74%;font-size:2.6em;text-transform:uppercase;line-height:.95;letter-spacing:-.005em}
.crd span.x{display:block;font-size:1.45em;color:#5C5C57;margin-top:.45em;line-height:1.35}
.crd .s{display:inline-flex;margin-bottom:.7em;font-size:.9em;padding:.55em .8em .5em}
.crd .lgp{flex:none;gap:.7em}.crd .lgp img{height:3.6em;max-width:5.8em;object-fit:contain}.crd .lgp .lx{display:none}
.pfoot{display:flex;justify-content:space-between;align-items:center;flex:none}
"""


def credit_html(credit):
    """'Photo: X' on a photo card, for any photo that isn't Unsplash (SOURCES.md rule 5)."""
    c = str(credit or "").strip()
    return "" if (not c or c.lower() == "unsplash") else f'<span class="cred">Photo: {esc(c)}</span>'
