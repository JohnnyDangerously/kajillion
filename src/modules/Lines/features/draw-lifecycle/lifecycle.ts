import type { GraphConfigInterface } from '@/graph/config'

export function getEffectiveLineSegments (config: GraphConfigInterface): number {
  return config.curvedLinks || config.linkBundlingStrength > 0
    ? config.curvedLinkSegments
    : 1
}

export function getEffectiveLinkLodStrength (config: GraphConfigInterface): number {
  return config.renderLodMode === 'exact' ? 0 : config.linkLodStrength
}

export function getHoverPickScissorRect (
  isWebGpu: boolean,
  screenSize: [number, number],
  screenMousePosition: number[],
  padding = 6
): [number, number, number, number] | undefined {
  if (!isWebGpu) return undefined

  const screenWidth = Math.max(0, Math.floor(screenSize[0] ?? 0))
  const screenHeight = Math.max(0, Math.floor(screenSize[1] ?? 0))
  if (!screenWidth || !screenHeight) return undefined

  const mouseX = screenMousePosition[0] ?? 0
  const mouseYFromBottom = screenMousePosition[1] ?? 0
  const mouseY = screenHeight - mouseYFromBottom
  if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) return undefined

  const x = Math.max(0, Math.floor(mouseX) - padding)
  const y = Math.max(0, Math.floor(mouseY) - padding)
  const maxX = Math.min(screenWidth, Math.ceil(mouseX) + padding + 1)
  const maxY = Math.min(screenHeight, Math.ceil(mouseY) + padding + 1)
  return [x, y, Math.max(1, maxX - x), Math.max(1, maxY - y)]
}

export function getActiveLinkMaskSignature (
  linkCount: number,
  activeLinkIndices: number[] | undefined
): string {
  if (activeLinkIndices === undefined) return `all:${linkCount}`

  let hash = 2166136261
  for (const index of activeLinkIndices) {
    hash ^= index >>> 0
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return `filter:${linkCount}:${activeLinkIndices.length}:${hash}`
}

export function writeActiveLinkMask (
  mask: Uint32Array,
  activeLinkIndices: number[] | undefined
): void {
  if (activeLinkIndices === undefined) {
    mask.fill(1)
    return
  }

  const linkCount = mask.length
  for (const index of activeLinkIndices) {
    if (index >= 0 && index < linkCount) mask[index] = 1
  }
}
