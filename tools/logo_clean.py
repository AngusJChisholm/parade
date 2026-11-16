"""Cleans a logo image so it sits on the site with no box around it.
  1. Converts to RGBA (SVGs are rendered with rsvg-convert first).
  2. If the image has no real transparency and its border is plain white (or near-white), that white
     background is made transparent - only the white connected to the edge, so white inside the artwork stays.
     A coloured or busy border is left alone and reported, because removing it would wreck the logo.
  3. Trims away transparent padding so the artwork fills its box, then caps the longest side at 512px.
Writes PNG. Used by tools/logo_wiki.py and runnable on its own:
  python3 tools/logo_clean.py assets/logos/foo.png [more files]   (rewrites each as a trimmed .png next to it)"""
import io, os, subprocess, sys
import numpy as np
from PIL import Image
try:
    from scipy import ndimage
except Exception:   # flood fill falls back to a pure-numpy version
    ndimage = None

MAX = 512


def load(data, name=""):
    if name.lower().endswith(".svg") or data[:5] in (b"<?xml", b"<svg ") or b"<svg" in data[:400]:
        data = subprocess.run(["rsvg-convert", "-w", "1024", "--keep-aspect-ratio"], input=data, capture_output=True, check=True).stdout
    im = Image.open(io.BytesIO(data))
    if getattr(im, "n_frames", 1) > 1:
        im.seek(0)
    if im.mode == "P" and "transparency" in im.info:
        im = im.convert("RGBA")
    return im.convert("RGBA")


def _edge_connected(mask):
    """Pixels in mask that touch the image edge through other mask pixels."""
    if ndimage is not None:
        lab, n = ndimage.label(mask)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        return np.isin(lab, list(edge))
    seen = np.zeros_like(mask)
    seen[0], seen[-1], seen[:, 0], seen[:, -1] = mask[0], mask[-1], mask[:, 0], mask[:, -1]
    while True:
        grow = seen.copy()
        grow[1:] |= seen[:-1]; grow[:-1] |= seen[1:]; grow[:, 1:] |= seen[:, :-1]; grow[:, :-1] |= seen[:, 1:]
        grow &= mask
        if (grow == seen).all():
            return seen
        seen = grow


def clean(im):
    """Returns (cleaned RGBA image or None, note). note says what was done or why it was refused."""
    a = np.asarray(im).astype(np.int16)
    rgb, alpha = a[..., :3], a[..., 3]
    h, w = alpha.shape
    note = []
    see_through = (alpha < 16).mean()
    if see_through < 0.02:
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        bal = np.concatenate([alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
        border = border[bal > 128]
        if len(border) == 0:
            return None, "empty"
        whiteish = (border.min(axis=1) >= 225).mean()
        if whiteish >= 0.9:
            # distance from white: 0 = pure white. Hard-remove close whites, feather the next band for smooth edges.
            dist = 255 - rgb.min(axis=2)
            bg = _edge_connected(dist <= 40)
            soft = np.clip((dist - 12) / 28.0, 0, 1)          # 0..12 -> fully clear, 40 -> fully kept
            new_a = np.where(bg, (alpha * soft).astype(np.int16), alpha)
            a = np.dstack([rgb, new_a])
            note.append("white background removed")
        else:
            spread = border.std(axis=0).mean()
            note.append("coloured tile" if spread < 12 else "busy background")
            if spread >= 12:
                return None, "busy background (photo or graphic, not a clean logo)"
    out = Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")
    bbox = Image.fromarray((np.asarray(out)[..., 3] > 12).astype(np.uint8) * 255).getbbox()
    if not bbox:
        return None, "nothing left after removing background"
    out = out.crop(bbox)
    if min(out.size) < 8 or max(out.size) < 40:
        return None, f"too small ({out.size[0]}x{out.size[1]})"
    if max(out.size) > MAX:
        s = MAX / max(out.size)
        out = out.resize((max(1, round(out.size[0] * s)), max(1, round(out.size[1] * s))), Image.LANCZOS)
    if (np.asarray(out)[..., 3] > 12).mean() < 0.03:
        return None, "almost empty"
    note.append(f"trimmed to {out.size[0]}x{out.size[1]}")
    return out, "; ".join(note)


def save(im, path):
    im.save(path, "PNG", optimize=True)


if __name__ == "__main__":
    for p in sys.argv[1:]:
        out, note = clean(load(open(p, "rb").read(), p))
        if out is None:
            print(f"SKIP {p}: {note}"); continue
        dest = os.path.splitext(p)[0] + ".png"
        save(out, dest)
        if dest != p:
            os.remove(p)
        print(f"ok   {dest}: {note}")
