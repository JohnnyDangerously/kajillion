// Port of the cosmo-lab community-structured graph generator, stripped
// to just the topology + initial positions kajillion's engine consumes.
// Source of truth: tokyo-graph-tools/ui-simple/src/features/cosmo-lab/
// generate.ts (function `generateCosmoLabGraph`). When that file changes
// in cosmo-lab, mirror the changes here so bench data stays comparable.

import { type GeneratedGraph } from './generate-graph'
import { clampPositionsToWorld, createCommunityOrigins, fillCommunityPositions } from './cosmo/layout'
import { generateCommunityLinks } from './cosmo/links'
import { skewedPartition } from './cosmo/partition'
import { mulberry32 } from './cosmo/random'
import type { CosmoLabOptions } from './cosmo/types'

export type { CosmoLabOptions } from './cosmo/types'

export function generateCosmoLab (opts: CosmoLabOptions): GeneratedGraph {
  const count = Math.max(1, Math.floor(opts.count))
  const communityCount = readCommunityCount(count, opts.communityCount)
  const intraDensity = opts.intraDensity ?? 1.2
  const bridgeFraction = opts.bridgeFraction ?? 0.02
  const layoutStyle = opts.layoutStyle ?? 'cosmo'
  const rng = mulberry32(opts.seed ?? 0xc05_03)
  const communitySizes = skewedPartition(count, communityCount, rng)
  const baseRadius = Math.max(800, Math.sqrt(count) * 6)
  const communityOrigins = createCommunityOrigins(communityCount, baseRadius)
  const positions = new Float32Array(count * 2)
  const communityRanges = fillCommunityPositions(
    positions,
    communitySizes,
    communityOrigins,
    baseRadius,
    layoutStyle,
    rng,
  )
  clampPositionsToWorld(positions, count)

  const links = generateCommunityLinks(
    count,
    communitySizes,
    communityRanges,
    intraDensity,
    bridgeFraction,
    rng,
  )
  return {
    positions,
    links: new Float32Array(links),
    nodeCount: count,
    edgeCount: links.length / 2,
  }
}

function readCommunityCount (count: number, communityCount: number | undefined): number {
  const defaultCommunityCount = Math.max(8, Math.min(20, Math.round(Math.log2(count) - 3)))
  return Math.max(2, Math.floor(communityCount ?? defaultCommunityCount))
}
