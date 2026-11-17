"""One header, header search and footer on every page.

Replaces each page's <header>...</header> and <footer>...</footer> with the site chrome below, and links
assets/chrome.css and assets/chrome.js (styles and behaviour live there). Safe to re-run.

Covers the top-level pages, profile.html (the template tools/build_profiles.py turns into every brand and
property page), tools/article_template.html and the articles already built from it. After running it,
rebuild the generated pages:  python3 tools/build_profiles.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>'


def header(p):
    nav = "".join(f'<a href="{p}{h}" data-nav="{h}">{t}</a>' for h, t in [
        ("partnerships", "Partnerships"), ("brands", "Brands"), ("properties", "Properties"), ("news", "News"), ("insights", "Insights")])
    return f"""<header class="v2"><div class="wrap hd">
<a href="{p or './'}" class="logo brand-logo" aria-label="Sport Sport Sport home"><img src="{p}assets/wordmark-black.svg" alt="Sport Sport Sport" width="56" height="42"></a>
<nav class="nav" id="nav" aria-label="Main">{nav}</nav>
<div class="hd-r"><a class="login" href="{p}pro" data-nav="pro">Pro</a><button type="button" class="btn2 hs-b" id="hsB" aria-label="Search brands and properties" aria-expanded="false" aria-controls="hs">{SEARCH_ICON}<span>Search</span></button></div>
<button type="button" class="menu" id="menu" aria-expanded="false" aria-controls="nav">Menu</button>
</div>
<div class="hs" id="hs" hidden><div class="wrap"><div class="hs-f" role="search"><label for="hsQ" style="position:absolute;left:-9999px">Search a club, league, event or brand</label><input id="hsQ" type="search" autocomplete="off" placeholder="Search a club, league, event or brand"><div class="hs-r" id="hsR" hidden></div></div><div class="hs-h"><span>Press / to search from any page.</span><a href="{p}partnerships">Every partnership →</a></div></div></div>
</header>"""


def footer(p, year='<span id="yr">2026</span>'):
    links = "".join(f'<a href="{p}{h}">{t}</a>' for h, t in [
        ("partnerships", "Partnerships"), ("brands", "Brands"), ("properties", "Properties"),
        ("leagues", "League maps"), ("categories", "Categories"), ("news", "News"), ("insights", "Insights")])
    return f"""<footer class="v2"><div class="wrap">
<div class="ft"><div><a href="{p or './'}" class="logo brand-logo" aria-label="Sport Sport Sport home"><img src="{p}assets/wordmark-black.svg" alt="Sport Sport Sport" width="120" height="90"></a>
<p class="so">Who backs <span class="vb">who</span> in sport.</p></div>
<nav class="ft-l" aria-label="Footer">{links}</nav></div>
<div class="ft-b"><span>Filed in Melbourne.</span><span>© {year} <span data-brand="name">Sport Sport Sport</span></span></div>
</div></footer>"""


HEAD_RE = re.compile(r"<header\b[^>]*>.*?</header>", re.S)
FOOT_RE = re.compile(r"<footer\b[^>]*>.*?</footer>", re.S)
# Old per-page menu toggles: chrome.js handles the menu now, and two toggles cancel each other out.
OLD_MENU = [
    re.compile(r'\$\("menu"\)\.onclick=\(\)=>\{const o=\$\("nav"\)\.classList\.toggle\("open"\);[^\n]*?\};'),
    re.compile(r'<script>document\.getElementById\("menu"\)\.onclick=function\(\)\{[^<]*\}</script>\n?'),
]


def apply(text, p, year=None):
    if "<header" not in text:
        return None
    text = HEAD_RE.sub(lambda m: header(p), text, count=1)
    text = FOOT_RE.sub(lambda m: footer(p, year) if year else footer(p), text, count=1)
    for r in OLD_MENU:
        text = r.sub("", text)
    if "chrome.css" not in text:
        text = text.replace("</head>", f'<link rel="stylesheet" href="{p}assets/chrome.css?v=2">\n</head>', 1)
    if "chrome.js" not in text:
        text = text.replace("</body>", f'<script src="{p}assets/chrome.js?v=2"></script>\n</body>', 1)
    return text


def main():
    skip = {"logo-sheet.html", "deals.html"}
    targets = [(f, "", None) for f in sorted(ROOT.glob("*.html")) if f.name not in skip]
    targets.append((ROOT / "tools" / "article_template.html", "../", '<span id="yr">{{YEAR}}</span>'))
    if "--articles" in sys.argv:
        targets += [(f, "../", None) for f in sorted((ROOT / "articles").glob("*.html"))]
    n = 0
    for f, p, year in targets:
        t = f.read_text(encoding="utf-8")
        new = apply(t, p, year)
        if new is None:
            print("skip (no header):", f.relative_to(ROOT))
            continue
        if new != t:
            f.write_text(new, encoding="utf-8")
            n += 1
    print(f"{n} files updated")


if __name__ == "__main__":
    main()
