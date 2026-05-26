#!/usr/bin/env python3
"""Build a headshot atlas pyramid for the neon-glass representation.

Input  CSV: entity_int_id,full_name,avatar_url   (no header)
Output:
  demo/public/headshots/atlas-64.webp    — 4000 × 64×64 cells in one image
  demo/public/headshots/atlas-256.webp   — 4000 × 256×256 cells in one image
  demo/public/headshots/manifest.json    — id→{idx,name}, grid dims

Run:
  python3 scripts/build-headshot-atlas.py --csv /tmp/headshot-build/headshots.csv
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import io
import json
import math
import sys
import time
from pathlib import Path

import aiohttp
from PIL import Image, ImageOps

CONCURRENCY = 64
TIMEOUT_S = 15

async def fetch_one(session: aiohttp.ClientSession, url: str) -> bytes | None:
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=TIMEOUT_S)) as r:
            if r.status != 200:
                return None
            return await r.read()
    except Exception:
        return None

async def fetch_all(rows: list[tuple[int, str, str]]) -> list[bytes | None]:
    out: list[bytes | None] = [None] * len(rows)
    sem = asyncio.Semaphore(CONCURRENCY)
    async with aiohttp.ClientSession() as session:
        async def task(i: int, url: str) -> None:
            async with sem:
                out[i] = await fetch_one(session, url)
        tasks = [task(i, r[2]) for i, r in enumerate(rows)]
        done = 0
        for fut in asyncio.as_completed(tasks):
            await fut
            done += 1
            if done % 200 == 0:
                print(f"  fetched {done}/{len(rows)}", file=sys.stderr)
    return out

def crop_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    if w == h:
        return img
    s = min(w, h)
    # Bias the crop up a bit so face is centered (heuristic for portrait headshots).
    left = (w - s) // 2
    top = max(0, (h - s) // 2 - int(h * 0.04))
    return img.crop((left, top, left + s, top + s))

def build_atlas(blobs: list[bytes | None], cell_px: int, grid_n: int) -> tuple[Image.Image, list[int]]:
    atlas_size = cell_px * grid_n
    atlas = Image.new("RGB", (atlas_size, atlas_size), (0, 0, 0))
    placed = 0
    failed_idx: list[int] = []
    for i, blob in enumerate(blobs):
        if blob is None:
            failed_idx.append(i)
            continue
        try:
            with Image.open(io.BytesIO(blob)) as im:
                # Honour EXIF orientation — LinkedIn frequently uploads
                # photos with rotation flags instead of rotating the pixels.
                im = ImageOps.exif_transpose(im)
                im = im.convert("RGB")
                im = crop_square(im)
                im = im.resize((cell_px, cell_px), Image.LANCZOS)
                x = (i % grid_n) * cell_px
                y = (i // grid_n) * cell_px
                atlas.paste(im, (x, y))
                placed += 1
        except Exception:
            failed_idx.append(i)
    print(f"  placed={placed} failed={len(failed_idx)} at cell={cell_px}px", file=sys.stderr)
    return atlas, failed_idx

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--out", default="demo/public/headshots")
    args = ap.parse_args()

    rows: list[tuple[int, str, str]] = []
    with open(args.csv, newline="") as f:
        for r in csv.reader(f):
            if len(r) < 3:
                continue
            try:
                rows.append((int(r[0]), r[1], r[2]))
            except ValueError:
                continue

    n = len(rows)
    grid_n = math.ceil(math.sqrt(n))
    print(f"rows={n} grid={grid_n}x{grid_n}", file=sys.stderr)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    print("fetching images…", file=sys.stderr)
    t0 = time.time()
    blobs = asyncio.run(fetch_all(rows))
    print(f"fetched in {time.time() - t0:.1f}s", file=sys.stderr)

    # Single-sheet atlas for small cells (fits inside 16383-px WebP limit).
    failed_idx: list[int] = []
    for cell in (128,):
        print(f"building atlas-{cell}.webp…", file=sys.stderr)
        atlas, failed_idx = build_atlas(blobs, cell, grid_n)
        path = out / f"atlas-{cell}.webp"
        atlas.save(path, "WEBP", quality=82, method=6)
        print(f"  wrote {path} ({path.stat().st_size//1024} KB)", file=sys.stderr)

    manifest = {
        "count": n,
        "grid": grid_n,
        "cellSizes": [128],
        "missing": failed_idx,
        "entries": [{"id": r[0], "name": r[1]} for r in rows],
    }
    mpath = out / "manifest.json"
    mpath.write_text(json.dumps(manifest, separators=(",", ":")))
    print(f"wrote {mpath} ({mpath.stat().st_size//1024} KB)", file=sys.stderr)
    return 0

if __name__ == "__main__":
    sys.exit(main())
