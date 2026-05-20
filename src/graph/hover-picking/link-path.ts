import type { GraphConfigInterface } from '@/graph/config'
import type { LinkHoverPathCache } from './types'

export function visitLinkHoverPathSegments (
  config: GraphConfigInterface,
  cache: LinkHoverPathCache,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  linkIndex: number,
  visitor: (ax: number, ay: number, bx: number, by: number) => void
): void {
  const tValues = getLinkHoverTValues(config, cache)
  const dx = tx - sx
  const dy = ty - sy
  const linkDist = Math.sqrt(dx * dx + dy * dy)
  const invLinkDist = linkDist > 1e-6 ? 1 / linkDist : 0
  const yBasisX = -dy * invLinkDist
  const yBasisY = dx * invLinkDist
  const isCurved = config.curvedLinks
  const useBundling = !isCurved && config.linkBundlingStrength > 0 && linkDist > 1e-6
  const controlX = (sx + tx) * 0.5 + yBasisX * linkDist * config.curvedLinkControlPointDistance
  const controlY = (sy + ty) * 0.5 + yBasisY * linkDist * config.curvedLinkControlPointDistance
  const curvedWeight = config.curvedLinkWeight
  const bundleCellSize = Math.max(64, config.linkBundlingCellSize)
  const midX = (sx + tx) * 0.5
  const midY = (sy + ty) * 0.5
  const laneCellX = (Math.floor(midX / bundleCellSize) + 0.5) * bundleCellSize
  const laneCellY = (Math.floor(midY / bundleCellSize) + 0.5) * bundleCellSize
  const xDirX = dx * invLinkDist
  const xDirY = dy * invLinkDist
  const laneProjection = (midX - laneCellX) * xDirX + (midY - laneCellY) * xDirY
  const laneTargetX = laneCellX + xDirX * laneProjection
  const laneTargetY = laneCellY + xDirY * laneProjection
  let displacementX = laneTargetX - midX
  let displacementY = laneTargetY - midY
  const displacementLen = Math.sqrt(displacementX * displacementX + displacementY * displacementY)
  const maxNudge = Math.min(bundleCellSize * 0.36, linkDist * 0.18)
  if (displacementLen > maxNudge) {
    const displacementScale = maxNudge / Math.max(displacementLen, 1e-6)
    displacementX *= displacementScale
    displacementY *= displacementScale
  }
  const strand = (hash11(linkIndex + Math.floor(midX / bundleCellSize) * 17 + Math.floor(midY / bundleCellSize) * 131) - 0.5) *
    Math.min(bundleCellSize * 0.025, linkDist * 0.012)

  let previousX = sx
  let previousY = sy
  for (let segment = 1; segment < tValues.length; segment += 1) {
    const t = tValues[segment] ?? 1
    let currentX: number
    let currentY: number
    if (isCurved) {
      const oneMinusT = 1 - t
      const oneMinusTSq = oneMinusT * oneMinusT
      const tSq = t * t
      const weightedT = 2 * oneMinusT * t * curvedWeight
      const divisor = oneMinusTSq + weightedT + tSq
      currentX = (oneMinusTSq * sx + weightedT * controlX + tSq * tx) / divisor
      currentY = (oneMinusTSq * sy + weightedT * controlY + tSq * ty) / divisor
    } else {
      currentX = sx + dx * t
      currentY = sy + dy * t
      if (useBundling) {
        const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * Math.max(0, Math.min(1, t)))), 1.35)
        currentX += (displacementX * config.linkBundlingStrength + yBasisX * strand) * envelope
        currentY += (displacementY * config.linkBundlingStrength + yBasisY * strand) * envelope
      }
    }
    visitor(previousX, previousY, currentX, currentY)
    previousX = currentX
    previousY = currentY
  }
}

export function distanceToLinkHoverPathScreenSquared (
  config: GraphConfigInterface,
  cache: LinkHoverPathCache,
  px: number,
  py: number,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  linkIndex: number,
  transformX: number,
  transformY: number,
  k: number,
  offsetX: number,
  offsetY: number,
  spaceSize: number
): number {
  let bestDistanceSq = Infinity
  visitLinkHoverPathSegments(config, cache, sx, sy, tx, ty, linkIndex, (ax, ay, bx, by) => {
    const x1 = transformX + (offsetX + ax) * k
    const y1 = transformY + (offsetY + spaceSize - ay) * k
    const x2 = transformX + (offsetX + bx) * k
    const y2 = transformY + (offsetY + spaceSize - by) * k
    const distanceSq = distanceToScreenSegmentSquared(px, py, x1, y1, x2, y2)
    if (distanceSq < bestDistanceSq) bestDistanceSq = distanceSq
  })
  return bestDistanceSq
}

function getLinkHoverSegmentCount (config: GraphConfigInterface): number {
  return config.curvedLinks || config.linkBundlingStrength > 0
    ? Math.max(1, Math.ceil(config.curvedLinkSegments))
    : 1
}

function getLinkHoverTValues (config: GraphConfigInterface, cache: LinkHoverPathCache): Float32Array {
  const segments = getLinkHoverSegmentCount(config)
  if (cache.tValues && cache.tValuesSegments === segments) return cache.tValues
  const values = new Float32Array(segments + 1)
  for (let i = 0; i < segments; i += 1) {
    const d = -0.5 + i / segments
    const u = d * 2
    const signedPow = u < 0 ? -(u * u) : u * u
    values[i] = (signedPow + 1) / 2
  }
  values[segments] = 1
  cache.tValues = values
  cache.tValuesSegments = segments
  return values
}

function hash11 (value: number): number {
  const x = Math.fround(Math.sin(Math.fround(value * 12.9898)) * 43758.5453)
  return Math.fround(x - Math.floor(x))
}

function distanceToScreenSegmentSquared (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    const ox = px - x1
    const oy = py - y1
    return ox * ox + oy * oy
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  const ox = px - cx
  const oy = py - cy
  return ox * ox + oy * oy
}
