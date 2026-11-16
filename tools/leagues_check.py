#!/usr/bin/env python3
"""Checks leagues.json (the league filter on the Properties page) against deals.json.

  python3 tools/leagues_check.py      -> clubs and teams with partnerships that sit in no league,
                                         and how many properties each league picks up
Names resolve the same way the site does (entities.json name/aliases, else the slugified name).
"""
import json, re, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
E = json.loads((ROOT / "entities.json").read_text())["entities"]
LG = json.loads((ROOT / "leagues.json").read_text())["leagues"]
deals = json.loads((ROOT / "deals.json").read_text())["deals"]


def _strip(x):
    x = unicodedata.normalize("NFKD", str(x or ""))
    return "".join(c for c in x if not unicodedata.combining(c))


def norm(x):
    return re.sub(r"[^a-z0-9()]+", " ", _strip(x).lower().replace("&", " and ")).strip()


def slugify(x):
    x = re.sub(r"\(.*?\)", " ", _strip(x)).lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", x).strip("-")


LOOK = {}
for s, e in E.items():
    LOOK[norm(e["name"])] = s
    for a in e.get("aliases", []):
        LOOK[norm(a)] = s


def resolve(n):
    return n if n in E else LOOK.get(norm(n)) or slugify(n)


P, B, NAME = Counter(), Counter(), {}
for d in deals:
    parts = re.split(r"\s+[×x]\s+", d["deal"])
    if len(parts) < 2:
        continue
    for n in re.split(r"\s+/\s+", parts[0]):
        B[resolve(n.strip())] += 1
    for n in re.split(r"\s+/\s+", " × ".join(parts[1:])):
        s = resolve(n.strip())
        P[s] += 1
        NAME[s] = E.get(s, {}).get("name", n.strip())
props = {s for s in P if P[s] >= B[s]}

inlg = defaultdict(list)
for l in LG:
    for n in l["members"] + l["self"]:
        inlg[resolve(n)].append(l["name"])
print("Properties picked up per league:")
for l in LG:
    got = {resolve(n) for n in l["members"] + l["self"]} & props
    print(f'  {l["name"]:<32} {len(got)}')
miss = sorted((s for s in props if E.get(s, {}).get("ptype", "Other") in ("Club & team", "Other", "") and s not in inlg),
              key=lambda s: -P[s])
print(f"\nClubs and teams in no league ({len(miss)}):")
for s in miss:
    print(f"  {NAME[s]}  [{s}]  {P[s]} partnerships")
