#!/usr/bin/env python3
"""Apply one official-partners-page check to deals.json, entities.json and coverage.json.

    python3 tools/partner_check.py check.json          # dry run: prints matches, adds and ends
    python3 tools/partner_check.py check.json --write  # writes the changes

check.json:
  {"property": "Sydney Sixers", "url": "https://...", "date": "2026-11-16",
   "groups": [["Principal partner", ["AAMI"]], ["Official partner", ["Summit Fleet", "Waterdrop"]]],
   "same": {"Summit": "Summit Fleet"},      # optional: page name -> name already in deals.json
   "keep": ["Lite n' Easy"]}                # optional: brands to leave live even though they're not on the page

What it does
 - A brand on the page that's already in the archive for this property: every one of its deals gets the page's
   grouping as "ptier", any "ended" flag is cleared, and its newest deal gets "checked": date.
 - A brand on the page that isn't in the archive: a new "listed" current-partner entry.
 - A live brand in the archive that's no longer on the page: every deal for it gets "ended": true.
 - The property's "ptiers" (page order) and "ptiersChecked" go in entities.json; coverage.json gets
   partnersUrl, lastChecked and onPage.
Run tools/enrich.py and tools/ptiers.py afterwards.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
X = " × "


def norm(s):
    s = s.lower().replace("&", "and")
    s = re.sub(r"\b(pty|ltd|limited|australia|aus|group|the|co|inc|nz|new zealand)\b", " ", s)
    return re.sub(r"[^a-z0-9]", "", s)


def load(p):
    return json.loads((ROOT / p).read_text())


def dump(p, data):
    (ROOT / p).write_text(json.dumps(data, ensure_ascii=False, indent=1))


def type_for(ptier):
    t = (ptier or "").lower()
    if "naming" in t:
        return "Naming rights"
    if "principal" in t or "founding" in t:
        return "Principal partner"
    if "major" in t:
        return "Major partner"
    if "media" in t or "broadcast" in t:
        return "Media partner"
    if "supplier" in t or "supporter" in t:
        return "Official supplier"
    return "Official partner"


def main():
    chk = json.loads(Path(sys.argv[1]).read_text())
    write = "--write" in sys.argv
    D = load("deals.json")
    deals = D["deals"]
    E = load("entities.json")
    C = load("coverage.json")
    prop, date, url = chk["property"], chk["date"], chk["url"]
    same = {norm(k): v for k, v in chk.get("same", {}).items()}
    keep = {norm(k) for k in chk.get("keep", [])}

    ents = E["entities"]
    pent = next((e for e in ents.values() if e.get("name") == prop), None)
    names = {prop} | set((pent or {}).get("aliases", []))
    mine = [d for d in deals if d["deal"].split(X, 1)[-1].strip() in names]
    sport = next((d["sport"] for d in mine if d.get("sport")), None)
    if not sport:
        sport = next((p["sport"] for p in C["properties"] if p["name"] == prop), "")
    region = next((d["region"] for d in mine if d.get("region")), "ANZ")
    market = next((d["market"] for d in mine if d.get("market")), region)

    # brand name variants already used for this property
    alias = {}
    for e in ents.values():
        for n in [e.get("name", "")] + e.get("aliases", []):
            if n:
                alias.setdefault(norm(n), set()).add(e.get("name"))
    by_brand = {}
    for d in mine:
        b = d["deal"].split(X, 1)[0].strip()
        by_brand.setdefault(b, []).append(d)

    def find(page_name):
        n = same.get(norm(page_name))
        if n:
            return n if n in by_brand else None
        cands = {norm(page_name)} | {norm(x) for x in alias.get(norm(page_name), [])}
        for b in by_brand:
            nb = norm(b)
            if nb in cands or any(nb in alias and c in {norm(x) for x in alias[nb]} for c in cands):
                return b
            for c in cands:
                if len(c) >= 4 and len(nb) >= 4 and (c.startswith(nb) or nb.startswith(c)):
                    return b
        return None

    seen, added, matched = set(), [], []
    on_page = 0
    for ptier, brands in chk["groups"]:
        for name in brands:
            on_page += 1
            b = find(name)
            if b:
                seen.add(b)
                matched.append(f"{name} -> {b} [{ptier}]")
                rows = by_brand[b]
                for d in rows:
                    if ptier:
                        d["ptier"] = ptier
                    d.pop("ended", None)
                newest = max(rows, key=lambda d: d.get("date") or d.get("month") or d.get("listed") or "")
                newest["checked"] = date
            else:
                added.append(f"{name} [{ptier}]")
                if ptier:
                    art = "an" if ptier[:1].lower() in "aeiou" else "a"
                    summ = f"Listed as {art} {ptier.lower()} on {prop}'s official partners page."
                else:
                    summ = f"Listed on {prop}'s official partners page."
                row = {"listed": date, "deal": f"{name}{X}{prop}", "sport": sport, "type": type_for(ptier),
                       "region": region, "summary": summ, "url": url, "status": "Current partner", "market": market}
                if ptier:
                    row["ptier"] = ptier
                deals.insert(0, row)
    ended = []
    for b, rows in by_brand.items():
        if b in seen or norm(b) in keep:
            continue
        if all(d.get("ended") for d in rows):
            continue
        ended.append(b)
        for d in rows:
            if not d.get("ended"):
                d["ended"] = True

    if pent is not None and all(g for g, _ in chk["groups"]):
        pent["ptiers"] = [g for g, _ in chk["groups"]]
        pent["ptiersChecked"] = date
    cov = next((p for p in C["properties"] if p["name"] == prop), None)
    if cov:
        cov.update(partnersUrl=url, lastChecked=date, onPage=on_page)

    print(f"== {prop}: {on_page} on page | matched {len(matched)} | added {len(added)} | ended {len(ended)}")
    for m in matched:
        print("  =", m)
    for a in added:
        print("  +", a)
    for e in ended:
        print("  -", e)
    if not cov:
        print("  ! not in coverage.json")
    if write:
        dump("deals.json", D)
        dump("entities.json", E)
        dump("coverage.json", C)
        print("  written")


if __name__ == "__main__":
    main()
