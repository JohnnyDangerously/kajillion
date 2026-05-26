const CACHE_LIMIT = 4

const layoutCache = new Map<string, Float32Array>()

export function readAtlasLayoutCache (key: string): Float32Array | null {
  const cached = layoutCache.get(key)
  if (!cached) return null
  layoutCache.delete(key)
  layoutCache.set(key, cached)
  return new Float32Array(cached)
}

export function writeAtlasLayoutCache (key: string, positions: Float32Array): void {
  layoutCache.set(key, new Float32Array(positions))
  while (layoutCache.size > CACHE_LIMIT) {
    const oldest = layoutCache.keys().next().value
    if (oldest === undefined) break
    layoutCache.delete(oldest)
  }
}
