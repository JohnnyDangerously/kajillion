import type { GeneratedGraph } from '../../generate-graph'

export function findNearestPointIndex (data: GeneratedGraph, nx: number, ny: number, spaceSize: number): number {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < data.nodeCount; i += 1) {
    const x = data.positions[i * 2] ?? spaceSize / 2
    const y = data.positions[i * 2 + 1] ?? spaceSize / 2
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const targetX = minX + (maxX - minX) * nx
  const targetY = minY + (maxY - minY) * ny
  let bestIndex = 0
  let bestDistanceSq = Infinity
  for (let i = 0; i < data.nodeCount; i += 1) {
    const x = data.positions[i * 2] ?? targetX
    const y = data.positions[i * 2 + 1] ?? targetY
    const dx = x - targetX
    const dy = y - targetY
    const distanceSq = dx * dx + dy * dy
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq
      bestIndex = i
    }
  }
  return bestIndex
}

export function pointPositionForIndex (data: GeneratedGraph, index: number, spaceSize: number): Float32Array {
  const i = Math.max(0, Math.min(data.nodeCount - 1, index))
  return new Float32Array([
    data.positions[i * 2] ?? spaceSize / 2,
    data.positions[i * 2 + 1] ?? spaceSize / 2,
  ])
}

export function dispatchMouseMoveInGraph (graphHost: HTMLElement, x: number, y: number): void {
  const canvas = graphHost.querySelector('canvas')
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  canvas.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + x,
    clientY: rect.top + y,
  }))
}
