#!/usr/bin/env python3
"""Add a league's clubs to entities.json and coverage.json before checking their partners.

    python3 tools/add_league.py clubs.json            # dry run
    python3 tools/add_league.py clubs.json --write

clubs.json: {"sport":"MLS","clubs":[[name, domain, country, state, [aliases]], ...]}
A club already in entities.json (by name or alias) is kept and only gets missing fields and aliases; new clubs get
ptype "Club & team", k "p", bf ["icon","logo"]. Coverage rows are added with tier 5. Nothing is overwritten.
"""
import json, re, sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent
spec = json.loads(Path(sys.argv[1]).read_text()); W = "--write" in sys.argv
E = json.loads((R/"entities.json").read_text()); C = json.loads((R/"coverage.json").read_text())
ents = E["entities"]
names = {}
for k, v in ents.items():
    for n in [v.get("name")] + v.get("aliases", []):
        if n: names[n] = k
covn = {p["name"] for p in C["properties"]}
def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
for row in spec["clubs"]:
    name, dom, country, state = row[:4]; al = row[4] if len(row) > 4 else []
    k = names.get(name) or next((names[a] for a in al if a in names), None)
    if k:
        e = ents[k]
        if e.get("name") != name and name not in e.get("aliases", []):
            print("  ! entity", k, "is named", e.get("name"), "- using that"); name = e["name"]
        e.setdefault("domain", dom); e.setdefault("ptype", "Club & team"); e.setdefault("k", "p"); e.setdefault("bf", ["icon", "logo"])
        for a in al:
            if a != e["name"] and a not in e.setdefault("aliases", []): e["aliases"].append(a)
        if "aliases" in e and not e["aliases"]: e.pop("aliases")
        print("  = entity", k)
    else:
        k = slug(name)
        while k in ents: k += "-club"
        e = {"name": name, "domain": dom, "ptype": "Club & team", "k": "p", "bf": ["icon", "logo"]}
        if al: e["aliases"] = al
        ents[k] = e; print("  + entity", k)
    if name not in covn:
        C["properties"].append({"name": name, "sport": spec["sport"], "country": country, "state": state, "tier": 5}); covn.add(name)
        print("  + coverage", name)
if W:
    E["entities"] = dict(sorted(ents.items()))
    (R/"entities.json").write_text(json.dumps(E, ensure_ascii=False, indent=1))
    (R/"coverage.json").write_text(json.dumps(C, ensure_ascii=False, indent=1))
    print("written")
