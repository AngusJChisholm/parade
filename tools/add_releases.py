#!/usr/bin/env python3
"""Log partners from official club releases / brand announcements.
    python3 tools/add_releases.py batch.json            # dry run
    python3 tools/add_releases.py batch.json --write
batch.json: {"date":"2026-11-17","sport":"MLS","news":{club:url},"clubs":{club:[[brand, role, url, announced?]]},
             "region":"Global","market":"North America"}   # region/market optional, these are the defaults
news = the club newsroom URL, saved as the coverage row's partnersUrl. announced = YYYY-MM-DD of the original announcement
(never put it in "date").
role = short description, e.g. "front-of-kit partner (through 2030)". Type/ptier from role:
naming rights -> Naming rights; broadcast/radio/TV/media/streaming -> Media partner; jersey/kit/sleeve -> Jersey partner;
else Official partner. A year after "through"/"until" sets "ends". Existing brand rows for the club are refreshed, not duplicated.
Nothing is ended (releases can't prove a partner has gone). Run tools/enrich.py and tools/ptiers.py after.
"""
import json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from partner_check import norm  # same brand matching as the partners-page tool
R = Path(__file__).resolve().parent.parent; X = " × "
B = json.loads(Path(sys.argv[1]).read_text()); W = "--write" in sys.argv
D = json.loads((R/"deals.json").read_text()); E = json.loads((R/"entities.json").read_text()); C = json.loads((R/"coverage.json").read_text())
deals = D["deals"]; ents = E["entities"]; date = B["date"]
def kind(role):
    r = role.lower()
    if "naming" in r: return "Naming rights"
    if re.search(r"broadcast|radio|televis|\btv\b|media|stream", r): return "Media partner"
    if re.search(r"jersey|kit|sleeve|shirt", r) and "supplier" not in r: return "Jersey partner"
    return "Official partner"
alias = {}
for e in ents.values():
    for n in [e.get("name", "")] + e.get("aliases", []):
        if n: alias.setdefault(norm(n), set()).add(e.get("name"))
for club, rows in B["clubs"].items():
    pent = next((e for e in ents.values() if e.get("name") == club), None)
    if pent is None: print("!! no entity for", club); continue
    names = {club} | set(pent.get("aliases", []))
    mine = [d for d in deals if d["deal"].split(X, 1)[-1].strip() in names]
    sport = next((d["sport"] for d in mine if d.get("sport")), None) or B["sport"]
    by = {}
    for d in mine: by.setdefault(d["deal"].split(X, 1)[0].strip(), []).append(d)
    def find(b):
        c = {norm(b)} | {norm(x) for x in alias.get(norm(b), [])}
        return next((k for k in by if norm(k) in c), None)
    tiers = []; n_add = n_upd = 0
    print(f"== {club} ({len(rows)})")
    for r in rows:
        brand, role, url = r[:3]; ann = r[3] if len(r) > 3 else None
        t = kind(role); tiers.append(t)
        m = re.search(r"(?:through|until|to)\s+(?:the\s+)?(20\d\d)", role)
        ends = int(m.group(1)) + (1 if re.search(r"20\d\d[-/]\d\d", role[m.start():]) else 0) if m else None
        hit = find(brand)
        if hit:
            for d in by[hit]: d.pop("ended", None); d["ptier"] = t
            newest = max(by[hit], key=lambda d: d.get("date") or d.get("announced") or d.get("listed") or "")
            newest["checked"] = date
            if ann and not newest.get("announced") and not newest.get("date"): newest["announced"] = ann
            n_upd += 1; print(f"  = {brand} -> {hit} [{t}]")
            continue
        src = "an official " + club + " announcement" if any(h in url for h in [pent.get("domain", "~"), "mlssoccer.com", "mlb.com", "nhl.com", "nba.com", "nfl.com"]) else "an official announcement"
        row = {"listed": date, "deal": f"{brand}{X}{club}", "sport": sport, "type": t, "region": B.get("region", "Global"),
               "summary": f"Named {role} in {src}.", "url": url, "status": "Current partner", "market": B.get("market", "North America"),
               "tier": "Official partner"}
        if ann: row["announced"] = ann
        if ends: row["ends"] = ends
        row["ptier"] = t
        deals.insert(0, row); by[brand] = [row]; n_add += 1
        print(f"  + {brand} [{t}] {ann or ''} {('ends '+str(ends)) if ends else ''}")
    order = [t for t in ["Naming rights", "Jersey partner", "Official partner", "Media partner"] if t in tiers]
    pent["ptiers"] = order; pent["ptiersChecked"] = date
    cov = next((p for p in C["properties"] if p["name"] == club), None)
    if cov: cov.update(partnersUrl=B["news"].get(club, cov.get("partnersUrl", "")), lastChecked=date, onPage=len(rows))
    else: print("  ! not in coverage.json")
    print(f"  added {n_add}, refreshed {n_upd}")
if W:
    for p, o in (("deals.json", D), ("entities.json", E), ("coverage.json", C)):
        (R/p).write_text(json.dumps(o, ensure_ascii=False, indent=1))
    print("written")
