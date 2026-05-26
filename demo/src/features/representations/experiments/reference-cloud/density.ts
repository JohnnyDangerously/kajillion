import type { ProjectedNode } from './project'

export interface DensityMetrics {
  densityThinnedNodeCount: number;
  densityHiddenNodeCount: number;
  maxScreenBinCoverage: number;
  percentBinsOverCoverageThreshold: number;
}

export function applyDensityBudget (nodes: ProjectedNode[], width: number, height: number): DensityMetrics {
  const bins = buildBins(nodes, width, height)
  for (const node of nodes) {
    node.renderAlpha = 1
    node.renderHidden = false
  }
  return {
    densityThinnedNodeCount: 0,
    densityHiddenNodeCount: 0,
    maxScreenBinCoverage: bins.max,
    percentBinsOverCoverageThreshold: bins.over / Math.max(1, bins.count),
  }
}

function buildBins (nodes: ProjectedNode[], width: number, height: number): {
  cell: number;
  count: number;
  max: number;
  over: number;
  map: Map<string, number>;
} {
  const cell = Math.max(16, Math.min(24, Math.sqrt(width * height) / 58))
  const map = new Map<string, number>()
  for (const node of nodes) {
    const area = Math.PI * node.vr * node.vr
    const key = keyFor(node.sx, node.sy, cell)
    map.set(key, (map.get(key) ?? 0) + area / (cell * cell))
  }
  let max = 0
  let over = 0
  for (const value of map.values()) {
    max = Math.max(max, value)
    if (value > 2.2) over += 1
  }
  return { cell, count: map.size, max, over, map }
}

function keyFor (x: number, y: number, cell: number): string {
  return `${Math.floor(x / cell)}:${Math.floor(y / cell)}`
}
