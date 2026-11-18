"""Track: gives every partnership in deals.json a Parade tier (T1-T4) and an expiry, each with its basis.

  ttier       T1  naming rights, principal partner, front of jersey
              T2  major / premier partner, sleeve, back of jersey, shorts, neckline, upper back
              T3  official partner with a named category ("official bank partner")
              T4  supplier, community partner, licensee
              Kit / Media  kit and apparel suppliers, broadcasters and media partners (held apart until signed off)
              Gov  governments, tourism bodies and councils (host or event funding, kept out of T1-T4 even
                   when they hold a jersey or naming asset)
              left out when nothing we hold says what the partner gets
  tbasis      sourced   rights confirmed in data/track_rights.json, with a source
              rights    the row's own wording names the asset ("back of jersey", "naming rights")
              role      the announcement or partners page names the role ("principal partner", "major partner")
              category  an official partner with a named category
  tends       end year (last season)
  tendsBasis  stated    a source states the end year
              term      signed year + stated term
              league    signed year + the league's median stated term (est.)

Club labels (Platinum, Gold, Premium, Corporate) never set a tier. Role labels from a partners page only count
when the group is small enough to be real top inventory: a page listing more than 6 "premier partners" is using
the word as a label, not a rights tier.

Read-only on fields set by hand (ends, endsLock, tierLock). Safe to run any number of times.
Run: python3 tools/track.py            write deals.json
     python3 tools/track.py --report   print coverage only, change nothing
"""
import json, re, statistics, sys, datetime
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_profiles import norm, slugify, split, many  # noqa: E402

YEAR = datetime.date.today().year
GROUP_CAP = 6          # more partners than this under one role label = a label, not a tier
MIN_TERMS = 10         # stated terms needed before a league average is used

ASSET_T1 = re.compile(r"naming rights|\bnaming partner|title (sponsor|partner|rights)|front[- ]of[- ](the )?(home |away |men's |women's |aflw |afl |playing )?(jersey|shirt|guernsey|jumper|kit|dress)|main shirt sponsor", re.I)
ASSET_T2 = re.compile(r"\bsleeve|back[- ]of[- ](the )?(home |away |playing )?(jersey|shirt|shorts|guernsey|jumper)|\b(top|upper|lower)[- ]back\b|front[- ]of[- ]shorts|\bshorts (partner|sponsor)|neckline|helmet|collar", re.I)
ROLE_T1 = re.compile(r"\b(co-)?principal (partner|sponsor)|\bnaming rights\b|\bfoundation partner\b", re.I)
ROLE_T2 = re.compile(r"\b(co-|joint )?major (partner|sponsor)\b|\bpremier partner\b", re.I)
SUPPLY = re.compile(r"\bsupplier\b|\bsupply partner|community partner|licens|\bsupporter\b|charity partner|preferred supplier", re.I)
NOT_CAT = r"club|corporate|major|premier|principal|proud|associate|business|team|global|founding|premium|platinum|gold|silver|bronze|elite|community|supply|media|commercial|key|national|international|official|regional|local|strategic|foundation"
GOV_NAME = re.compile(r"\bgovernment\b|\btourism\b|^destination |^visit |^tourism |\bcity of\b|\bcouncil\b|\bshire\b|\bcommission\b|\bdepartment of\b|^events (queensland|tasmania|nsw)|tourism and events|\bstate of\b|^dubai |^abu dhabi |^saudi tourism|^qatar tourism", re.I)
GOV_TYPE = re.compile(r"\b(government|host) partner\b", re.I)
CATEGORY = re.compile(r"\bofficial ((?!(?:" + NOT_CAT + r")\b)[a-z][a-z&'/ -]{2,35}?) (partner|sponsor)\b", re.I)


def is_current(d):
    if d.get("ended") or d.get("status") == "Ended":
        return False
    e = d.get("ends")
    return not (isinstance(e, int) and e < YEAR)


def signed_year(d):
    s = d.get("date") or d.get("month") or ""
    return int(s[:4]) if s[:4].isdigit() else None


def load():
    deals = json.loads((ROOT / "deals.json").read_text(encoding="utf-8"))
    ent = json.loads((ROOT / "entities.json").read_text(encoding="utf-8"))["entities"]
    leagues = json.loads((ROOT / "leagues.json").read_text(encoding="utf-8"))["leagues"]
    rights = json.loads((ROOT / "data" / "track_rights.json").read_text(encoding="utf-8"))["records"]
    return deals, ent, leagues, rights


