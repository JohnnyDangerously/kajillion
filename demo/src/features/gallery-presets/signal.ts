import { hash01 } from './utils'
import type { GalleryGraphData } from './types'

export function signalScene<T extends GalleryGraphData> (data: T, spaceSize: number): T {
  const positions = new Float32Array(data.positions.length)
  const nodeCount = data.nodeCount
  const cx = spaceSize / 2
  const cy = spaceSize / 2
  const radius = spaceSize * 0.38
  if (nodeCount === 0) return { ...data, positions, links: new Float32Array(0), edgeCount: 0 }
  const ringCount = Math.max(28, Math.min(72, Math.floor(nodeCount * 0.14)))
  const spokeCount = Math.max(18, Math.min(48, Math.floor(nodeCount * 0.08)))
  const ringNodes: number[] = []
  const spokes: number[][] = Array.from({ length: spokeCount }, () => [])
  for (let i = 0; i < Math.min(ringCount, nodeCount); i += 1) {
    ringNodes.push(i)
    const angle = (i / ringCount) * Math.PI * 2
    const wobble = 1 + Math.sin(angle * 5.0) * 0.025
    positions[i * 2] = cx + Math.cos(angle) * radius * 0.23 * wobble
    positions[i * 2 + 1] = cy + Math.sin(angle) * radius * 0.23 * wobble
  }
  for (let node = ringNodes.length; node < nodeCount; node += 1) {
    const spoke = node % spokeCount
    const ordinal = spokes[spoke]!.length
    spokes[spoke]!.push(node)
    const spokeAngle = (spoke / spokeCount) * Math.PI * 2 + Math.sin(spoke * 4.31) * 0.035
    const row = Math.floor(ordinal / 3)
    const lane = (ordinal % 3) - 1
    const r = 0.31 + Math.min(0.66, row * 0.045 + hash01(node + 51) * 0.05)
    const tangent = spokeAngle + Math.PI / 2
    const laneOffset = lane * radius * (0.008 + row * 0.0015)
    positions[node * 2] = cx + Math.cos(spokeAngle) * radius * r + Math.cos(tangent) * laneOffset
    positions[node * 2 + 1] = cy + Math.sin(spokeAngle) * radius * r + Math.sin(tangent) * laneOffset
  }

  const links: number[] = []
  const addLink = (a: number, b: number): void => {
    if (a === b || a < 0 || b < 0 || a >= nodeCount || b >= nodeCount) return
    links.push(a, b)
  }
  for (let i = 0; i < ringNodes.length; i += 1) {
    addLink(ringNodes[i]!, ringNodes[(i + 1) % ringNodes.length]!)
    if (i % 4 === 0) addLink(ringNodes[i]!, ringNodes[(i + 5) % ringNodes.length]!)
  }
  for (let spoke = 0; spoke < spokes.length; spoke += 1) {
    const nodes = spokes[spoke]!
    const root = ringNodes[Math.floor((spoke / spokeCount) * ringNodes.length) % ringNodes.length] ?? 0
    let previous = root
    for (const [i, node_] of nodes.entries()) {
      const node = node_!
      addLink(previous, node)
      if (i % 3 === 0) addLink(root, node)
      previous = node
    }
    if (spoke % 3 === 0 && nodes.length > 2) {
      const neighbor = spokes[(spoke + 1) % spokes.length]!
      if (neighbor.length > 2) addLink(nodes[Math.floor(nodes.length * 0.64)]!, neighbor[Math.floor(neighbor.length * 0.58)]!)
    }
  }
  return { ...data, positions, links: new Float32Array(links), edgeCount: links.length / 2 }
}
