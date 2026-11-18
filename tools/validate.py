#!/usr/bin/env python3
"""Check deals.json against the rules before anything is committed.

    python3 tools/validate.py          # every row: summary of errors and warnings
    python3 tools/validate.py --new    # only rows not in the last commit (what a scan just added); exit 1 on any error
    python3 tools/validate.py --full   # every row, and list every problem

Errors (a new row with one is dropped and reported, never committed):
  missing field, deal not "Brand × Property", brand and property the same, market or status or tier off the
  list (data/lists.json), sport neither on the list nor a legacy league label, bad or future date, no date/month/listed,
  no url (unless needsSource), banned source (data/sources.json), end year before the start year,
  type that is a status word on a new row, same brand, property and date as an existing row.
Warnings (reported, fixed in the audit):
  legacy sport label, source domain not in the registry yet, live row whose end year has passed,
  region and market disagree, Reported lead story, summary missing.
"""
import datetime, json, re, subprocess, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sources as S

DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH = re.compile(r"^\d{4}-\d{2}$")
X = " × "


def key(d):
    n = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
    parts = d.get("deal", "").split(X)
    return tuple(n(p) for p in parts) + (d.get("date") or d.get("month") or d.get("listed") or "",)


def check(d, L, reg, today, new):
    E, W = [], []
    for f in ("deal", "sport", "type", "market", "status", "tier"):
        if not d.get(f):
            E.append(f"missing {f}")
    deal = d.get("deal", "")
    parts = deal.split(X)
    if deal and len(parts) != 2:
        E.append('deal is not "Brand × Property"')
    elif deal and parts[0].strip().lower() == parts[1].strip().lower():
        E.append("brand and property are the same")
    if d.get("market") and d["market"] not in L["markets"]:
        E.append(f"market off list: {d['market']}")
    if d.get("status") and d["status"] not in L["statuses"]:
        E.append(f"status off list: {d['status']}")
    if d.get("tier") and d["tier"] not in L["tiers"]:
        E.append(f"tier off list: {d['tier']}")
    sp = d.get("sport")
    if sp and sp not in L["sports"]:
        (W if sp in L["sportsLegacy"] else E).append(f"sport {'legacy label' if sp in L['sportsLegacy'] else 'off list'}: {sp}")
    if new and d.get("type") in L["typesStatusWords"]:
        E.append(f"type is a status word: {d['type']} (put it in status)")
    if not any(d.get(f) for f in ("date", "month", "listed")):
        E.append("no date, month or listed")
    for f in ("date", "listed", "added", "announced", "verified", "checked"):
        v = d.get(f)
        if v is None:
            continue
        if not (isinstance(v, str) and DAY.match(v)):
            (E if new else W).append(f"{f} not YYYY-MM-DD: {v}")
        elif v > today:
            E.append(f"{f} in the future: {v}")
    if d.get("month") and not MONTH.match(str(d["month"])):
        E.append(f"month not YYYY-MM: {d['month']}")
    url = d.get("url")
    if not url and not d.get("needsSource"):
        E.append("no url")
    if url:
        t = S.lookup(reg, S.domain(url))
        if t == "banned":
            E.append(f"banned source: {S.domain(url)}")
        elif t is None:
            W.append(f"source not in registry: {S.domain(url)} (run tools/sources.py)")
    start = (d.get("date") or d.get("announced") or d.get("month") or "")[:4]
    ends = d.get("ends")
    if isinstance(ends, int) and start.isdigit() and ends < int(start):
        E.append(f"ends {ends} before start {start}")
    if isinstance(ends, int) and ends < int(today[:4]) and not d.get("ended"):
        W.append(f"end year {ends} has passed but not marked ended")
    reg_ = d.get("region")
    if reg_ and d.get("market") and (reg_ == "ANZ") != (d["market"] == "ANZ"):
        W.append(f"region {reg_} vs market {d['market']}")
    if d.get("lead") and d.get("conf") != "Confirmed":
        W.append("lead story not on an official source")
    if not d.get("summary"):
        W.append("no summary")
    return E, W


def main():
    L = json.loads((ROOT / "data" / "lists.json").read_text(encoding="utf-8"))
    reg = S.load()
    deals = json.loads((ROOT / "deals.json").read_text(encoding="utf-8"))["deals"]
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=11))).date().isoformat()
    only_new = "--new" in sys.argv
    old_keys = Counter()
    if only_new:
        try:
            old = subprocess.run(["git", "show", "HEAD:deals.json"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
            old_keys = Counter(key(d) for d in json.loads(old)["deals"])
        except Exception as e:
            print(f"Couldn't read the last commit ({e}); checking every row as new")
    seen = Counter(key(d) for d in deals)
    errs, warns, rows = Counter(), Counter(), 0
    bad = []
    for d in deals:
        k = key(d)
        is_new = only_new and old_keys[k] == 0
        if only_new and not is_new:
            continue
        rows += 1
        E, W = check(d, L, reg, today, new=only_new)
        if seen[k] > 1:
            (E if is_new else W).append("same brand, property and date as another row")
        for e in E:
            errs[e.split(":")[0]] += 1
        for w in W:
            warns[re.sub(r"\b\d{4}\b", "N", w.split(":")[0].split(" (")[0])] += 1
        if E or ("--full" in sys.argv and W):
            bad.append((d.get("deal"), E, W))
    print(f"validate: {rows:,} rows checked, {sum(errs.values())} errors, {sum(warns.values())} warnings")
    for k, v in errs.most_common():
        print(f"  ERROR {k}: {v}")
    for k, v in warns.most_common():
        print(f"  warn  {k}: {v}")
    if only_new or "--full" in sys.argv:
        for deal, E, W in bad[:200]:
            print(f"- {deal}: " + "; ".join(E + (W if "--full" in sys.argv else [])))
    if only_new and errs:
        sys.exit(1)


if __name__ == "__main__":
    main()
