import { buildEdgesFromBatch, fetchNeighborsBatch } from './csr-client'
import { runForceRelaxation } from './force-relax'
import { buildSatelliteRing } from './satellite-ring'
import { state } from './cache'
import { getRootCenter } from './shared'
import type { NeonNetworkRuntime } from './runtime'
import type { ExplodeLevel } from './view-stack'

export async function loadRealEdgesForExplode (
  rt: NeonNetworkRuntime,
  level: ExplodeLevel,
  signal: AbortSignal,
): Promise<void> {
  const net = state.network
  if (!net) return
  const srcInts = level.members
    .filter(idx => net.hops[idx] !== 0)
    .map(idx => net.eids[idx] as number)
  if (srcInts.length === 0) return
  const batch = await fetchNeighborsBatch(srcInts, 60, signal)
  if (!batch || signal.aborted) return
  if (rt.viewStack.length === 0 || rt.viewStack[rt.viewStack.length - 1] !== level) return
  const clusterEids = new Set(srcInts)
  const edges = buildEdgesFromBatch(batch, net.eidIndex, clusterEids)
  if (edges.length === 0) {
    console.info(`[neon-network] CSR returned 0 within-cluster edges for ${level.value}; keeping synthesised spokes`)
    return
  }
  const ring = buildSatelliteRing(batch, net, clusterEids, getRootCenter(net))
  const combinedEdges = ring.edges.length === 0
    ? edges
    : mergeEdges(edges, ring.edges)
  if (ring.indices.length > 0) liftSatellites(rt, ring)
  console.info(`[neon-network] CSR loaded ${edges.length / 2} within ${level.value} + ${ring.edges.length / 2} satellite edges to ${ring.indices.length} outside neighbours`)
  rt.ctx.graph.setLinks(combinedEdges)
  rt.ctx.graph.render()
  rt.cancelForceRelax?.()
  rt.cancelForceRelax = runForceRelaxation(rt.ctx.graph, {
    edges: combinedEdges,
    anchored: buildAnchoredMask(net, level, ring.indices),
    durationMs: 1400,
  })
}

function mergeEdges (a: Float32Array, b: Float32Array): Float32Array {
  const merged = new Float32Array(a.length + b.length)
  merged.set(a, 0)
  merged.set(b, a.length)
  return merged
}

function liftSatellites (
  rt: NeonNetworkRuntime,
  ring: ReturnType<typeof buildSatelliteRing>,
): void {
  const livePos = rt.ctx.graph.getPointPositions()
  const newPos = new Float32Array(livePos.length)
  for (let i = 0; i < livePos.length; i += 1) newPos[i] = livePos[i] as number
  const liveSize = rt.ctx.graph.getPointSizes()
  const newSize = new Float32Array(liveSize.length)
  for (let i = 0; i < liveSize.length; i += 1) newSize[i] = liveSize[i] as number
  for (let i = 0; i < ring.indices.length; i += 1) {
    const idx = ring.indices[i] as number
    newPos[idx * 2] = ring.positions[i * 2] as number
    newPos[(idx * 2) + 1] = ring.positions[(i * 2) + 1] as number
    newSize[idx] = ring.size
  }
  rt.ctx.graph.setPointPositions(newPos, true)
  rt.ctx.graph.setPointSizes(newSize)
}

function buildAnchoredMask (
  net: NonNullable<typeof state.network>,
  level: ExplodeLevel,
  satellites: number[],
): Uint8Array {
  const anchored = new Uint8Array(net.nodeCount)
  const rootIdx = net.hops.indexOf(0)
  if (rootIdx >= 0) anchored[rootIdx] = 1
  for (const sub of level.subClusters.values()) {
    const best = bestMemberByScore(net.scores, sub.members)
    if (best >= 0) anchored[best] = 1
  }
  for (const idx of satellites) anchored[idx] = 1
  return anchored
}

function bestMemberByScore (scores: Float32Array, members: number[]): number {
  let bestIdx = -1
  let bestScore = -Infinity
  for (const m of members) {
    const s = scores[m] ?? -Infinity
    if (s > bestScore) { bestIdx = m; bestScore = s }
  }
  return bestIdx
}
