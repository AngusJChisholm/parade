"""Work queue for the daily Track dates task: which current partnerships to research next.

Priority, highest first:
  1. accuracy fixes   rows with an end year in the past that aren't marked ended
  2. ANZ T1 / T2      no signed date
  3. Global T1 / T2   no signed date (UK, North America, Europe, then the rest)
  4. ANZ everything else with no signed date
  5. everything else with no signed date
Within a group: properties on the coverage check list first, then by property name.
Skips any row with "datesTried" in the last 90 days (searched, nothing official found).

Run: python3 tools/track_queue.py [N]        prints the next N (default 100) as JSON lines
     python3 tools/track_queue.py --stats    queue sizes only
"""
import datetime, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from track import is_current  # noqa: E402

TODAY = datetime.date.today()
MARKET_ORDER = {"ANZ": 0, "UK & Ireland": 1, "North America": 2, "Europe": 3, "Global": 4}


def recently_tried(d):
    t = d.get("datesTried")
    try:
        return t and (TODAY - datetime.date.fromisoformat(t)).days < 90
    except ValueError:
        return False


def group(d):
    if not d.get("ended") and isinstance(d.get("ends"), int) and d["ends"] < TODAY.year:
        return None if recently_tried(d) else 1
    if not is_current(d) or d.get("date") or d.get("month") or recently_tried(d):
        return None
    top = d.get("ttier") in ("T1", "T2")
    anz = d.get("market") == "ANZ"
    if top and anz:
        return 2
    if top:
        return 3
    return 4 if anz else 5


def main():
    deals = json.loads((ROOT / "deals.json").read_text(encoding="utf-8"))["deals"]
    cov = {c["name"] for c in json.loads((ROOT / "coverage.json").read_text(encoding="utf-8"))["properties"]}
    q = []
    for i, d in enumerate(deals):
        g = group(d)
        if g is None:
            continue
        prop = d["deal"].split(" × ")[-1]
        q.append((g, MARKET_ORDER.get(d.get("market"), 9), prop not in cov, prop, i, d))
    q.sort(key=lambda t: t[:4])
    if "--stats" in sys.argv:
        from collections import Counter
        c = Counter(t[0] for t in q)
        names = {1: "past end year, not marked ended", 2: "ANZ T1/T2 undated", 3: "Global T1/T2 undated",
                 4: "ANZ other undated", 5: "other undated"}
        for g in sorted(c):
            print(f"{g}. {names[g]}: {c[g]}")
        return
    n = next((int(a) for a in sys.argv[1:] if a.isdigit()), 100)
    for g, _, _, _, i, d in q[:n]:
        print(json.dumps({"group": g, "deal": d["deal"], "sport": d.get("sport"), "market": d.get("market"),
                          "ttier": d.get("ttier"), "ptier": d.get("ptier"), "ends": d.get("ends"),
                          "listed": d.get("listed"), "url": d.get("url")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
