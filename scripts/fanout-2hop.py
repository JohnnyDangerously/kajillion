#!/usr/bin/env python3
"""Fan out from John's 1-hop neighbours via CSR /neighborhood_graph_raw,
dedupe into a unique 2-hop set, and write positions in a hop-band concentric
layout.

Input  : /tmp/john-1hop-ids.txt   (one int per line, CSR score-descending)
Output : /tmp/john-2hop.bin
           header [u32:n][u32:e]
           nodes  n × [u32 entity_int_id, u8 hop, f32 x, f32 y, f32 score]
           edges  e × [u32 srcIdx, u32 dstIdx, u16 score]
         /tmp/john-2hop-stats.json  (counts, fan-out timing)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import struct
import sys
import time
from pathlib import Path

import aiohttp

CSR_URL = 'http://csr-postings.internal.connectvia.ai:8080/neighborhood_graph_raw'

async def fetch_hood(session: aiohttp.ClientSession, root: int, max_neighbors: int, min_score: int) -> bytes | None:
    body = {'root': root, 'max_neighbors': max_neighbors, 'edge_min_score': min_score}
    try:
        async with session.post(CSR_URL, json=body, timeout=aiohttp.ClientTimeout(total=20)) as r:
            if r.status != 200:
                return None
            return await r.read()
    except Exception:
        return None

def parse_hood(buf: bytes) -> tuple[int, list[tuple[int, int]]]:
    if len(buf) < 12:
        return 0, []
    root, nc, _ec = struct.unpack('<III', buf[:12])
    out: list[tuple[int, int]] = []
    for i in range(nc):
        off = 12 + i * 6
        nbr, score = struct.unpack('<IH', buf[off:off + 6])
        out.append((nbr, score))
    return root, out

async def fan_out(roots: list[int], max_neighbors: int, min_score: int, concurrency: int) -> dict[int, int]:
    """Return {entity_int_id: best_score} for all 2-hop neighbours."""
    best: dict[int, int] = {}
    sem = asyncio.Semaphore(concurrency)
    done = 0
    async with aiohttp.ClientSession() as session:
        async def one(root: int) -> None:
            nonlocal done
            async with sem:
                buf = await fetch_hood(session, root, max_neighbors, min_score)
            done += 1
            if done % 100 == 0:
                print(f'  fanned {done}/{len(roots)} unique-2hop={len(best):,}', file=sys.stderr)
            if buf is None:
                return
            _, neighbours = parse_hood(buf)
            for nbr, score in neighbours:
                if best.get(nbr, 0) < score:
                    best[nbr] = score
        await asyncio.gather(*(one(r) for r in roots))
    return best

def hop_band_layout(
    john_id: int,
    hop1: list[tuple[int, int]],
    hop2: list[tuple[int, int]],
    inner: float = 80.0,
    mid: float = 950.0,
    outer: float = 2000.0,
) -> dict[int, tuple[int, float, float, int]]:
    """Concentric layout: John at origin, hop1 in an inner annulus, hop2 in
    an outer annulus. Both annuli use polar packing (sqrt(n/π) rings).
    Returns {eid: (hop, x, y, score)}.
    """
    nodes: dict[int, tuple[int, float, float, int]] = {}
    nodes[john_id] = (0, 0.0, 0.0, 1_000_000)

    def annular(items: list[tuple[int, int]], r_inner: float, r_outer: float, hop: int) -> None:
        n = len(items)
        if n == 0:
            return
        rings = max(2, min(80, round(math.sqrt(n / math.pi))))
        step = (r_outer - r_inner) / rings
        # Distribute by ring proportional to circumference. Highest scores
        # go to the innermost rings (closer to John = visually nearer).
        weights = [r_inner + (k + 0.5) * step for k in range(rings)]
        total = sum(weights)
        per = [max(1, round(w / total * n)) for w in weights]
        # Adjust last ring to match exactly.
        per[-1] = max(1, per[-1] + (n - sum(per)))
        sorted_items = sorted(items, key=lambda x: -x[1])
        idx = 0
        for r_i, count in enumerate(per):
            if count <= 0 or idx >= n:
                continue
            radius = r_inner + (r_i + 0.5) * step
            offset = (r_i * 0.61803) % 1.0  # golden-angle ring offset for de-aliasing
            for j in range(count):
                if idx >= n:
                    break
                eid, score = sorted_items[idx]
                a = (offset + j / count) * 2 * math.pi
                nodes[eid] = (hop, radius * math.cos(a), radius * math.sin(a), score)
                idx += 1
    annular(hop1, inner, mid, 1)
    annular(hop2, mid + 30.0, outer, 2)
    return nodes

async def main_async(args) -> int:
    one_hop_ids = [int(x) for x in Path(args.ids).read_text().split()]
    print(f'roots={len(one_hop_ids):,}', file=sys.stderr)

    t0 = time.time()
    hop2_raw = await fan_out(one_hop_ids, args.max_neighbors, args.min_score, args.concurrency)
    fan_secs = time.time() - t0
    print(f'fan-out done in {fan_secs:.1f}s; 2-hop universe size {len(hop2_raw):,}', file=sys.stderr)

    JOHN = 51197947
    hop1_set = set(one_hop_ids)
    hop1 = [(i, hop2_raw.get(i, 0)) for i in one_hop_ids]
    hop2 = [(i, s) for i, s in hop2_raw.items() if i not in hop1_set and i != JOHN]
    hop2.sort(key=lambda x: -x[1])
    if args.max_2hop > 0:
        hop2 = hop2[: args.max_2hop]
    print(f'kept 2-hop: {len(hop2):,}', file=sys.stderr)

    nodes = hop_band_layout(JOHN, hop1, hop2)

    eids = sorted(nodes.keys(), key=lambda e: (nodes[e][0], -nodes[e][3]))
    idx = {eid: i for i, eid in enumerate(eids)}
    out_path = Path(args.out)
    with out_path.open('wb') as f:
        f.write(struct.pack('<II', len(eids), 0))
        for eid in eids:
            hop, x, y, score = nodes[eid]
            f.write(struct.pack('<IBfff', eid, hop, x, y, float(score)))
    stats = {
        'nodes_total': len(eids),
        'nodes_hop0': 1,
        'nodes_hop1': len(hop1),
        'nodes_hop2': len(hop2),
        'fan_out_seconds': round(fan_secs, 2),
        'max_neighbors_per_call': args.max_neighbors,
        'min_score': args.min_score,
        'unique_2hop_raw': len(hop2_raw),
    }
    Path(args.out + '.json').write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))
    return 0

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', default='/tmp/john-1hop-ids.txt')
    ap.add_argument('--out', default='/tmp/john-2hop.bin')
    ap.add_argument('--max-neighbors', type=int, default=200)
    ap.add_argument('--min-score', type=int, default=120)
    ap.add_argument('--max-2hop', type=int, default=100_000)
    ap.add_argument('--concurrency', type=int, default=16)
    args = ap.parse_args()
    return asyncio.run(main_async(args))

if __name__ == '__main__':
    sys.exit(main())
