const NODE_MODULES_MARKER = '/node_modules/'

function packageNameFromId (id: string): string | null {
  const normalized = id.replaceAll('\\', '/')
  const markerIndex = normalized.lastIndexOf(NODE_MODULES_MARKER)
  if (markerIndex === -1) return null

  const packagePath = normalized.slice(markerIndex + NODE_MODULES_MARKER.length)
  const [first, second] = packagePath.split('/')
  if (!first) return null
  return first.startsWith('@') && second ? `${first}/${second}` : first
}

export function kajillionManualChunks (id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/')
  const packageName = packageNameFromId(id)
  if (!packageName) {
    if (normalized.includes('/demo/src/cosmic-intro/')) return 'demo-cosmic'
    if (normalized.includes('/demo/src/features/gallery-presets/')) return 'demo-gallery'
    if (normalized.includes('/demo/src/features/')) return 'demo-features'
    if (normalized.includes('/benchmarks/src/cosmo/')) return 'bench-cosmo'
    if (normalized.includes('/src/modules/Points/')) return 'graph-points'
    if (normalized.includes('/src/modules/Lines/')) return 'graph-lines'
    if (normalized.includes('/src/modules/Force')) return 'graph-forces'
    if (normalized.includes('/src/modules/Clusters/')) return 'graph-clusters'
    if (normalized.includes('/src/modules/')) return 'graph-modules'
    if (normalized.includes('/src/graph/')) return 'graph-runtime'
    if (normalized.includes('/src/render/')) return 'graph-render'
    return undefined
  }

  if (packageName.startsWith('@luma.gl/')) return 'vendor-luma'
  if (packageName.startsWith('d3-')) return 'vendor-d3'
  if (packageName === 'three') return 'vendor-three'
  if (packageName === 'gl-matrix' || packageName === 'random') return 'vendor-math'
  if (packageName === 'dompurify' || packageName === 'gl-bench') return 'vendor-tools'

  return 'vendor'
}
