import { mixedHash01 } from './utils'
import type { GalleryGraphData, LabelAnchor } from './types'

export function talentLabelAnchors (spaceSize: number): LabelAnchor[] {
  const p = (label: string, nx: number, ny: number): LabelAnchor => ({
    label,
    x: spaceSize * nx,
    y: spaceSize * ny,
  })
  return [
    p('Engineering', 0.53, 0.45),
    p('Sales', 0.61, 0.50),
    p('Product', 0.56, 0.39),
    p('Support', 0.48, 0.54),
    p('Ops', 0.64, 0.42),
  ]
}

export function talentScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const cx = spaceSize * 0.56
  const cy = spaceSize * 0.48
  const radius = spaceSize * 0.26
  const groupForNode = new Int32Array(nodeCount)
  groupForNode.fill(0)
  for (let node = 0; node < nodeCount; node += 1) {
    const angle = mixedHash01(node, 510) * Math.PI * 2
    const ring = Math.sqrt(mixedHash01(node, 616))
    const warp = 1 + Math.sin(angle * 5.0) * 0.10
    positions[node * 2] = cx + Math.cos(angle) * radius * ring * warp
    positions[node * 2 + 1] = cy + Math.sin(angle) * radius * ring * (0.92 + Math.cos(angle * 3) * 0.06)
    groupForNode[node] = Math.floor(mixedHash01(node, 812) * 7)
  }
  const links: number[] = []
  const out = { ...data, positions, links: new Float32Array(links), edgeCount: 0 }
  ;(out as GalleryGraphData & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return out
}
