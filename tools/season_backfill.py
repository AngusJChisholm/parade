#!/usr/bin/env python3
"""Backfill a property's partners from archived (Wayback Machine) snapshots of its partners page, one per season.

    python3 tools/season_backfill.py seasons.json          # dry run
    python3 tools/season_backfill.py seasons.json --write  # writes deals.json

seasons.json:
  {"property": "AFL", "sport": "AFL", "region": "ANZ", "market": "Australia",
   "page": "https://www.afl.com.au/about-afl/partners/corporate",
   "seasons": {"2021": {"ts": "20210412155541", "page": "(optional, when the page moved)", "groups": [["Premier partner", ["Toyota"]], ["Official partner", ["AAMI", ...]]]},
               "2022": {...}},
   "same": {"McDonalds": "McDonald's"},    # optional: page name -> name used in deals.json
   "skip": ["City of Melbourne"],          # optional: councils, charities, the property's own sales team
   "live": {"date": "2026-11-20", "url": "https://...", "brands": [...]}}  # optional: names on the live page today

What it does
 - A brand seen in a snapshot that already has a deal with the property: its rows get "since" = the first
   season it was seen, when that's earlier than what's there (or nothing is there). Nothing else changes.
 - A brand seen in snapshots with no deal with the property: a former-partner row, since = first season seen,
   ended = last season seen, linked to the last snapshot it appears in. No "added", so it stays in the archive
   and never joins a day's edition.
 - "sinceBasis": "wayback" marks a since that is only the first season in the snapshots read: a brand seen in
   the earliest snapshot may go back further.
 - A brand still in the newest snapshot read but with no deal here is held back and listed, not ended: it is
   most likely a current partner the live check missed. With "live" given, such a brand that's on the live page
   gets a current "listed" row (with its since year), and one that isn't is ended at its last season seen. Set "lastIsFinal": true only when the newest snapshot
   is older than the live page check and the brand is confirmed gone.
 - Seasons a brand skipped in the middle are listed in the dry run (a gap usually means a page change, not a break).
Snapshots are read in Chrome (see partner_extract.md); this script only merges what was read.
"""
import json, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_profiles import norm, slugify, split, many

TODAY = datetime.date.today().isoformat()


def type_for(t):
    t = (t or "").lower()
    if "naming" in t: return "Naming rights"
    if "premier" in t or "principal" in t: return "Principal partner"
    if "major" in t: return "Major partner"
    if "supplier" in t or "supporter" in t: return "Official supplier"
    return "Official partner"


