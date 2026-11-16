"""Finds clean logos on Wikidata / Wikipedia for brands and properties that Brandfetch can't show well.
Runs on GitHub (.github/workflows/logo-wiki.yml): Claude's sandbox can't reach Wikimedia. Never touches Brandfetch.

Who it looks for: every brand and property with no local logo whose Brandfetch entry is missing or icon-only
(an icon is a square tile with a background), plus local logos listed in REPLACE. Athletes are skipped.

For each one:
  1. Wikidata search on the name (and aliases). A result is only kept if its English label or an alias matches
     the name exactly (ignoring case, accents, "FC", "Ltd", "Group" and the like) and it isn't a person, place,
     creative work or disambiguation page.
     - If we know the official website, the result's website (P856) must be on the same domain.
     - If we don't, its description must read like an organisation, brand, club or event, and exactly one result
       may pass (ties are broken by country from the market of its deals, otherwise it's left for review).
  2. Logo: Wikidata's logo image (P154, current one first). Failing that, the English Wikipedia article's lead
     image, but only if the file name says logo/crest/badge/emblem/wordmark or it's an SVG.
  3. tools/logo_clean.py: removes a plain white background, trims to the artwork, PNG, max 512px.
     Busy backgrounds (photos, promo graphics) are refused.
Output (out/): logos/<slug>.png, report.json, and contact sheets sheets/NN.png for a person to check.
Nothing here edits entities.json: the merge happens after review.
Args: [limit] [slug ...]   e.g.  python3 tools/logo_wiki.py 50"""
import io, json, os, re, sys, threading, time, unicodedata, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__))
import logo_clean as C
from PIL import Image, ImageDraw, ImageFont

UA = {"User-Agent": "SportSportSportLogoBot/1.0 (https://sportsportsport.com.au/; logo matching for a sponsorship news site)",
      "Accept-Encoding": "identity"}
WD = "https://www.wikidata.org/w/api.php"
EN = "https://en.wikipedia.org/w/api.php"
OUT = "out"
REPLACE = {"deepcoin", "us-open", "winna-com", "paralympics-australia"}   # local files that are promo art or app tiles

E = json.load(open("entities.json")); ents = E["entities"]
deals = json.load(open("deals.json"))["deals"]

SUFFIX = r"\b(fc|f c|afc|sc|cf|fk|ac|football club|soccer club|rugby league club|rugby union club|rugby club|netball club|basketball club|cricket club|club|ltd|limited|pty|inc|llc|plc|gmbh|ag|sa|nv|bv|spa|s p a|group|holdings|co|company|corporation|corp|official|the|brand)\b"


def base(s):
    s = unicodedata.normalize("NFKD", str(s or "")); s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\(.*?\)", " ", s.lower()).replace("&", " and ").replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def loose(s):
    return re.sub(r"\s+", " ", re.sub(SUFFIX, " ", base(s))).strip() or base(s)


# ---------- HTTP, polite and serial per host ----------
locks = {}; last = {}; ERRORS = []
GAP = {"www.wikidata.org": 0.2, "en.wikipedia.org": 0.2, "upload.wikimedia.org": 0.35}


def get(url, binary=False):
    host = urllib.parse.urlparse(url).netloc
    lk = locks.setdefault(host, threading.Lock())
    for attempt in range(5):
        with lk:
            wait = last.get(host, 0) + GAP.get(host, 0.3) - time.time()
            if wait > 0: time.sleep(wait)
            last[host] = time.time()
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30)
            data = r.read()
            return data if binary else json.loads(data)
        except urllib.error.HTTPError as x:
            if len(ERRORS) < 200: ERRORS.append(f"{x.code} {url[:160]}")
            if x.code not in (429, 500, 502, 503, 504): return None
            time.sleep(int(x.headers.get("Retry-After") or 0) or 10 * (attempt + 1))
        except Exception as x:
            if len(ERRORS) < 200: ERRORS.append(f"{x.__class__.__name__} {x} {url[:160]}")
            time.sleep(5 * (attempt + 1))
    return None


def api(base_url, **p):
    p.update(format="json", formatversion="2")
    r = get(base_url + "?" + urllib.parse.urlencode(p)) or {}
    if "error" in r and len(ERRORS) < 200:
        ERRORS.append(f"api error {r['error'].get('code')}: {r['error'].get('info', '')[:120]} ({p.get('action')} {p.get('search') or p.get('titles') or ''})")
    return r


