import { defaultConfigValues } from '@/graph/config/defaults'

/**
 * Applies WebGL texture limits to configured graph space size while preserving
 * the Store-level warning and fallback behavior.
 */
export function getAdjustedSpaceSize (configSpaceSize: number, webglMaxTextureSize: number): number {
  if (configSpaceSize <= 0 || !isFinite(configSpaceSize)) {
    console.error(`Invalid spaceSize value: ${configSpaceSize}. Using default value of ${defaultConfigValues.spaceSize}`)
    configSpaceSize = defaultConfigValues.spaceSize
  }

  const minSpaceSize = 2
  if (configSpaceSize < minSpaceSize) {
    console.warn(`spaceSize (${configSpaceSize}) is too small. Using minimum value of ${minSpaceSize}`)
    configSpaceSize = minSpaceSize
  }

  if (!Number.isFinite(webglMaxTextureSize) || webglMaxTextureSize <= 0 || webglMaxTextureSize < minSpaceSize) {
    console.warn(`Invalid webglMaxTextureSize: ${webglMaxTextureSize}. Using configSpaceSize without WebGL limit adjustment.`)
    return configSpaceSize
  }

  if (configSpaceSize > webglMaxTextureSize) {
    const adjustedSpaceSize = Math.max(webglMaxTextureSize / 2, minSpaceSize)
    console.warn(`The \`spaceSize\` has been reduced to ${adjustedSpaceSize} due to WebGL limits`)
    return adjustedSpaceSize
  }

  return configSpaceSize
}
