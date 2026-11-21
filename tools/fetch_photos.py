"""Copy every photo used in deals.json and features.json onto the site. Runs on GitHub.

- Unsplash photos -> assets/img/u/<photo-id>.jpg, so they load even where images.unsplash.com is blocked.
- Official club, league or brand photos (SOURCES.md rule 5): an entry with "imageSrc" (the image's own https URL from
  the official page) gets it downloaded to assets/img/p/<name>.jpg, and its "image" pointed at that local copy, so the
  site never hotlinks someone else's server. The JSON files are rewritten only when something changes.

    python3 tools/fetch_photos.py
"""
import hashlib, json, re, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img" / "u"
OUT.mkdir(parents=True, exist_ok=True)
got = 0
items = json.loads((ROOT / "deals.json").read_text())["deals"]
if (ROOT / "features.json").exists():
    items += json.loads((ROOT / "features.json").read_text()).get("features", [])
for d in items:
    m = re.match(r"^https://images\.unsplash\.com/(photo-[\w-]+)", str(d.get("image") or ""))
    if not m:
        continue
    dest = OUT / f"{m.group(1)}.jpg"
    if dest.exists() and dest.stat().st_size > 10_000:
        continue
    url = f"https://images.unsplash.com/{m.group(1)}?w=1600&q=80&fm=jpg&fit=crop"
    req = urllib.request.Request(url, headers={"User-Agent": "SportSportSport/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            dest.write_bytes(r.read())
        got += 1
        print("saved", dest.name)
    except Exception as e:
        print("failed", m.group(1), e)
print(f"{got} new photo(s)")

# Official photos ("imageSrc"): download once, then point "image" at the local copy.
PRESS = ROOT / "assets" / "img" / "p"
PRESS.mkdir(parents=True, exist_ok=True)
pressed = 0
for name in ("deals.json", "features.json"):
    path = ROOT / name
    if not path.exists():
        continue
    data = json.loads(path.read_text())
    rows = data.get("deals") if name == "deals.json" else data.get("features", [])
    changed = False
    for d in rows or []:
        src = str(d.get("imageSrc") or "")
        if not src.startswith("https://"):
            continue
        dest = PRESS / (hashlib.sha1(src.encode()).hexdigest()[:16] + ".jpg")
        rel = str(dest.relative_to(ROOT))
        if not (dest.exists() and dest.stat().st_size > 10_000):
            try:
                req = urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0 (Parade photo copy)"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    raw = r.read()
                try:  # keep the site light: max 1800px wide JPEG
                    from io import BytesIO
                    from PIL import Image
                    im = Image.open(BytesIO(raw)).convert("RGB")
                    if im.width > 1800:
                        im = im.resize((1800, round(im.height * 1800 / im.width)))
                    buf = BytesIO(); im.save(buf, "JPEG", quality=82); raw = buf.getvalue()
                except Exception:
                    pass
                dest.write_bytes(raw)
                pressed += 1
                print("saved official photo", rel, "from", src)
            except Exception as e:
                print("failed official photo", src, e)
                continue
        if d.get("image") != rel:
            d["image"] = rel
            changed = True
    if changed:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + ("\n" if name == "deals.json" else ""))
        print("updated", name)
print(f"{pressed} new official photo(s)")