# ---------- deal context ----------
count, market = {}, {}
for d in deals:
    for side in re.split(r"\s+[×x]\s+", d.get("deal", "")):
        for nm in side.split(" / "):
            k = base(nm.strip()); count[k] = count.get(k, 0) + 1
            market.setdefault(k, set()).add(d.get("market"))
COUNTRY = {"ANZ": {"Q408", "Q664"}, "UK & Ireland": {"Q145", "Q27", "Q21", "Q22", "Q25", "Q26"}, "North America": {"Q30", "Q16"}}

BAD_P31 = {"Q5", "Q4167410", "Q101352", "Q202444", "Q12308941", "Q11879590", "Q515", "Q532", "Q486972", "Q3957", "Q1549591",
           "Q7366", "Q482994", "Q134556", "Q11424", "Q5398426", "Q21191270", "Q16521", "Q13442814", "Q4167836", "Q13406463",
           "Q11266439", "Q15632617", "Q95074", "Q7725634", "Q571", "Q47461344", "Q215380", "Q5741069", "Q6256", "Q3624078",
           "Q35657", "Q23442", "Q4022", "Q8502", "Q23397", "Q747074", "Q484170", "Q1093829", "Q7187", "Q8054", "Q11173",
           "Q7889", "Q105543609", "Q1002697", "Q15416", "Q17537576", "Q3863"}
ORG = re.compile(r"\b(compan(y|ies)|brand|club|team|league|association|federation|organi[sz]ation|manufacturer|maker|producer|bank|"
                 r"airlines?|carrier|retail(er)?|chain|brewery|brewer|winery|distiller(y)?|insurer|insurance|operator|corporation|"
                 r"business|enterprise|agency|authority|department|government|universit(y|ies)|college|school|institute|foundation|"
                 r"charity|council|union|society|committee|competition|championships?|tournament|cup|series|event|games|festival|"
                 r"marathon|race|tour|stadium|arena|venue|ground|circuit|services?|provider|platform|app|website|bookmaker|betting|"
                 r"wagering|casino|exchange|network|broadcaster|channel|station|television|radio|newspaper|magazine|publisher|media|"
                 r"studio|developer|software|technology|telecommunications|utility|energy|co-?operative|conglomerate|subsidiary|"
                 r"division|franchise|restaurant|fast food|beverage|drink|beer|lager|cider|wine|spirits?|whisk(e)?y|vodka|gin|rum|"
                 r"soft drink|automaker|automobile|vehicle|motorcycle|tyres?|tires?|apparel|clothing|sportswear|footwear|equipment|"
                 r"products?|airport|hospital|holding|firm|fund|trust|cryptocurrency|marketplace|supermarkets?|stores?|shop|hotels?|"
                 r"resort|cruise|lotter(y|ies)|governing body|national team|squad|academy|programme|program|initiative|campaign|"
                 r"confederation|olympic|paralympic|tourism|developer|builder|construction|mining|miner|logistics|freight|courier|"
                 r"pharmaceutical|healthcare|health|dealer|dealership|franchisor|gaming|esports|consultancy|consulting|law firm|"
                 r"accounting|real estate|property|financial|investment|payments?|fintech|lender|credit|superannuation|energy drink)\b", re.I)
NOT_ORG = re.compile(r"\b(human|footballer|cricketer|player|actor|actress|singer|rapper|politician|album|song|single by|film|novel|"
                     r"episode|given name|surname|family name|species|genus|village|town in|city in|suburb|river|mountain|lake|"
                     r"island|commune|municipality|district of|asteroid|painting|poem|video game by|television series|character)\b", re.I)


def host(url):
    h = urllib.parse.urlparse(url if "//" in url else "//" + url).netloc.lower().split(":")[0]
    return h[4:] if h.startswith("www.") else h


def same_site(a, b):
    a, b = host(a), host(b)
    return bool(a and b) and (a == b or a.endswith("." + b) or b.endswith("." + a))


def claim_values(c, prop):
    """Values of a claim, current ones first (preferred rank, no end date, latest start)."""
    out = []
    for s in c.get(prop, []):
        v = s.get("mainsnak", {}).get("datavalue", {}).get("value")
        if v is None or s.get("rank") == "deprecated": continue
        q = s.get("qualifiers", {})
        ended = "P582" in q
        start = ""
        for x in q.get("P580", []):
            start = (x.get("datavalue", {}).get("value", {}) or {}).get("time", "") or start
        out.append((s.get("rank") != "preferred", ended, start, v))
    out.sort(key=lambda t: t[2], reverse=True)          # latest start first...
    out.sort(key=lambda t: (t[0], t[1]))                # ...within preferred-and-current first (stable sort)
    return [t[3] for t in out]


