"""Partnership Pro: Category availability. Which ANZ properties have a category open, by state.

Reads deals.json, entities.json and leagues.json and writes pro/availability.json (read by the Availability tab
in pro.html). The page picks a category (and a sub-category inside it) plus a state, and every property comes
back as one of:

  Open       no partner in that category at all
  Adjacent   a live partner in the same category but a different sub-category (a solar partner when you're
             selling energy retail): the slot you want may be free, check the exclusivity wording
  Taken      a live partner in that exact slot
  Ending     the partner in that slot has a stated end year this year or next
  Opening    the partner in that slot ended in the last 18 months and nobody has replaced them

The status is worked out in the page from the partner list written here, so any category works without a rebuild.

    python3 tools/availability.py

Liveness uses the same rule as Match Score (tools/match.py Model): not ended, and either an end year that hasn't
passed, or (with no end year) announced or last checked in the last 36 months, or listed on the official partners
page. State comes from tools/locations.py (states_of). National bodies and leagues have no state: the page shows
them under "National" and, for a club, flags when its league or governing body holds the slot.
A property with "inactive" set in entities.json (an event not on next season's calendar) is left out.
"""
import json, sys, datetime, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from match import load, Model, ym, verified_dates
from build_profiles import norm, slugify
from locations import states_of

# Club -> league and governing-body properties whose category deals cover the club's competition. A league's own
# partners (an Origin x Cricket Australia deal that names the BBL) can block or complicate a club deal.
PARENT_BODIES = {
    "Big Bash League": ["big-bash-league", "cricket-australia"],
    "WBBL": ["big-bash-league", "cricket-australia"],
    "Suncorp Super Netball": ["netball-australia"],
    "Super Rugby Pacific": ["rugby-australia"],
    "A-Leagues": ["a-leagues", "football-australia"],
    "A-League Women": ["a-leagues", "football-australia"],
}

# When each competition plays (for the summer filter). Summer = any part of December to February.
SEASON = {
    "AFL": ("Mar-Sep", False), "AFLW": ("Aug-Nov", False), "NRL": ("Mar-Oct", False), "NRLW": ("Jul-Oct", False),
    "A-Leagues": ("Oct-May", True), "A-League Women": ("Nov-May", True), "NBL": ("Sep-Mar", True),
    "WNBL": ("Oct-Mar", True), "Big Bash League": ("Dec-Jan", True), "WBBL": ("Oct-Nov", False),
    "Suncorp Super Netball": ("Mar-Aug", False), "Super Rugby Pacific": ("Feb-Jun", True),
    "Super Rugby Aupiki": ("Mar-Apr", False), "Supercars": ("Feb-Dec", True), "Super Smash": ("Dec-Feb", True),
    "ANZ Premiership": ("Apr-Jul", False), "Bunnings NPC": ("Aug-Oct", False), "Hockey One": ("Sep-Nov", False),
    "WAFL": ("Apr-Sep", False), "VAFA": ("Apr-Sep", False),
}
SEASON_SLUG = {
    "united-cup": ("Jan", True), "australian-open": ("Jan", True), "brisbane-international": ("Jan", True),
    "adelaide-international": ("Jan", True), "hobart-international": ("Jan", True), "tour-down-under": ("Jan", True),
    "cruising-yacht-club-of-australia": ("Dec", True), "sydney-hobart-yacht-race": ("Dec", True),
    "bathurst-12-hour": ("Feb", True), "city2surf": ("Aug", False), "sydney-marathon": ("Aug", False),
    "state-of-origin": ("May-Jul", False), "cricket-australia": ("Oct-Mar", True), "big-bash-league": ("Dec-Jan", True),
}
SUMMER_SPORTS = {"Cricket", "Tennis", "Sailing", "Surfing", "Surf lifesaving", "Cycling", "Triathlon"}


