import type { DemoConfig } from '../../../control-plane/types'
import type { VisualAttributes } from '../../../ui-state/visual-attributes'
import type { RepresentationVisualData } from '../../types'
import {
  ATLAS_COLORS,
  atlasGroupForNode,
  atlasHash,
  atlasSizeForNode,
  atlasTierForNode,
} from './metrics'

export function applyAtlasReferenceAttributes (
  data: RepresentationVisualData,
  attributes: VisualAttributes,
  cfg: DemoConfig,
): void {
  const seed = cfg.seed || 1
  const { pointColors, pointShapes, pointSizes, linkColors, linkWidths } = attributes
  const useBakedOverlay = data.nodeCount >= 50000
  for (let i = 0; i < data.nodeCount; i += 1) {
    if (i === 0 || useBakedOverlay) {
      pointSizes[i] = 0
      pointColors[i * 4 + 3] = 0
      continue
    }
    const group = atlasGroupForNode(i, data.nodeCount, seed)
    const base = ATLAS_COLORS[group % ATLAS_COLORS.length]!
    const tier = Math.max(0, atlasTierForNode(i, seed))
    const sparkle = atlasHash(i * 101, seed)
    const brightness = 0.92 + tier * 0.045 + sparkle * 0.26
    pointColors[i * 4] = clamp(base[0] * brightness + (tier > 11 ? 0.08 : 0))
    pointColors[i * 4 + 1] = clamp(base[1] * brightness + (tier > 12 ? 0.08 : 0))
    pointColors[i * 4 + 2] = clamp(base[2] * brightness + (tier > 10 ? 0.07 : 0))
    pointColors[i * 4 + 3] = 1
    pointSizes[i] = atlasSizeForNode(i, seed)
    pointShapes[i] = 0
  }
  for (let edge = 0; edge < data.edgeCount; edge += 1) {
    const a = data.links[edge * 2] ?? -1
    const b = data.links[edge * 2 + 1] ?? -1
    const rootEdge = a <= 0 || b <= 0
    const alpha = rootEdge ? 0 : 0.20 + atlasHash(edge * 11, seed) * 0.16
    linkWidths[edge] = rootEdge || useBakedOverlay ? 0 : 0.26 + atlasHash(edge * 7, seed) * 0.34
    linkColors[edge * 4] = 0.10
    linkColors[edge * 4 + 1] = 0.22
    linkColors[edge * 4 + 2] = 0.30
    linkColors[edge * 4 + 3] = useBakedOverlay ? 0 : alpha
  }
}

function clamp (v: number): number {
  return Math.max(0, Math.min(1, v))
}
