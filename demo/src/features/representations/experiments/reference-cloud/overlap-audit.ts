import type { ProjectedNode } from './project'

export function countFullNodeOverlaps (nodes: ProjectedNode[]): number {
  const grid = new Map<string, ProjectedNode[]>()
  let overlaps = 0
  for (const node of nodes) {
    if (node.renderMode !== 'full' || node.vr < 0.7) continue
    for (const other of nearby(grid, node)) {
      if (Math.hypot(node.sx - other.sx, node.sy - other.sy) < node.vr + other.vr - 0.05) overlaps += 1
    }
    const key = cellKey(node.sx, node.sy)
    const list = grid.get(key) ?? []
    list.push(node)
    grid.set(key, list)
  }
  return overlaps
}

function * nearby (grid: Map<string, ProjectedNode[]>, node: ProjectedNode): Generator<ProjectedNode> {
  const x = Math.floor(node.sx / 32)
  const y = Math.floor(node.sy / 32)
  for (let yy = y - 1; yy <= y + 1; yy += 1) {
    for (let xx = x - 1; xx <= x + 1; xx += 1) {
      const list = grid.get(`${xx}:${yy}`)
      if (!list) continue
      for (const other of list) yield other
    }
  }
}

function cellKey (x: number, y: number): string {
  return `${Math.floor(x / 32)}:${Math.floor(y / 32)}`
}
