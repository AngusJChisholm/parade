"""Give every partnership in deals.json a confidence level and a last-verified date.

  conf      Confirmed   source is the club, league, event, venue or brand itself (partners page, newsroom,
                        or its own release via a wire service): data/sources.json type official, league or wire
            Reported    trade press, news, syndicated reposts, blogs, social posts, or a domain not reviewed yet
            Unverified  no source on file yet (needsSource), or a banned source (Scout)
  The source type comes from the registry in data/sources.json (tools/sources.py). A domain missing from it
  counts as Reported until it is reviewed, never as official.
  verified  the most recent date anyone saw this partnership confirmed: the partners-page check
            ("checked", or the property's lastChecked in coverage.json for current partners), the date it was
            listed or added, or its announcement date

A hand-set "confLock": true keeps a conf someone set by hand. Safe to run any number of times.
Run: python3 tools/confidence.py   (also run by .github/workflows/profiles.yml)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Trade press, news outlets and aggregators. Anything not listed here with a URL is treated as an official source.
PRESS = {
    "sportsmintmedia.com", "ministryofsport.com", "bandt.com.au", "sportcal.com", "sportspro.com", "sportspromedia.com",
    "mi-3.com.au", "insideworldfootball.com", "sportskhabri.com", "ausleisure.com.au", "sponsorshipnews.com.au",
    "uksponsorship.co.uk", "mediaweek.com.au", "finance.yahoo.com", "thestadiumbusiness.com", "adnews.com.au",
    "sportforbusiness.com", "advanced-television.com", "cyclingnews.com", "jayski.com", "espn.com", "espn.com.au",
    "procyclinguk.com", "protothema.gr", "mumbrella.com.au", "sportbusiness.com", "theage.com.au", "smh.com.au",
    "afr.com", "theaustralian.com.au", "news.com.au", "foxsports.com.au", "reuters.com", "bloomberg.com",
    "frontofficesports.com", "sportico.com", "nytimes.com", "theathletic.com", "bbc.com", "bbc.co.uk",
    "skysports.com", "insidersport.com", "campaignbrief.com", "marketingmag.com.au", "sportsbusinessjournal.com",
    "sportsbusinessdaily.com", "forbes.com", "cnbc.com", "theguardian.com", "abc.net.au", "stuff.co.nz",
    "nzherald.co.nz", "rnz.co.nz", "sportsmint.com", "blackbookmotorsport.com", "sportsproonline.com",
    "insidethegames.biz", "marketing-interactive.com", "beforeyoubet.com.au", "johnwallstreet.com",
}
NEWSWIRE_OFFICIAL = {"prnewswire.com", "globenewswire.com", "businesswire.com", "newshub.medianet.com.au",
                     "newswire.ca", "einpresswire.com"}


def domain(url):
    return re.sub(r"^https?://(www\.)?", "", url or "").split("/")[0].lower()


def is_press(dom):
    return any(dom == p or dom.endswith("." + p) for p in PRESS)


def main():
    p = ROOT / "deals.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    cov = json.loads((ROOT / "coverage.json").read_text(encoding="utf-8")).get("properties", [])
    checked_by_prop = {c["name"]: c.get("lastChecked") for c in cov if c.get("name") and c.get("lastChecked")}

    import sources as S
    reg = S.load()
    before = json.dumps(data, ensure_ascii=False)
    counts = {"Confirmed": 0, "Reported": 0, "Unverified": 0}
    for d in data["deals"]:
        url = d.get("url")
        if not d.get("confLock"):
            if not url or d.get("needsSource"):
                conf = "Unverified"
            else:
                t = S.lookup(reg, domain(url))
                conf = "Confirmed" if t in S.CONFIRMING else "Unverified" if t == "banned" else "Reported"
            d["conf"] = conf
        counts[d.get("conf", "Unverified")] = counts.get(d.get("conf", "Unverified"), 0) + 1

        dates = [d.get("checked"), d.get("listed"), d.get("added"), d.get("date"), d.get("announced")]
        if d.get("status") == "Current partner":
            prop = (d.get("deal") or "").split(" × ")[-1].strip()
            dates.append(checked_by_prop.get(prop))
        dates = [x for x in dates if isinstance(x, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", x)]
        if dates:
            d["verified"] = max(dates)
        else:
            d.pop("verified", None)

    after = json.dumps(data, ensure_ascii=False)
    if after != before:
        p.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("Confidence:", ", ".join(f"{k} {v:,}" for k, v in counts.items()),
          f"| with a verified date: {sum(1 for d in data['deals'] if d.get('verified')):,} of {len(data['deals']):,}")


if __name__ == "__main__":
    main()