def main():
    cfg = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    write = "--write" in sys.argv
    E = json.loads((ROOT / "entities.json").read_text(encoding="utf-8"))["entities"]
    look = {}
    for slug, x in E.items():
        look[norm(x["name"])] = slug
        for a in x.get("aliases", []):
            look[norm(a)] = slug
    res = lambda n: look.get(norm(n)) or slugify(n)
    D = json.loads((ROOT / "deals.json").read_text(encoding="utf-8"))
    prop = cfg["property"]; P = res(prop)
    same, skip = cfg.get("same", {}), {norm(s) for s in cfg.get("skip", [])}

    rows = {}  # brand slug -> rows with this property
    for d in D["deals"]:
        b, p = split(d.get("deal"))
        if p and P in [res(x) for x in many(p)]:
            for x in many(b):
                rows.setdefault(res(x), []).append(d)

    seen, tier, name, snap = {}, {}, {}, {}
    years = sorted(cfg["seasons"])
    for y in years:
        s = cfg["seasons"][y]
        for t, names in s["groups"]:
            for n in names:
                n = same.get(n, n).strip()
                if not n or norm(n) in skip:
                    continue
                b = res(n)
                seen.setdefault(b, []).append(int(y)); tier.setdefault(b, t); name.setdefault(b, n)
                snap[b] = (y, s["ts"], s.get("page") or cfg["page"])
    first_ts = {y: cfg["seasons"][y]["ts"] for y in years}
    later = [int(y) for y in years] + ([int(cfg["live"]["date"][:4])] if cfg.get("live") else [])
    nxt = lambda y: next((z for z in later if z > y), y + 1)  # the next snapshot that no longer shows it

    since_set, new_rows, gaps, held = [], [], [], []
    live = None
    if cfg.get("live"):
        live = {res(same.get(n, n)) for n in cfg["live"]["brands"]}
    for b, ys in sorted(seen.items(), key=lambda x: (x[1][0], x[0])):
        y0, y1 = min(ys), max(ys)
        missing = [y for y in range(y0, y1 + 1) if str(y) in cfg["seasons"] and y not in ys]
        if missing:
            gaps.append(f"{name[b]}: not in {missing}")
        if b in rows:
            for d in rows[b]:
                cur = d.get("since")
                if not isinstance(cur, int) or y0 < cur:
                    since_set.append(f"{d['deal']}: since {cur} -> {y0}")
                    d["since"] = y0
                    d["sinceBasis"] = "wayback"  # first season seen in the snapshots read; may have started earlier
            continue
        if y1 == int(years[-1]) and not cfg.get("lastIsFinal"):
            if live is not None and b in live:  # still on the live page: a current partner the last check missed
                y0ts = first_ts[str(y0)]
                new_rows.append({
                    "deal": f"{name[b]} × {prop}", "sport": cfg["sport"], "type": type_for(tier[b]),
                    "region": cfg["region"], "market": cfg["market"],
                    "summary": f"Listed on the {prop} partners page, and on it in every season back to {y0} (archived snapshots).",
                    "url": cfg["live"]["url"], "tier": type_for(tier[b]), "ptier": tier[b], "status": "Current partner",
                    "conf": "Confirmed", "listed": cfg["live"]["date"], "since": y0, "sinceBasis": "wayback",
                    "verified": cfg["live"]["date"], "source": "wayback"})
                continue
            if live is None:
                held.append(f"{name[b]} (seen {y0}-{y1})")  # in the newest snapshot but not in our current rows: check the live page
                continue
        ly, lts, lpage = snap[b]
        y0ts = first_ts[str(y0)]
        span = f"{y0}" if y0 == y1 else f"{y0}-{y1}"
        new_rows.append({
            "deal": f"{name[b]} × {prop}", "sport": cfg["sport"], "type": type_for(tier[b]),
            "region": cfg["region"], "market": cfg["market"],
            "summary": (f"On the {prop} partners page in {span} (archived snapshots), gone by {nxt(y1)}." if not str(nxt(y1)).isdigit() or int(nxt(y1)) - y1 <= 1
                        else f"On the {prop} partners page in {span} (archived snapshots). No usable snapshot for {y1+1}-{int(nxt(y1))-1}; gone by {nxt(y1)}."),
            "url": f"https://web.archive.org/web/{lts}/{lpage}",
            "tier": type_for(tier[b]), "ptier": tier[b], "status": "Ended", "conf": "Confirmed",
            "month": f"{y0ts[:4]}-{y0ts[4:6]}", "since": y0, "sinceBasis": "wayback", "ended": y1, "ends": y1,
            "verified": TODAY, "source": "wayback"})

    print(f"{prop}: {len(seen)} brands across {len(years)} seasons")
    print(f"  since set on {len(since_set)} existing rows"); [print("   ", x) for x in since_set]
    print(f"  {len(new_rows)} new rows (former partners, plus current ones the last check missed)"); [print("   ", r["deal"], r["since"], "-", r.get("ended", "now")) for r in new_rows]
    if held:
        print(f"  {len(held)} held: in the newest snapshot, not in current rows (check the live page, add with partner_check):")
        [print("   ", h) for h in held]
    if gaps:
        print("  gaps (check):"); [print("   ", g) for g in gaps]
    if write:
        D["deals"].extend(new_rows)
        (ROOT / "deals.json").write_text(json.dumps(D, ensure_ascii=False, indent=1), encoding="utf-8")
        print("written")


if __name__ == "__main__":
    main()
