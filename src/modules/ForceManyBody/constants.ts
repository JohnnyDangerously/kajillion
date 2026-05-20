export const MAX_LEVEL_TEXTURE_SIZE = 4096

export const FORCE_WORKGROUP_SIZE_X = 8
export const FORCE_WORKGROUP_SIZE_Y = 4

export function getLevelCount (adjustedSpaceSize: number): number {
  const maxLevelTextureSize = Math.max(2, Math.min(adjustedSpaceSize, MAX_LEVEL_TEXTURE_SIZE))
  return Math.log2(maxLevelTextureSize)
}

export function getLevelTextureSize (level: number): number {
  return Math.pow(2, level + 1)
}

export function createForceVertexCoordData (): Float32Array {
  return new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
}
