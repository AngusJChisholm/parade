"""Upload Pro's private files to the Supabase "pro" bucket.

    SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=... python3 tools/pro_upload.py

Run by .github/workflows/profiles.yml after tools/match.py and tools/audit.py. Uses the service key, which must only
ever live in GitHub Actions secrets. Exits non-zero if any upload fails, so the workflow keeps the files in the
repo rather than losing them.
"""
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = ["matches.json", "audit.json"]


def upload(base, key, name):
    body = (ROOT / "pro" / name).read_bytes()
    req = urllib.request.Request(
        f"{base}/storage/v1/object/pro/{name}",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
            "x-upsert": "true",
            "cache-control": "60",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status


def main():
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not base or not key:
        print("SUPABASE_URL or SUPABASE_SERVICE_KEY not set; nothing uploaded")
        return 1
    ok = True
    for name in FILES:
        if not (ROOT / "pro" / name).exists():
            print(f"  missing pro/{name}")
            ok = False
            continue
        try:
            status = upload(base, key, name)
            print(f"  pro/{name}: {status}")
        except Exception as e:  # noqa: BLE001
            print(f"  pro/{name}: FAILED {e}")
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
