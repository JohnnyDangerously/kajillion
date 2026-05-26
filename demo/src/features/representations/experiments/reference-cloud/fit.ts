import { projectNode } from './project'
import type { CloudView } from './types'

export function fitReferenceCloudView (view: CloudView): void {
  const scene = view.scene
  if (!scene || !view.autoFit) return
  const oldScale = view.scale
  const oldPanX = view.panX
  const oldPanY = view.panY
  view.scale = 1
  view.panX = 0
  view.panY = 0
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  for (const node of scene.nodes) {
    const p = projectNode(node, view.width, view.height, view.scale, 0, 0, view.roll, view.yaw, view.pitch)
    box.minX = Math.min(box.minX, p.sx - p.pr)
    box.maxX = Math.max(box.maxX, p.sx + p.pr)
    box.minY = Math.min(box.minY, p.sy - p.pr)
    box.maxY = Math.max(box.maxY, p.sy + p.pr)
  }
  const widthFit = (view.width * 0.88) / Math.max(1, box.maxX - box.minX)
  const heightFit = (view.height * 0.84) / Math.max(1, box.maxY - box.minY)
  view.scale = clamp(Math.min(widthFit, heightFit), 0.38, 1.72)
  view.panX = -(((box.minX + box.maxX) * 0.5) - view.width * 0.5) * view.scale
  view.panY = -(((box.minY + box.maxY) * 0.5) - view.height * 0.52) * view.scale
  if (!Number.isFinite(view.scale)) {
    view.scale = oldScale
    view.panX = oldPanX
    view.panY = oldPanY
  }
}

function clamp (value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
