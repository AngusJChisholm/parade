#!/usr/bin/env python3
"""Data health score for the Parade database: one number out of 100, six weighted areas.

    python3 tools/health.py          # print the score, append it to pro/health.json (private, uploaded with Pro files)

Each metric scores 0 at its floor and 100 at its target in a straight line; an area is the average of its metrics;
the score is the weighted average of the areas. Accuracy comes from the sample checks in pro/samples.json
(rows re-checked against their sources). Until a sample exists, the score is shown on the other five areas and
marked partial. Targets and weights are set in the Parade data audit plan.
"""
import datetime, json, re, sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sources as S

WEIGHTS = {"Accuracy": 30, "Completeness": 20, "Consistency": 15, "Freshness": 15, "Sources": 10, "Logos": 10}
KEY_MARKETS = {"ANZ", "UK & Ireland", "North America"}
MAJOR = {"Naming rights", "Principal & major", "Title sponsor", "Kit & apparel", "Media & broadcast"}


def lin(v, floor, target):
    if v is None:
        return None
    if floor == target:
        return 100.0
    return max(0.0, min(100.0, 100 * (v - floor) / (target - floor)))


def pct(a, b):
    return round(100 * a / b, 1) if b else None


def load(p, default=None):
    f = ROOT / p
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else default


