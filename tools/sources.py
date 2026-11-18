#!/usr/bin/env python3
"""Source registry: every URL domain in deals.json gets a source type, kept in data/sources.json.

    python3 tools/sources.py           # add any new domains (auto-classified), print the ones needing review
    python3 tools/sources.py --check   # exit 1 if any banned or unreviewed domain is in deals.json

Types (what confidence.py and validate.py read):
  official    the brand's or the rights holder's own site, newsroom, corporate, venue, foundation or parent company site
  league      a league, governing body or competition site hosting a club's or partner's page (nba.com, sporty.co.nz)
  wire        press release wire (the brand's or rights holder's own release)
  press       trade press and news outlets
  syndicated  stock tickers, aggregators and portals reposting a release or story (marketscreener, aol, yardbarker)
  blog        fan sites, blogs and anything unofficial
  social      social media (an official account counts as Tier 1, but the URL can't prove whose account it is)
  banned      never a source (Scout, paid sponsorship databases)
  unknown     added automatically, not reviewed yet: treated like press until someone sets a type

Auto-classification for new domains: banned list, then social, wire, press (tools/confidence.py PRESS), league,
then official when the domain matches a party's entity domain. Everything else lands as "unknown" with
"review": true. Set "type" by hand (and delete "review") to settle it. Hand-set types are never changed.
"""
import json, re, sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REG = ROOT / "data" / "sources.json"
CONFIRMING = {"official", "league", "wire"}
BANNED = ("scoutsponsor.com", "scout-sponsor.beehiiv.com")
SOCIAL = {"linkedin.com", "instagram.com", "facebook.com", "x.com", "twitter.com", "tiktok.com", "youtube.com", "threads.net"}
WIRES = {"prnewswire.com", "prnewswire.co.uk", "globenewswire.com", "businesswire.com", "newshub.medianet.com.au",
         "medianet.com.au", "newswire.ca", "einpresswire.com", "prweb.com", "prnasia.com", "g3newswire.com", "scoop.co.nz"}


def domain(url):
    return re.sub(r"^https?://(www\.)?", "", url or "").split("/")[0].lower()


def root(d):
    p = d.split(".")
    return ".".join(p[-3:]) if re.search(r"\.(com|co|org|net|gov|edu)\.(au|uk|nz)$", d) else ".".join(p[-2:])


def load():
    if REG.exists():
        return json.loads(REG.read_text(encoding="utf-8"))
    return {"_help": __doc__.strip().split("\n\n")[1], "domains": {}}


def lookup(reg, d):
    """Type for a domain: exact match first, then its root domain."""
    doms = reg["domains"]
    for k in (d, root(d)):
        if k in doms:
            return doms[k]["type"]
    return None


def auto(d, entdom):
    import confidence as C
    r = root(d)
    if any(b in d for b in BANNED):
        return "banned"
    if r in SOCIAL:
        return "social"
    if d in WIRES or r in WIRES:
        return "wire"
    if C.is_press(d):
        return "press"
    if r in entdom:
        return "official"
    return None


def main():
    sys.path.insert(0, str(ROOT / "tools"))
    reg = load()
    deals = json.loads((ROOT / "deals.json").read_text(encoding="utf-8"))["deals"]
    ents = json.loads((ROOT / "entities.json").read_text(encoding="utf-8"))["entities"]
    entdom = {root(v["domain"].lower().replace("www.", "")) for v in ents.values() if v.get("domain")}
    seen = Counter(domain(x["url"]) for x in deals if x.get("url"))
    added = 0
    for d in seen:
        if lookup(reg, d):
            continue
        t = auto(d, entdom)
        reg["domains"][d] = {"type": t or "unknown"} | ({} if t else {"review": True})
        added += 1
    reg["domains"] = dict(sorted(reg["domains"].items()))
    REG.parent.mkdir(exist_ok=True)
    REG.write_text(json.dumps(reg, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    review = sorted((seen[d], d) for d, v in reg["domains"].items() if v.get("review") and d in seen)
    banned = [d for d in seen if lookup(reg, d) == "banned"]
    print(f"{len(seen)} domains in use, {added} new, {len(review)} to review, {len(banned)} banned in use")
    print(Counter(lookup(reg, d) for d in seen))
    for n, d in reversed(review):
        print(f"  review: {d} ({n} rows)")
    for d in banned:
        print(f"  BANNED IN USE: {d}")
    if "--check" in sys.argv and (banned or review):
        sys.exit(1)


if __name__ == "__main__":
    main()
