#!/usr/bin/env python3
"""Pull facet attributes (company, industry, title, function, level) for
every node in a john-2hop.bin from StarRocks, and emit
`attributes.json` next to the bin.

Required AWS Secret: `starrocks/person-network/credentials`. Reads from
`via_tokyo_db.person_norm` (atomic IDs) and joins out to
`starrocks_companies`, `starrocks_employment_positions_history`,
`person_role`, and lookup tables for function / level names.

Tolerates partial timeouts: a chunk that fails is recorded with null
attributes for that batch and the build continues. Always writes
manifest at the end, even if some queries failed.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

PER_NODE_BYTES = 1 + 4 + 4 + 4 + 4
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
        eid = struct.unpack('<I', data[off:off + 4])[0]
        eids.append(eid)
        off += PER_NODE_BYTES
    return eids

def run_starrocks(host: str, port: str, user: str, password: str, db: str, sql: str, timeout: int = 240) -> list[dict[str, str]]:
    """Returns rows as list of dicts. Each row maps column-name → value (or empty
    string for nulls). Raises subprocess.CalledProcessError on hard error."""
    args = [
        '/opt/homebrew/opt/mysql-client/bin/mysql',
        '-h', host, '-P', str(port), '-u', user, db,
        '--connect-timeout=10', '-B',  # tab-separated
        '-e', sql,
    ]
    env = dict(os.environ)
    if password:
        env['MYSQL_PWD'] = password
    res = subprocess.run(args, capture_output=True, text=True, env=env, timeout=timeout)
    if res.returncode != 0:
        raise RuntimeError(f'StarRocks query failed: {res.stderr.strip()[:240]}')
    lines = res.stdout.strip().split('\n')
    if not lines:
        return []
    header = lines[0].split('\t')
    rows: list[dict[str, str]] = []
    for line in lines[1:]:
        parts = line.split('\t')
        # MySQL -B prints the literal text 'NULL' for SQL nulls; normalise to ''.
        row = {
            header[i]: ('' if (i >= len(parts) or parts[i] == 'NULL') else parts[i])
            for i in range(len(header))
        }
        rows.append(row)
    return rows

def fetch_attributes(eids: list[int], creds: dict[str, str], chunk_size: int = 200) -> dict[int, dict[str, str | None]]:
    """Query StarRocks in chunks; return {pid: {company, industry, title,
    function, level}}. Uses person_norm for atomic lookups (keyed) then
    joins out by id. Falls back to empty when a chunk times out."""
    out: dict[int, dict[str, str | None]] = {}
    for start in range(0, len(eids), chunk_size):
        chunk = eids[start:start + chunk_size]
        ids_csv = ','.join(str(e) for e in chunk)
        sql = (
            'SELECT pn.pid, '
            "       pr.org_function AS function_name, "
            "       pr.normalized_role AS role_name, "
            "       pr.seniority_name, "
            "       pr.raw_title, "
            "       c.primary_name AS company_name, "
            "       c.primary_industry AS industry, "
            "       c.market AS market "
            'FROM person_norm pn '
            'LEFT JOIN person_role pr ON pr.person_id = pn.pid '
            'LEFT JOIN starrocks_companies c ON c.entity_int_id = pn.current_cid '
            f'WHERE pn.pid IN ({ids_csv})'
        )
        try:
            rows = run_starrocks(creds['host'], creds.get('port', '9030'), creds.get('user', 'root'), creds.get('password', ''), creds.get('database', DEFAULT_DB), sql, timeout=240)
        except Exception as e:
            print(f'  chunk {start}-{start + len(chunk)} failed: {e}', file=sys.stderr)
            continue
        for row in rows:
            pid_str = row.get('pid', '')
            if not pid_str:
                continue
            try:
                pid = int(pid_str)
            except ValueError:
                continue
            out[pid] = {
                'company': row.get('company_name') or None,
                'industry': row.get('industry') or None,
                'market': row.get('market') or None,
                'title': row.get('raw_title') or None,
                'function': row.get('function_name') or None,
                'level': row.get('seniority_name') or None,
            }
        print(f'  fetched chunk {start + len(chunk):,}/{len(eids):,}  (cumulative attributes: {len(out):,})', file=sys.stderr)
    return out

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--bin', default='demo/public/network/john-2hop.bin')
    ap.add_argument('--out', default=None, help='attributes.json path (default: alongside --bin)')
    ap.add_argument('--secret', default=DEFAULT_SECRET)
    ap.add_argument('--chunk', type=int, default=200)
    args = ap.parse_args()

    bin_path = Path(args.bin)
    eids = read_bin_eids(bin_path)
    print(f'reading attributes for {len(eids):,} nodes', file=sys.stderr)

    creds = get_credentials(args.secret)
    fetched = fetch_attributes(eids, creds, chunk_size=args.chunk)
    print(f'got attributes for {len(fetched):,} / {len(eids):,} nodes', file=sys.stderr)

    manifest = {
        'count': len(eids),
        'eids': eids,
        'companies': [fetched.get(e, {}).get('company') for e in eids],
        'industries': [fetched.get(e, {}).get('industry') for e in eids],
        'markets': [fetched.get(e, {}).get('market') for e in eids],
        'titles': [fetched.get(e, {}).get('title') for e in eids],
        'functions': [fetched.get(e, {}).get('function') for e in eids],
        'levels': [fetched.get(e, {}).get('level') for e in eids],
    }
    out_path = Path(args.out) if args.out else bin_path.parent / 'attributes.json'
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(manifest))
    print(f'wrote {out_path}', file=sys.stderr)
    return 0

if __name__ == '__main__':
    sys.exit(main())