def main():
    today = datetime.date.today()
    deals = load("deals.json")["deals"]
    ents = load("entities.json")["entities"]
    cov = load("coverage.json")["properties"]
    leagues = load("leagues.json")["leagues"]
    L = load("data/lists.json")
    reg = S.load()
    audit = load("pro/audit.json", {}) or {}
    samples = load("pro/samples.json", {"rows": []}) or {"rows": []}

    name2slug = {}
    for s, v in ents.items():
        for n in [v["name"]] + v.get("aliases", []):
            name2slug[n.lower()] = s
    age = lambda s: (today - datetime.date.fromisoformat(s)).days if isinstance(s, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", s) else None
    covslug = {name2slug.get(c["name"].lower(), c["name"].lower()): c for c in cov}
    live = [d for d in deals if not d.get("ended")]
    dated = [d for d in deals if d.get("date")]
    M = defaultdict(dict)  # area -> metric -> (value, floor, target)

    # Accuracy: rolling 4-week sample
    recent = [r for r in samples.get("rows", []) if (age(r.get("checked")) or 999) <= 28]
    if recent:
        M["Accuracy"]["Critical fields pass %"] = (pct(sum(1 for r in recent if r.get("critical") == "pass"), len(recent)), 85, 99)
        M["Accuracy"]["Secondary fields pass %"] = (pct(sum(1 for r in recent if r.get("secondary") == "pass"), len(recent)), 70, 95)

    # Completeness
    clubs = [name2slug.get(m.lower(), m) for lg in leagues if lg.get("market") in KEY_MARKETS for m in lg["members"]]
    clubs = list(dict.fromkeys(clubs))
    M["Completeness"]["Key-market clubs checked %"] = (pct(sum(1 for c in clubs if covslug.get(c, {}).get("lastChecked")), len(clubs)), 50, 95)
    newd = [d for d in dated if d.get("status") == "New"]
    M["Completeness"]["New partnerships with term or stated end %"] = (pct(sum(1 for d in newd if d.get("term") or (d.get("ends") and not d.get("endsEst"))), len(newd)), 0, 60)
    bcount = Counter(name2slug.get(d["deal"].split(" × ")[0].lower()) for d in deals)
    multi = [s for s, n in bcount.items() if s and n >= 2 and ents.get(s, {}).get("k") == "b"]
    M["Completeness"]["Brands (2+ partnerships) with category %"] = (pct(sum(1 for s in multi if ents[s].get("cat")), len(multi)), 30, 95)
    queue = [d for d in live if d.get("listed") and d.get("tier") in MAJOR and d.get("market") in KEY_MARKETS]
    M["Completeness"]["Major partner-page rows with announcement date %"] = (pct(sum(1 for d in queue if d.get("announced")), len(queue)), 0, 80)

    # Consistency
    on = lambda d: d.get("sport") in L["sports"] and d.get("market") in L["markets"] and d.get("type") not in L["typesStatusWords"]
    M["Consistency"]["Rows on controlled lists %"] = (pct(sum(1 for d in deals if on(d)), len(deals)), 60, 100)
    pair = Counter((d["deal"].lower(), d.get("date") or d.get("listed")) for d in deals)
    dups = len(audit.get("dup_entities", [])) + sum(1 for v in pair.values() if v > 1)
    M["Consistency"]["Open duplicates"] = (dups, 100, 0)

    # Freshness
    t12 = [c for c in cov if c.get("tier") in (1, 2) and c.get("partnersUrl")]
    M["Freshness"]["Tier 1-2 properties checked in 30 days %"] = (pct(sum(1 for c in t12 if (age(c.get("lastChecked")) or 999) <= 30), len(t12)), 50, 100)
    withurl = [c for c in cov if c.get("partnersUrl")]
    M["Freshness"]["All properties checked in 90 days %"] = (pct(sum(1 for c in withurl if (age(c.get("lastChecked")) or 999) <= 90), len(withurl)), 50, 100)
    M["Freshness"]["Live rows with a past end year"] = (sum(1 for d in live if isinstance(d.get("ends"), int) and d["ends"] < today.year), 100, 0)

    # Sources
    typed = [S.lookup(reg, S.domain(d["url"])) for d in deals if d.get("url")]
    M["Sources"]["Rows on a reviewed source domain %"] = (pct(sum(1 for t in typed if t not in (None, "unknown")), len(typed)), 80, 100)
    M["Sources"]["Announced partnerships on an official source %"] = (pct(sum(1 for d in dated if d.get("conf") == "Confirmed"), len(dated)), 20, 70)

    # Logos
    bw = [(s, n) for s, n in bcount.items() if s and ents.get(s, {}).get("k") == "b"]
    M["Logos"]["Brand logo coverage (by partnerships) %"] = (pct(sum(n for s, n in bw if ents[s].get("logo") or ents[s].get("domain")), sum(n for s, n in bw)), 20, 80)
    try:
        from PIL import Image
        files = list((ROOT / "assets" / "logos").glob("*.png"))
        ok = 0
        for f in files:
            im = Image.open(f).convert("RGBA")
            w, h = im.size
            corners = [im.getpixel(xy)[3] for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
            ok += im.getchannel("A").getextrema()[0] < 255 and min(corners) <= 200 and max(w, h) >= 128
        M["Logos"]["Local logo files clean %"] = (pct(ok, len(files)), 90, 100)
    except ImportError:
        pass

    areas = {}
    for a, ms in M.items():
        sc = [lin(v, f, t) for v, f, t in ms.values() if v is not None]
        areas[a] = round(sum(sc) / len(sc), 1) if sc else None
    have = {a: s for a, s in areas.items() if s is not None}
    wsum = sum(WEIGHTS[a] for a in have)
    score = round(sum(WEIGHTS[a] * s for a, s in have.items()) / wsum, 1) if wsum else None
    entry = {"date": today.isoformat(), "score": score, "partial": "Accuracy" not in have, "areas": areas,
             "metrics": {a: {k: v[0] for k, v in ms.items()} for a, ms in M.items()}}

    out = load("pro/health.json", {"_help": __doc__.strip().split("\n\n")[1], "history": []})
    out["history"] = [h for h in out["history"] if h["date"] != entry["date"]] + [entry]
    out["latest"] = entry
    (ROOT / "pro").mkdir(exist_ok=True)
    (ROOT / "pro" / "health.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    prev = out["history"][-2]["score"] if len(out["history"]) > 1 else None
    print(f"Data health: {score}/100{' (partial: no accuracy sample yet)' if entry['partial'] else ''}"
          + (f", {score - prev:+.1f} on last run" if prev is not None and score is not None else ""))
    for a in WEIGHTS:
        if a in M:
            print(f"  {a} {areas[a]}  " + " | ".join(f"{k} {v[0]}" for k, v in M[a].items()))
        else:
            print(f"  {a}: not measured yet")


if __name__ == "__main__":
    main()
