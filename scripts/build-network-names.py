#!/usr/bin/env python3
"""Query StarRocks for a name per render-index in a john-2hop.bin, write
a names.json sidecar.

The portrait labels previously only had names for the ~1,100 photoed
people in the atlas manifest. This script extends coverage to every node
in the bin via `starrocks_people.full_name`, so non-photoed people get a
label too.

Output schema:
    {"count": N, "names": ["John Kalogerakis", "Mark Faga", "", ...]}

`names[i]` is the full_name for render-index i, or empty string when
StarRocks has no row for that eid. Parallel to the bin's render order.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import subprocess
import sys
from pathlib import Path

PER_NODE_BYTES = 1 + 4 + 4 + 4 + 4  # u8 hop, f32 x, f32 y, f32 score, u32 eid
DEFAULT_SECRET = 'starrocks/person-network/credentials'
DEFAULT_DB = 'via_tokyo_db'


def get_credentials(secret_id: str) -> dict[str, str]:
    res = subprocess.run(
        ['aws', 'secretsmanager', 'get-secret-value', '--secret-id', secret_id, '--query', 'SecretString', '--output', 'text'],
        capture_output=True, text=True, check=True,
    )
    return json.loads(res.stdout)


def read_bin_eids(path: Path) -> list[int]:
    data = path.read_bytes()
    n = struct.unpack('<I', data[:4])[0]
    eids: list[int] = []
    off = 8
    for _ in range(n):
        eids.append(struct.unpack('<I', data[off:off + 4])[0])
        off += PER_NODE_BYTES
    return eids


def fetch_names(eids: list[int], creds: dict[str, str]) -> dict[int, str]:
    """One query, all eids — starrocks_people is keyed by entity_int_id
    so even a 5k IN-list returns in well under a second on a warm cache."""
    if not eids:
        return {}
    args = [
        '/opt/homebrew/opt/mysql-client/bin/mysql',
        '-h', creds['host'], '-P', str(creds.get('port', '9030')),
        '-u', creds.get('user', 'root'), creds.get('database', DEFAULT_DB),
        '--connect-timeout=10', '-B',
        '-e', f'SELECT entity_int_id, full_name FROM starrocks_people WHERE entity_int_id IN ({",".join(str(e) for e in eids)}) AND full_name IS NOT NULL',
    ]
    env = dict(os.environ)
    pwd = creds.get('password', '')
    if pwd:
        env['MYSQL_PWD'] = pwd
    res = subprocess.run(args, capture_output=True, text=True, env=env, timeout=180)
    if res.returncode != 0:
        raise RuntimeError(f'starrocks_people query failed: {res.stderr.strip()[:240]}')
    lines = res.stdout.strip().split('\n')
    if len(lines) < 2:
        return {}
    out: dict[int, str] = {}
    for line in lines[1:]:
        parts = line.split('\t')
        if len(parts) < 2:
            continue
        try:
            eid = int(parts[0])
        except ValueError:
            continue
        name = parts[1].strip()
        if name and name != 'NULL':
            out[eid] = name
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--bin', default='demo/public/network-a/john-2hop.bin')
    ap.add_argument('--out', default=None, help='names.json path (default: alongside --bin)')
    ap.add_argument('--secret', default=DEFAULT_SECRET)
    args = ap.parse_args()

    bin_path = Path(args.bin)
    eids = read_bin_eids(bin_path)
    print(f'reading names for {len(eids):,} nodes', file=sys.stderr)

    creds = get_credentials(args.secret)
    fetched = fetch_names(eids, creds)
    names = [fetched.get(e, '') for e in eids]
    populated = sum(1 for n in names if n)
    print(f'got names for {populated:,} / {len(eids):,} nodes', file=sys.stderr)

    out_path = Path(args.out) if args.out else bin_path.parent / 'names.json'
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({'count': len(eids), 'names': names}))
    print(f'wrote {out_path}', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