def main(report=False):
    data, ent, leagues, research = load()
    deals = data["deals"]
    look = {}
    for slug, x in ent.items():
        look[norm(x["name"])] = slug
        for a in x.get("aliases", []):
            look[norm(a)] = slug
    resolve = lambda n: look.get(norm(n)) or slugify(n)
    league_of = {}
    for l in leagues:                      # first league listed wins (AFL before AFLW, NRL before NRLW)
        for m in l["members"] + l.get("self", []):
            league_of.setdefault(m if m in ent else resolve(m), l["name"])
    props = lambda d: [resolve(p) for p in many(split(d.get("deal"))[1])]
    R = {r["deal"]: r for r in research}

    # league median of stated terms
    terms = defaultdict(list)
    for d in deals:
        t = d.get("term")
        if isinstance(t, int) and 0 < t <= 20:
            for p in props(d):
                if p in league_of:
                    terms[league_of[p]].append(t)
    lg_term = {l: round(statistics.median(ts)) for l, ts in terms.items() if len(ts) >= MIN_TERMS}

    # size of each partners-page group at each property (current rows)
    group = Counter()
    for d in deals:
        if is_current(d) and d.get("ptier"):
            for p in props(d):
                group[(p, d["ptier"].lower())] += 1

    stats = Counter()
    for d in deals:
        for k in ("ttier", "tbasis", "tends", "tendsBasis"):
            d.pop(k, None)
        if not is_current(d):
            continue
        stats["current"] += 1
        r = R.get(d["deal"])
        text = " | ".join(x for x in [d.get("ptitle"), d.get("type"), d.get("summary")] if x)
        listed_only = not d.get("date") and not d.get("month")
        page_label = d.get("ptier") or ""
        small_group = all(group[(p, page_label.lower())] <= GROUP_CAP for p in props(d)) if page_label else True
        tier, basis = None, None
        brand = split(d.get("deal"))[0]
        bent = ent.get(resolve(brand), {}) if " / " not in brand else {}
        cat = bent.get("cat")
        is_gov = cat == "Tourism & government" or (cat in (None, "Other") and (GOV_NAME.search(brand) or GOV_TYPE.search(d.get("type") or "")))
        if r:
            tier, basis = r["tier"], "sourced"
            d["rights"] = r["rights"]
            d["rightsSrc"] = r.get("rightsSrc") or r["src"]
        elif is_gov:
            tier, basis = "Gov", "role"
        elif d.get("tier") == "Media & broadcast":
            tier, basis = "Media", "rights"
        elif d.get("tier") == "Kit & apparel":
            tier, basis = "Kit", "rights"
        elif d.get("tier") in ("Naming rights", "Title sponsor") or ASSET_T1.search(text):
            tier, basis = "T1", "rights"
        elif ASSET_T2.search(text) or d.get("tier") == "Shirt & kit placement":
            tier, basis = "T2", "rights"
        elif ROLE_T1.search(text) and (not listed_only or small_group):
            tier, basis = "T1", "role"
        elif ROLE_T2.search(text) and (not listed_only or small_group):
            tier, basis = "T2", "role"
        elif CATEGORY.search(d.get("ptitle") or "") or CATEGORY.search(d.get("summary") or "") or CATEGORY.search(d.get("type") or ""):
            tier, basis = "T3", "category"
        elif SUPPLY.search(text) or d.get("tier") == "Licensing & merchandise":
            tier, basis = "T4", "role"
        if tier:
            d["ttier"], d["tbasis"] = tier, basis
            stats[f"tier {tier}"] += 1
            stats[f"basis {basis}"] += 1
        else:
            stats["tier none"] += 1

        # expiry
        y = signed_year(d)
        if isinstance(d.get("ends"), int) and not d.get("endsEst"):
            d["tends"], d["tendsBasis"] = d["ends"], "stated"
        elif isinstance(d.get("ends"), int):
            d["tends"], d["tendsBasis"] = d["ends"], "term"
        elif r and r.get("ends"):
            d["tends"], d["tendsBasis"] = r["ends"], r.get("endsBasis", "stated")
            if not report:
                d["ends"], d["endsLock"], d["endsSrc"] = r["ends"], True, r["src"]
        elif y:
            ls = [league_of[p] for p in props(d) if p in league_of and league_of[p] in lg_term]
            if ls:
                e = y + lg_term[ls[0]]
                if e >= YEAR:
                    d["tends"], d["tendsBasis"] = e, "league"
        stats[f"ends {d.get('tendsBasis', 'none')}"] += 1

    if not report:
        p = ROOT / "deals.json"
        p.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return stats, lg_term


if __name__ == "__main__":
    s, lt = main(report="--report" in sys.argv)
    n = s["current"]
    print(f"current partnerships: {n}")
    for k in sorted(s):
        if k != "current":
            print(f"  {k:<18} {s[k]:>6}  {100 * s[k] / n:5.1f}%")
    print("league median terms used:", lt)
