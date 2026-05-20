import { drawEdge, drawField, drawNode } from './canvas-drawing'
import { makeLabNodes } from './nodes'
import type { LabState } from './types'
import { resizeCanvas } from './canvas-space'

export function drawLab (canvas: HTMLCanvasElement, state: LabState): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = resizeCanvas(canvas)
  const width = canvas.width
  const height = canvas.height
  ctx.clearRect(0, 0, width, height)
  drawField(ctx, width, height, dpr)

  const nodes = makeLabNodes(state)
  if (state.scene === 'pair') {
    drawEdge(state, ctx, nodes[0]!, nodes[1]!, width, height, dpr, 1)
  } else if (state.scene === 'cluster') {
    for (let i = 1; i < nodes.length; i += 1) {
      if (i % 2 === 0) drawEdge(state, ctx, nodes[0]!, nodes[i]!, width, height, dpr, 0.35)
      if (i > 4 && i % 5 === 0) drawEdge(state, ctx, nodes[i - 3]!, nodes[i]!, width, height, dpr, 0.22)
    }
  }
  const sorted = nodes.slice().sort((a, b) => a.radius - b.radius)
  for (const node of sorted) drawNode(state, ctx, node, width, height, dpr)
}
