import type { Lines } from '@/graph/modules/Lines/renderer/lines'
import {
  createSampledLinksUniforms,
  ensureSampledLinksFramebuffer,
  readSampledLinkRecords,
  renderSampledLinksGrid as renderSampledLinksGridPass,
} from '@/graph/modules/Lines/passes/sampling/sampled-links-renderer'
import { getEffectiveLineSegments } from '@/graph/modules/Lines/features/draw-lifecycle/lifecycle'

export function updateSampledLinksGridFramebuffer (lines: Lines): void {
  const { store: { screenSize }, config: { linkSamplingDistance }, device } = lines
  lines.sampledLinksFbo = ensureSampledLinksFramebuffer({
    device,
    framebuffer: lines.sampledLinksFbo,
    screenSize,
    linkSamplingDistance,
  })
}

export function getSampledLinkPositionsMap (lines: Lines): Map<number, [number, number, number]> {
  const positions = new Map<number, [number, number, number]>()
  if (!lines.sampledLinksFbo || lines.sampledLinksFbo.destroyed) return positions
  const points = lines.points
  if (!points?.currentPositionTexture || points.currentPositionTexture.destroyed) return positions

  renderSampledLinksGrid(lines)

  for (const { index, x, y, angle } of readSampledLinkRecords(lines.device, lines.sampledLinksFbo)) {
    positions.set(index, [x, y, angle])
  }
  return positions
}

export function getSampledLinks (lines: Lines): { indices: number[]; positions: number[]; angles: number[] } {
  const indices: number[] = []
  const positions: number[] = []
  const angles: number[] = []
  if (!lines.sampledLinksFbo || lines.sampledLinksFbo.destroyed) return { indices, positions, angles }
  const points = lines.points
  if (!points?.currentPositionTexture || points.currentPositionTexture.destroyed) return { indices, positions, angles }

  renderSampledLinksGrid(lines)

  for (const { index, x, y, angle } of readSampledLinkRecords(lines.device, lines.sampledLinksFbo)) {
    indices.push(index)
    positions.push(x, y)
    angles.push(angle)
  }
  return { indices, positions, angles }
}

function renderSampledLinksGrid (lines: Lines): void {
  if (!lines.sampledLinksFbo || lines.sampledLinksFbo.destroyed) return
  const points = lines.points
  if (!points?.currentPositionTexture || points.currentPositionTexture.destroyed) return

  renderSampledLinksGridPass({
    device: lines.device,
    framebuffer: lines.sampledLinksFbo,
    command: lines.fillSampledLinksFboCommand,
    uniformStore: lines.fillSampledLinksUniformStore,
    positionsTexture: points.currentPositionTexture,
    linksNumber: lines.data.linksNumber ?? 0,
    uniforms: createSampledLinksUniforms(lines.store, lines.config, getEffectiveLineSegments(lines.config)),
  })
}