def main():
    ent, deals, league_of = load()
    today = datetime.date.today()
    now = ym(today.isoformat())
    yr = today.year
    M = Model(ent, deals, league_of, now)
    ver = verified_dates(ent)

    # league membership from leagues.json (fuller than entities.json's club strips)
    look = {}
    for slug, x in ent.items():
        look[norm(x["name"])] = slug
        for a in x.get("aliases", []):
            look[norm(a)] = slug
    res = lambda n: n if n in ent else (look.get(norm(n)) or slugify(n))
    lg_of = collections.defaultdict(list)
    lg_self = {}
    for lg in json.loads((ROOT / "leagues.json").read_text(encoding="utf-8")).get("leagues", []):
        if lg.get("market") != "ANZ":
            continue
        lg_self[lg["name"]] = [res(n) for n in lg.get("self", [])]
        for m in lg.get("members", []):
            lg_of[res(m)].append(lg["name"])

    nm = lambda x: (ent.get(x) or {}).get("name") or M.name.get(x, x)
    props, keep = [], set()
    for p in M.P:
        if M.region[p] != "ANZ":
            continue
        e = ent.get(p) or {}
        if e.get("inactive"):
            continue
        rows = []
        seen = {}
        for r in M.P[p]:
            d, b = r["d"], r["b"]
            ended = d.get("ended")
            ended_yr = ended if isinstance(ended, int) and not isinstance(ended, bool) else None  # True = year unknown
            if r["live"]:
                st = "E" if (d.get("ends") and d["ends"] <= yr + 1 and not d.get("endsEst")) else "L"
            else:
                # ended recently: stated end year last year or this year, or (no year) signed in the last 4 years
                ey = ended_yr or d.get("ends")
                recent = (ey and ey >= yr - 1) or (not ey and r["dated"] and r["age"] <= 48)
                if not recent:
                    continue
                st = "X"
            k = b
            rank = {"L": 3, "E": 2, "X": 1}
            if k in seen and rank[seen[k][4]] >= rank[st]:
                continue
            seen[k] = [b, nm(b), M.cat.get(b) or "Other", M.sub.get(b) or "", st,
                       d.get("ends") or ended_yr,
                       d.get("ptitle") or d.get("ptier") or d.get("tier") or "",
                       d.get("url") or "", d.get("date") or d.get("month") or d.get("listed") or ""]
        rows = list(seen.values())
        lgs = sorted(set(lg_of.get(p, [])))
        season = SEASON_SLUG.get(p) or next((SEASON[l] for l in lgs if l in SEASON), None)
        if not season and M.sport.get(p) in SUMMER_SPORTS:
            season = ("Summer", True)
        parents = []
        for l in lgs:
            parents += lg_self.get(l, []) + PARENT_BODIES.get(l, [])
        parents = [x for x in dict.fromkeys(parents) if x != p]
        sts = states_of(p, nm(p), e.get("domain", ""), M.city.get(p))
        props.append({
            "s": p, "n": nm(p), "st": sts, "c": M.city.get(p) or "", "t": e.get("ptype") or "Other",
            "sp": M.sport.get(p) or "", "lg": lgs, "ssn": season[0] if season else "", "sum": bool(season and season[1]),
            "up": parents, "v": ver.get(p, ""), "p": rows,
        })
        keep.update(parents)
    # parents (league / governing body) need their partner lists even if they're not ANZ-tagged
    have = {x["s"] for x in props}
    for p in keep - have:
        if p not in M.P:
            continue
        rows = [[r["b"], nm(r["b"]), M.cat.get(r["b"]) or "Other", M.sub.get(r["b"]) or "", "L", r["d"].get("ends"),
                 r["d"].get("ptitle") or r["d"].get("tier") or "", r["d"].get("url") or "", r["d"].get("date") or r["d"].get("month") or ""]
                for r in M.P[p] if r["live"]]
        props.append({"s": p, "n": nm(p), "st": [], "c": "", "t": (ent.get(p) or {}).get("ptype") or "Other",
                      "sp": M.sport.get(p) or "", "lg": [], "ssn": "", "sum": False, "up": [], "v": ver.get(p, ""),
                      "p": rows, "parentOnly": True})

    subs = collections.defaultdict(collections.Counter)
    for x in props:
        for r in x["p"]:
            subs[r[2]][r[3] or ""] += 1
    out = {
        "generated": today.isoformat(),
        "cats": {c: [s for s, _ in v.most_common() if s] for c, v in sorted(subs.items())},
        "props": sorted(props, key=lambda x: x["n"].lower()),
    }
    (ROOT / "pro" / "availability.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_state = sum(1 for x in props if x["st"])
    print(f"availability.json: {len(props)} properties ({n_state} placed in a state), {sum(len(x['p']) for x in props)} partner rows")


if __name__ == "__main__":
    main()
