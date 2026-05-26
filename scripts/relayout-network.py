#!/usr/bin/env python3
"""Re-lay-out the existing john-2hop.bin with sparser rings so 70-world-unit
dots can be packed without overlap.

The original layout was tuned for tiny colored dots (~15 world cells); now
each node renders as a 70-world disc, which physically can't fit 19,074
nodes inside an 8192-world canvas. We keep John + all hop-1 (4,156) and
the top-K hop-2 by score, then re-lay them out with explicit ringCounts
chosen so both radial AND angular spacing are ≥ 70 world units.

Inputs : demo/public/network/john-2hop.bin
         demo/public/network/photo-manifest.json
Outputs: demo/public/network/john-2hop.bin   (overwritten — new count)
         demo/public/network/photo-manifest.json (render-index remap)
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path

PER_NODE_BYTES = 1 + 4 + 4 + 4 + 4

def read_bin(path: Path) -> list[tuple[int, int, float, float, float]]:
    """Returns rows of (eid, hop, x, y, score)."""
    data = path.read_bytes()
    n = struct.unpack('<I', data[:4])[0]
    rows: list[tuple[int, int, float, float, float]] = []
    off = 8
    for _ in range(n):
        eid = struct.unpack('<I', data[off:off + 4])[0]
        hop = data[off + 4]
        x, y, score = struct.unpack('<fff', data[off + 5:off + PER_NODE_BYTES])
        rows.append((eid, hop, x, y, score))
        off += PER_NODE_BYTES
    return rows

def write_bin(path: Path, rows: list[tuple[int, int, float, float, float]]) -> None:
    with path.open('wb') as f:
        f.write(struct.pack('<II', len(rows), 0))
        for eid, hop, x, y, score in rows:
            f.write(struct.pack('<IBfff', eid, hop, x, y, score))

def annular(items: list[tuple[int, float]], r_inner: float, r_outer: float, hop: int,
            ring_count: int) -> dict[int, tuple[int, float, float, float]]:
    """Lay `items` (eid, score) onto `ring_count` rings in [r_inner, r_outer].
    Returns {eid: (hop, x, y, score)}. Score-desc items go to inner rings."""
    out: dict[int, tuple[int, float, float, float]] = {}
    if not items:
        return out
    sorted_items = sorted(items, key=lambda x: -x[1])
    step = (r_outer - r_inner) / max(1, ring_count)
    # Per-ring count proportional to circumference (radius).
    weights = [r_inner + (k + 0.5) * step for k in range(ring_count)]
    total = sum(weights) or 1
    per = [max(1, round(w / total * len(items))) for w in weights]
    per[-1] = max(1, per[-1] + (len(items) - sum(per)))
    idx = 0
    for r_i, count in enumerate(per):
        if count <= 0 or idx >= len(sorted_items):
            continue
        radius = r_inner + (r_i + 0.5) * step
        # Golden-angle phase offset per ring so the lattice isn't aliased.
        offset = (r_i * 0.61803) % 1.0
        for j in range(count):
            if idx >= len(sorted_items):
                break
            eid, score = sorted_items[idx]
            ang = (offset + j / count) * 2 * math.pi
            out[eid] = (hop, radius * math.cos(ang), radius * math.sin(ang), score)
            idx += 1
    return out

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--bin', default='demo/public/network/john-2hop.bin')
    ap.add_argument('--bin-out', default=None, help='Defaults to --bin (in-place).')
    ap.add_argument('--manifest', default='demo/public/network/photo-manifest.json')
    ap.add_argument('--manifest-out', default=None, help='Defaults to --manifest.')
    ap.add_argument('--top-2hop', type=int, default=6000)
    # Defaults preserve previous hardcoded behavior: hop-1 [80, 1600]/30 rings,
    # hop-2 [1650, 2030]/11 rings. Pass explicit flags to override.
    ap.add_argument('--hop1-inner', type=float, default=80.0)
    ap.add_argument('--hop1-outer', type=float, default=1600.0)
    ap.add_argument('--hop2-inner', type=float, default=1650.0)
    ap.add_argument('--hop2-outer', type=float, default=2030.0)
    ap.add_argument('--hop1-rings', type=int, default=30)
    ap.add_argument('--hop2-rings', type=int, default=11)
    args = ap.parse_args()

    bin_path = Path(args.bin)
    bin_out_path = Path(args.bin_out) if args.bin_out else bin_path
    rows = read_bin(bin_path)
    print(f'read {len(rows):,} rows from {bin_path}', file=sys.stderr)

    root = next((r for r in rows if r[1] == 0), None)
    hop1 = [r for r in rows if r[1] == 1]
    hop2 = sorted((r for r in rows if r[1] == 2), key=lambda r: -r[4])[: args.top_2hop]
    print(f'kept: 1 root + {len(hop1):,} hop-1 + {len(hop2):,} hop-2', file=sys.stderr)

    # Layout radii chosen so cells stay ≥ 70 world units after the loader's
    # SCALE=2 step. Python-space: hop-1 radii 80→1280, hop-2 1330→1820.
    # ringCount tuned so 2π·R_outer / nodes_per_ring ≥ 35 (= 70 / SCALE).
    items_hop1 = [(r[0], r[4]) for r in hop1]
    items_hop2 = [(r[0], r[4]) for r in hop2]
    # Radii + ringCounts chosen so both radial AND angular spacing are
    # comfortably ≥ 45 Python units (= 90 world units, leaving a 20-world
    # gap around each 70-world dot).
    #   hop-1 (4,156): annulus [80, 1600], 30 rings → step 50, per-ring 138,
    #     angular@outer ≈ 73. Cells ≈ 100×146 world.
    #   hop-2 (top-K): annulus [1650, 2030], 11 rings → step 35→70 world,
    #     per-ring depends on K; we cap K so angular@outer stays > 50.
    laid_hop1 = annular(items_hop1, args.hop1_inner, args.hop1_outer, hop=1, ring_count=args.hop1_rings)
    laid_hop2 = annular(items_hop2, args.hop2_inner, args.hop2_outer, hop=2, ring_count=args.hop2_rings)

    new_rows: list[tuple[int, int, float, float, float]] = []
    new_rows.append((root[0] if root else 51197947, 0, 0.0, 0.0, 1_000_000.0))
    for eid, (hop, x, y, score) in laid_hop1.items():
        new_rows.append((eid, hop, x, y, score))
    for eid, (hop, x, y, score) in laid_hop2.items():
        new_rows.append((eid, hop, x, y, score))
    new_rows.sort(key=lambda r: (r[1], -r[4]))

    bin_out_path.parent.mkdir(parents=True, exist_ok=True)
    write_bin(bin_out_path, new_rows)
    print(f'wrote {len(new_rows):,} rows to {bin_out_path}', file=sys.stderr)

    # Remap photo-manifest: rebuild render-index mapping for surviving nodes.
    man_path = Path(args.manifest)
    man_out_path = Path(args.manifest_out) if args.manifest_out else man_path
    if man_path.exists():
        man = json.loads(man_path.read_text())
        eid_to_new_idx = {eid: i for i, (eid, *_rest) in enumerate(new_rows)}
        new_photoed: list[int] = []
        new_eids: list[int] = []
        new_names: list[str] = []
        # Original manifest's i-th entry has eid man['eids'][i].
        for i, eid in enumerate(man.get('eids', [])):
            new_idx = eid_to_new_idx.get(eid)
            if new_idx is None:
                continue
            new_photoed.append(new_idx)
            new_eids.append(eid)
            new_names.append(man['names'][i] if i < len(man.get('names', [])) else '')
        out_man = {
            'render_count': len(new_rows),
            'photo_count': len(new_photoed),
            'photoed_render_indices': new_photoed,
            'eids': new_eids,
            'names': new_names,
        }
        man_out_path.parent.mkdir(parents=True, exist_ok=True)
        man_out_path.write_text(json.dumps(out_man))
        print(f'remapped manifest: {out_man["photo_count"]:,} photos / {out_man["render_count"]:,} nodes -> {man_out_path}', file=sys.stderr)
    return 0

if __name__ == '__main__':
    sys.exit(main())