def labels(e):
    names = [x.get("value") for x in (e.get("labels") or {}).values()]
    for al in (e.get("aliases") or {}).values():
        names += [x.get("value") for x in al]
    return [n for n in names if n]


def p31(e):
    return {v.get("id") for v in claim_values(e.get("claims", {}), "P31") if isinstance(v, dict)}


def candidates(names):
    ids = []
    for n in names[:3]:
        r = api(WD, action="wbsearchentities", search=n, language="en", uselang="en", type="item", limit="10")
        for x in r.get("search", []):
            if x["id"] not in ids: ids.append(x["id"])
    if not ids: return []
    r = api(WD, action="wbgetentities", ids="|".join(ids[:40]), props="labels|aliases|descriptions|claims|sitelinks",
            languages="en|mul", sitefilter="enwiki")
    return [r.get("entities", {}).get(i) for i in ids if r.get("entities", {}).get(i)]


def match(slug, v):
    names = [v["name"]] + v.get("aliases", [])
    want = {loose(n) for n in names} | {base(n) for n in names}
    dom = v.get("domain", "")
    keep, why = [], []
    for e in candidates(names):
        if not ({loose(x) for x in labels(e)} | {base(x) for x in labels(e)}) & want: continue
        if p31(e) & BAD_P31: continue
        desc = ((e.get("descriptions") or {}).get("en") or {}).get("value", "")
        sites = [s for s in claim_values(e.get("claims", {}), "P856") if isinstance(s, str)]
        if dom and sites:
            if any(same_site(s, dom) for s in sites):
                return e, "website matches " + dom, sites
            continue                      # an organisation with a different website is a different organisation
        if NOT_ORG.search(desc) or not ORG.search(desc):
            continue
        keep.append((e, sites))
    if len(keep) == 1:
        e, sites = keep[0]
        return e, ("name + description (no website to compare)" if dom else "name + description"), sites
    if len(keep) > 1:
        mk = set().union(*[market.get(base(n), set()) for n in names])
        want_c = set().union(*[COUNTRY.get(m, set()) for m in mk])
        local = [(e, s) for e, s in keep if {x.get("id") for x in claim_values(e["claims"], "P17") if isinstance(x, dict)} & want_c]
        if len(local) == 1:
            return local[0][0], "name + description, country tie-break", local[0][1]
        return None, "ambiguous: " + ", ".join(f'{e["id"]} ({((e.get("descriptions") or {}).get("en") or {}).get("value", "")})' for e, _ in keep[:4]), []
    return None, "no matching Wikidata item", []


def file_url(title, wiki):
    """A PNG rendering (for SVG) or the original raster, at most ~500px wide."""
    r = api(wiki, action="query", titles="File:" + title, prop="imageinfo", iiprop="url|mime|size", iiurlwidth="500")
    pages = r.get("query", {}).get("pages", [])
    if not pages or "imageinfo" not in pages[0]: return None, None
    ii = pages[0]["imageinfo"][0]
    if ii.get("mime") == "image/svg+xml" or (ii.get("width", 0) > 500 and ii.get("thumburl")):
        return ii.get("thumburl"), ii.get("descriptionurl")
    return ii.get("url"), ii.get("descriptionurl")


LOGOISH = re.compile(r"(logo|crest|badge|emblem|wordmark|insignia|shield|brand|icon|symbol)", re.I)


def logo_files(e):
    """(file title, wiki api, source) to try in order."""
    out = [(f, WD.replace("www.wikidata.org", "commons.wikimedia.org"), "Wikidata logo (P154)")
           for f in claim_values(e.get("claims", {}), "P154") if isinstance(f, str)]
    title = ((e.get("sitelinks") or {}).get("enwiki") or {}).get("title")
    if title:
        r = api(EN, action="query", titles=title, prop="pageimages", piprop="name", pilicense="any", redirects="1")
        pages = r.get("query", {}).get("pages", [])
        name = pages[0].get("pageimage") if pages else None
        if name and (LOGOISH.search(name) or name.lower().endswith(".svg")):
            out.append((name.replace("_", " "), EN, "Wikipedia lead image"))
    return out


