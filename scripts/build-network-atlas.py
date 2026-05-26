#!/usr/bin/env python3
"""Pick the top-K most-important nodes from the 2-hop network that also
have avatars in RDS, then build a 128 px atlas for them and a small
JSON manifest mapping render-index → atlas-cell.

Inputs :
  /tmp/john-2hop.bin   (positions binary)
  RDS app_primary_production (people.avatar_url lookup)

Outputs:
  demo/public/network/atlas-128.webp
  demo/public/network/photo-manifest.json
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

PG_HOST = 'app-primary.c4joiqgke9ym.us-east-1.rds.amazonaws.com'
PG_USER = 'postgres'
PG_DB = 'app_primary_production'
PG_PASSWORD = '-3Zy3mchcEWmtD_kyFrN8Am-em*7MTBCvEhz.hG!qsB2F_APvAxqcw..4LfW'
PSQL = '/opt/homebrew/opt/libpq/bin/psql'

def parse_network(path: Path) -> list[tuple[int, int, float]]:
    """Return list of (render_idx, eid, score). render_idx is the offset
    in the binary, used as the Cosmos point index."""
    data = path.read_bytes()
    n = struct.unpack('<I', data[:4])[0]
    rows: list[tuple[int, int, float]] = []
    per = 1 + 4 + 4 + 4 + 4
    off = 8
    for i in range(n):
        eid = struct.unpack('<I', data[off:off + 4])[0]
        _hop = data[off + 4]
        _x, _y, score = struct.unpack('<fff', data[off + 5:off + per])
        rows.append((i, eid, score))
        off += per
    return rows

def fetch_avatar_urls(eids: list[int], chunk_size: int = 5000) -> dict[int, tuple[str, str]]:
    """Query RDS for {eid: (name, avatar_url)} across the eid list."""
    found: dict[int, tuple[str, str]] = {}
    for i in range(0, len(eids), chunk_size):
        chunk = eids[i:i + chunk_size]
        ids_csv = ','.join(str(e) for e in chunk)
        sql = (
            f"SELECT entity_int_id, COALESCE(full_name,''), avatar_url "
            f"FROM people WHERE entity_int_id = ANY(ARRAY[{ids_csv}]::bigint[]) "
            f"AND discarded_at IS NULL AND avatar_url IS NOT NULL;"
        )
        env = dict(os.environ, PGPASSWORD=PG_PASSWORD)
        res = subprocess.run(
            [PSQL, '-h', PG_HOST, '-U', PG_USER, '-d', PG_DB, '-t', '-A', '-F', '\t', '-c', sql],
            env=env, capture_output=True, text=True, timeout=120,
        )
        if res.returncode != 0:
            print(f'psql error: {res.stderr}', file=sys.stderr)
            continue
        for line in res.stdout.strip().split('\n'):
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) < 3:
                continue
            try:
                eid = int(parts[0])
            except ValueError:
                continue
            found[eid] = (parts[1], parts[2])
        print(f'  fetched chunk {i + len(chunk):,}/{len(eids):,}  (cumulative photo coverage: {len(found):,})', file=sys.stderr)
    return found

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--bin', default='/tmp/john-2hop.bin')
    ap.add_argument('--out-dir', default='demo/public/network')
    ap.add_argument('--top-k', type=int, default=4000)
    args = ap.parse_args()

    rows = parse_network(Path(args.bin))
    print(f'network: {len(rows):,} nodes', file=sys.stderr)
    # Score-descending pick: keep root + 1-hop + highest-score 2-hop until top-k.
    rows_sorted = sorted(rows, key=lambda r: -r[2])
    candidate_eids = [r[1] for r in rows_sorted[: max(args.top_k * 3, args.top_k + 2000)]]
    avatars = fetch_avatar_urls(candidate_eids)
    print(f'photo coverage: {len(avatars):,} of {len(candidate_eids):,} candidates', file=sys.stderr)

    # Walk score-descending and take the first K that have a photo.
    chosen: list[tuple[int, int, str, str]] = []  # (render_idx, eid, name, url)
    for render_idx, eid, _score in rows_sorted:
        if len(chosen) >= args.top_k:
            break
        if eid in avatars:
            name, url = avatars[eid]
            chosen.append((render_idx, eid, name, url))
    print(f'selected top-K with photo: {len(chosen):,}', file=sys.stderr)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Hand off the CSV to the existing atlas builder (cell=128 px).
    with tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False) as tf:
        for _idx, eid, name, url in chosen:
            tf.write(f'{eid},{name},{url}\n')
        csv_path = tf.name
    print(f'wrote CSV {csv_path}', file=sys.stderr)
    res = subprocess.run(
        ['python3', 'scripts/build-headshot-atlas.py', '--csv', csv_path, '--out', str(out_dir)],
        capture_output=True, text=True,
    )
    print(res.stderr, file=sys.stderr)
    if res.returncode != 0:
        return 1

    # Manifest: which render-indices have a photo, and at what atlas cell.
    # The atlas builder writes its own manifest with sequential entries
    # matching CSV row order, so atlas_cell == position in `chosen`.
    photo_manifest = {
        'render_count': len(rows),
        'photo_count': len(chosen),
        'photoed_render_indices': [c[0] for c in chosen],
        'eids': [c[1] for c in chosen],
        'names': [c[2] for c in chosen],
    }
    (out_dir / 'photo-manifest.json').write_text(json.dumps(photo_manifest))
    print(f'wrote photo-manifest.json ({(out_dir / "photo-manifest.json").stat().st_size // 1024} KB)', file=sys.stderr)
    return 0

if __name__ == '__main__':
    sys.exit(main())
