"""Builds ticker.json for the live ticker fixed to the bottom of every page (assets/chrome.js reads it).

Small on purpose: the latest dated partnerships plus a few database counts, so no page has to load deals.json
just for the ticker. Run after deals.json changes:  python3 tools/build_ticker.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    deals = json.loads((ROOT / "deals.json").read_text(encoding="utf-8"))["deals"]
    ents = json.loads((ROOT / "entities.json").read_text(encoding="utf-8")).get("entities", {})
    names = {}
    for k, e in ents.items():
        if e.get("k") in ("b", "p"):
            for n in [e.get("name", "")] + list(e.get("aliases") or []):
                names.setdefault(n.lower(), ("brands/" if e["k"] == "b" else "properties/") + k)
    live = [d for d in deals if not d.get("ended")]
    dated = sorted((d for d in live if d.get("date")), key=lambda d: (d["date"], d.get("added", "")), reverse=True)
    items = []
    seen = set()
    for d in dated:
        if d["deal"] in seen:
            continue
        seen.add(d["deal"])
        status = d.get("status") or "New"
        items.append({"deal": d["deal"], "sport": d.get("sport", ""), "status": status if status in ("New", "Renewal", "Extension", "Expansion") else "New",
                      "date": d["date"], "href": names.get(d["deal"].split(" × ")[0].strip().lower()) or names.get(d["deal"].split(" × ")[-1].strip().lower()) or "partnerships"})
        if len(items) >= 18:
            break
    anz = sum(1 for d in live if d.get("region") == "ANZ")
    out = {"total": f"{len(live):,}", "counts": [{"label": "Global", "value": f"{len(live):,}"}, {"label": "ANZ", "value": f"{anz:,}"}], "items": items}
    (ROOT / "ticker.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"ticker.json: {len(items)} items, {len(live)} live partnerships, {anz} ANZ")


if __name__ == "__main__":
    main()
