import {
  getOuterRadius,
  NETWORK_SCALE,
  NETWORK_SPACE_CENTRE,
  repackHop2Rings,
} from './network-layout'
import type { LoadedNetwork } from './network-types'
import { variantBase } from './shared'

const BIN_PATH = (): string => `${variantBase()}/john-2hop.bin`
const PER_NODE_BYTES = 1 + 4 + 4 + 4 + 4 // u8 hop, f32 x, f32 y, f32 score, u32 eid
// header is [u32 nodeCount, u32 reserved] = 8 bytes

/**
 * Loads the pre-computed 2-hop network for John. The binary layout matches
 * scripts/fanout-2hop.py:
 *   header [u32 nodeCount, u32 reserved]
 *   per node [u32 eid][u8 hop][f32 x][f32 y][f32 score]
 */
// Largest plausible network size — anything bigger is a sign the response
// isn't a real .bin (most commonly: a 404 HTML page being parsed as if its
// first four bytes were a node count, which yields ~1.3 billion).
const MAX_PLAUSIBLE_NODE_COUNT = 10_000_000

export async function loadNetwork (): Promise<LoadedNetwork | null> {
  try {
    const res = await fetch(BIN_PATH())
    if (!res.ok) {
      console.warn('[neon-network] network bin fetch returned', res.status, 'for', BIN_PATH())
      return null
    }
    // Dev servers serve HTML for unknown paths instead of 404. If the
    // content-type isn't binary, bail out before parsing.
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('html') || ct.includes('text/')) {
      console.warn('[neon-network] network bin returned non-binary content-type:', ct, '— bad ?net= param?')
      return null
    }
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength < 8) {
      console.warn('[neon-network] network bin too short:', buf.byteLength, 'bytes')
      return null
    }
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const n = view.getUint32(0, true)
    if (n > MAX_PLAUSIBLE_NODE_COUNT || n === 0) {
      console.warn('[neon-network] network bin header reports implausible node count:', n)
      return null
    }
    const expectedBytes = 8 + (n * PER_NODE_BYTES)
    if (buf.byteLength < expectedBytes) {
      console.warn('[neon-network] network bin truncated:', buf.byteLength, 'expected', expectedBytes)
      return null
    }
    const positions = new Float32Array(n * 2)
    const eids = new Uint32Array(n)
    const hops = new Uint8Array(n)
    const scores = new Float32Array(n)
    const eidIndex = new Map<number, number>()
    // Demo world is 8192 units; centre is (4096, 4096). The Python layout
    // is centred on (0, 0) with radius up to ~2000, so we scale by 2× and
    // translate to fill the world. Bloom uses DEMO_SPACE_SIZE * 0.49 as
    // OUTER, which needs the data to actually extend that far for the
    // ring-stagger math to match.
    // 2.0 was the original — flush packing. 2.10 cleared overlap.
    // 2.40 gave visible gaps. 2.85 gives generous breathing room
    // between adjacent rings AND between adjacent nodes within a ring,
    // which is what the user keeps asking for.
    let off = 8
    for (let i = 0; i < n; i += 1) {
      const eid = view.getUint32(off, true)
      const hop = view.getUint8(off + 4)
      const x = view.getFloat32(off + 5, true)
      const y = view.getFloat32(off + 9, true)
      const score = view.getFloat32(off + 13, true)
      off += PER_NODE_BYTES
      eids[i] = eid
      hops[i] = hop
      positions[i * 2] = x * NETWORK_SCALE + NETWORK_SPACE_CENTRE
      positions[i * 2 + 1] = y * NETWORK_SCALE + NETWORK_SPACE_CENTRE
      scores[i] = score
      eidIndex.set(eid, i)
    }

    // Re-pack hop-2 nodes into uniformly-dense concentric rings
    // matching hop-1's natural cadence (~100 world units between
    // adjacent nodes in any direction). The upstream Python script
    // packs hop-2 in 18 thin rings of ~55 dots each, which read
    // visually as sparse rays — completely different aspect ratio
    // from hop-1's square-ish packing. Re-binning into fewer rings
    // with more dots-per-ring eliminates that visual gap.
    //
    // Score ordering is preserved: hop-2 nodes are sorted by their
    // original (score-driven) radius, then bucketed into rings inner
    // → outer, so high-score 2-hop contacts still sit closer to
    // John, just at the same density as the inner disc.
    repackHop2Rings(positions, hops, n)
    // Outer radius — the only data-driven number the halo needs.
    // Halo's radial + circumferential spacing are *hardcoded* (see
    // starfield-config.ts); deriving them from this bin's ring
    // cadence overproduces dots, because the Python layout uses many
    // tightly-packed concentric rings rather than one ring-per-band.
    const outerRadius = getOuterRadius(positions, n)
    return { nodeCount: n, positions, eids, hops, scores, eidIndex, outerRadius }
  } catch (err) {
    console.warn('[neon-network] failed to load:', err)
    return null
  }
}
