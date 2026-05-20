/**
 * Generates a radial tree (sunburst) layout — the root sits at the center
 * and each depth level radiates outward in concentric rings.
 * Each top-level branch owns a color and an angular wedge.
 */

import { buildHierarchyTreeData } from './hierarchy-tree'

export interface GeneratedData {
  pointPositions: Float32Array;
  pointColors: Float32Array;
  pointSizes: Float32Array;
  links: Float32Array;
  linkColors: Float32Array;
}

export function generateHierarchyData (): GeneratedData {
  const { allNodes, linkDataArray } = buildHierarchyTreeData()

  const pointPositions = new Float32Array(allNodes.length * 2)
  const pointColors = new Float32Array(allNodes.length * 4)
  const pointSizes = new Float32Array(allNodes.length)

  // Larger points closer to root, smaller at leaves
  const sizeByDepth = [24, 18, 14, 10, 8]

  for (const node of allNodes) {
    pointPositions[node.index * 2] = node.x
    pointPositions[node.index * 2 + 1] = node.y
    pointColors[node.index * 4] = node.color[0]
    pointColors[node.index * 4 + 1] = node.color[1]
    pointColors[node.index * 4 + 2] = node.color[2]
    pointColors[node.index * 4 + 3] = node.color[3]
    pointSizes[node.index] = sizeByDepth[node.depth] ?? 5
  }

  const links = new Float32Array(linkDataArray.length * 2)
  const linkColors = new Float32Array(linkDataArray.length * 4)

  let linkIndex = 0
  for (const link of linkDataArray) {
    links[linkIndex * 2] = link.source
    links[linkIndex * 2 + 1] = link.target
    linkColors[linkIndex * 4] = link.color[0]
    linkColors[linkIndex * 4 + 1] = link.color[1]
    linkColors[linkIndex * 4 + 2] = link.color[2]
    linkColors[linkIndex * 4 + 3] = 0.7
    linkIndex++
  }

  return {
    pointPositions,
    pointColors,
    pointSizes,
    links,
    linkColors,
  }
}