def process(item):
    slug, v = item
    rec = {"name": v["name"], "kind": v.get("k"), "domain": v.get("domain", "")}
    try:
        e, why, sites = match(slug, v)
        rec["match"] = why
        if not e:
            rec["status"] = "no match"; return slug, rec
        rec["qid"] = e["id"]
        rec["label"] = ((e.get("labels") or {}).get("en") or (e.get("labels") or {}).get("mul") or {}).get("value", "")
        rec["desc"] = ((e.get("descriptions") or {}).get("en") or {}).get("value", "")
        if sites and not v.get("domain"):
            rec["domain_found"] = host(sites[0])
        for title, wiki, src in logo_files(e):
            url, page = file_url(title, wiki)
            if not url: continue
            data = get(url, binary=True)
            if not data: continue
            try:
                im, note = C.clean(C.load(data, url))
            except Exception as x:
                im, note = None, f"unreadable ({x.__class__.__name__})"
            if im is None:
                rec.setdefault("refused", []).append(f"{title}: {note}"); continue
            C.save(im, f"{OUT}/logos/{slug}.png")
            rec.update(status="found", file=title, source=src, page=page, clean=note, size=list(im.size))
            return slug, rec
        rec["status"] = "matched, no usable logo"
    except Exception as x:
        rec["status"] = f"error {x.__class__.__name__}: {x}"
    return slug, rec


def sheets(rep):
    found = [(s, r) for s, r in rep.items() if r.get("status") == "found"]
    found.sort(key=lambda x: x[0])
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    except Exception:
        font = ImageFont.load_default()
    COLS, ROWS, CW, CH = 6, 8, 230, 168
    for n in range(0, len(found), COLS * ROWS):
        page = found[n:n + COLS * ROWS]
        sheet = Image.new("RGB", (COLS * CW, ROWS * CH), "white")
        d = ImageDraw.Draw(sheet)
        for i, (slug, r) in enumerate(page):
            x, y = (i % COLS) * CW, (i // COLS) * CH
            for cx in range(x + 5, x + CW - 5, 10):           # checkerboard shows any leftover background
                for cy in range(y + 5, y + 115, 10):
                    if ((cx - x) // 10 + (cy - y) // 10) % 2: d.rectangle([cx, cy, cx + 9, cy + 9], fill="#e4e4e4")
            im = Image.open(f"{OUT}/logos/{slug}.png"); im.thumbnail((CW - 20, 100))
            sheet.paste(im, (x + (CW - im.width) // 2, y + 10 + (100 - im.height) // 2), im)
            d.rectangle([x, y, x + CW - 1, y + CH - 1], outline="#bbbbbb")
            d.text((x + 6, y + 118), f"{n + i + 1}. {r['name']}"[:36], fill="black", font=font)
            d.text((x + 6, y + 132), f"{r.get('qid')} {r.get('label', '')}"[:36], fill="#333", font=font)
            d.text((x + 6, y + 146), (r.get("desc") or "")[:36], fill="#777", font=font)
        sheet.save(f"{OUT}/sheets/{n // (COLS * ROWS) + 1:02d}.png", optimize=True)


def main():
    os.makedirs(f"{OUT}/logos", exist_ok=True); os.makedirs(f"{OUT}/sheets", exist_ok=True)
    args = sys.argv[1:]
    limit = int(args.pop(0)) if args and args[0].isdigit() else None
    if args:
        todo = [(s, ents[s]) for s in args if s in ents]
    else:
        todo = []
        for s, v in ents.items():
            if v.get("k") not in ("b", "p") or v.get("ptype") == "Athlete & talent": continue
            bf = set(v.get("bf") or [])
            if s in REPLACE or (not v.get("logo") and (not v.get("domain") or not bf & {"symbol", "logo"})):
                todo.append((s, v))
        todo.sort(key=lambda x: -max(count.get(base(n), 0) for n in [x[1]["name"]] + x[1].get("aliases", [])))
    if limit: todo = todo[:limit]
    print("to look up:", len(todo), flush=True)
    rep = {}
    with ThreadPoolExecutor(4) as ex:
        for i, (slug, rec) in enumerate(ex.map(process, todo), 1):
            rep[slug] = rec
            if i % 50 == 0 or rec.get("status") == "found":
                print(i, slug, rec.get("status"), rec.get("qid", ""), rec.get("source", ""), flush=True)
    json.dump(rep, open(f"{OUT}/report.json", "w"), indent=1, ensure_ascii=False)
    json.dump(ERRORS, open(f"{OUT}/errors.json", "w"), indent=1)
    sheets(rep)
    st = {}
    for r in rep.values(): st[r["status"]] = st.get(r["status"], 0) + 1
    print(json.dumps(st, indent=1))


if __name__ == "__main__":
    main()
