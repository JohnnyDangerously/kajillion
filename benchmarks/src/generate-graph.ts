// Deterministic Barabási–Albert preferential-attachment graph generator.
// Produces a power-law degree distribution; good proxy for social and
// citation networks. Same seed always yields the same graph.

function lcg (seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0
    return s / 0x100000000
  }
}

export interface GeneratedGraph {
  positions: Float32Array;
  links: Float32Array;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Generate a Barabási–Albert preferential-attachment graph.
 * Each new node attaches to `m` existing nodes with probability proportional
 * to their degree. The resulting degree distribution is approximately
 * P(k) ~ k^-3, matching observed social-network structure.
 *
 * Initial positions are uniform in [-0.5, 0.5]^2; the force simulation
 * arranges them after load.
 */
export function generateBA (nodeCount: number, m = 3, seed = 42): GeneratedGraph {
  if (m < 1) throw new Error('m must be >= 1')
  if (nodeCount <= m) throw new Error('nodeCount must be > m')

  const rng = lcg(seed)
  const linkBuffer: number[] = []
  const nodePool: number[] = []

  // Seed graph: m+1 nodes fully connected (so each has degree m).
  for (let i = 0; i <= m; i += 1) {
    for (let j = i + 1; j <= m; j += 1) {
      linkBuffer.push(i, j)
      nodePool.push(i, j)
    }
  }

  // Add remaining nodes. Each picks `m` distinct targets from nodePool;
  // because each existing node appears (degree)-many times in the pool,
  // sampling uniformly from the pool is preferential-attachment sampling.
  const chosen = new Set<number>()
  for (let i = m + 1; i < nodeCount; i += 1) {
    chosen.clear()
    while (chosen.size < m) {
      const idx = Math.floor(rng() * nodePool.length)
      chosen.add(nodePool[idx] as number)
    }
    for (const target of chosen) {
      linkBuffer.push(target, i)
      nodePool.push(target, i)
    }
  }

  const positions = new Float32Array(nodeCount * 2)
  for (let i = 0; i < nodeCount; i += 1) {
    positions[i * 2] = rng() - 0.5
    positions[i * 2 + 1] = rng() - 0.5
  }

  return {
    positions,
    links: new Float32Array(linkBuffer),
    nodeCount,
    edgeCount: linkBuffer.length / 2,
  }
}
