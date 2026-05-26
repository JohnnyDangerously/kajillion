import { buildHueLookup } from './color-modes'
import { buildTargetAttributes, state } from './cache'
import type { HubPlacement } from './network-view'

let liveGraph: { getPointColors?: () => Float32Array; getPointSizes?: () => Float32Array } | null = null
export function exposeNeonGraph (g: typeof liveGraph): void { liveGraph = g }

export interface NeonDevHooks {
  enterExplode: (idx: number) => void;
  exitToAtlas: () => void;
  enterPersonalNetwork: (idx: number) => Promise<void>;
}

export function installNeonDevHooks (hooks: NeonDevHooks): void {
  const w = window as unknown as {
    __neonExplode?: (i: number) => void;
    __neonExitFocus?: () => void;
    __neonPersonal?: (i: number) => void;
    __neonPortrait?: (hubValue: string) => void;
    __neonDebug?: () => unknown;
  }
  w.__neonExplode = hooks.enterExplode
  w.__neonExitFocus = hooks.exitToAtlas
  w.__neonPersonal = (idx: number) => {
    hooks.enterPersonalNetwork(idx).catch(logAbortable('personal hook failed'))
  }
  w.__neonPortrait = (hubValue: string) => {
    const labels = Array.from(document.querySelectorAll<HTMLElement>('[data-node-explorer="hub-label"]'))
    labels.find(el => (el.textContent ?? '').startsWith(hubValue))?.click()
  }
  // Snapshot of internal state for the verification harness. Returns
  // colorMode, facet presence, and the hue of the first 8 nodes under
  // each non-hue mode so we can tell if the palette is actually
  // varying. Cheap, side-effect-free.
  w.__neonDebug = () => {
    const net = state.network
    if (!net) return { ready: false }
    const facetsLoaded = state.facets ? Object.keys(state.facets).filter((k) => k !== 'hasAny') : []
    const sampleHues: Record<string, number[]> = {}
    if (state.facets) {
      for (const mode of ['markets', 'levels', 'functions', 'industries', 'companies'] as const) {
        const lookup = buildHueLookup(mode, net.eids, state.facets)
        sampleHues[mode] = Array.from({ length: 8 }, (_, i) => Math.round(lookup(i)))
      }
    }
    const facetCardinality = state.facets ? {
      markets: countUnique(state.facets.markets),
      levels: countUnique(state.facets.levels),
      functions: countUnique(state.facets.functions),
      industries: countUnique(state.facets.industries),
      companies: countUnique(state.facets.companies),
    } : null
    // Dump the first 12 nodes' RGBA from buildTargetAttributes —
    // tells us what colors would be uploaded right now under the
    // current colorMode + facets. If these are varied (red/yellow/
    // blue) but the canvas reads as monochrome blue, the upload path
    // is the bug, not the styling.
    const built = buildTargetAttributes(net.nodeCount)
    const sampleColors: Array<[number, number, number, number]> = []
    const sampleSizes: number[] = []
    for (let i = 0; i < 12; i += 1) {
      const ci = i * 4
      sampleColors.push([
        Number((built.colors[ci] as number).toFixed(3)),
        Number((built.colors[ci + 1] as number).toFixed(3)),
        Number((built.colors[ci + 2] as number).toFixed(3)),
        Number((built.colors[ci + 3] as number).toFixed(3)),
      ])
      sampleSizes.push(Number((built.sizes[i] as number).toFixed(2)))
    }
    // Live samples from the actual GPU buffer (what's being rendered).
    let liveColors: Array<[number, number, number, number]> | null = null
    let liveSizes: number[] | null = null
    let uniqueColorCount = 0
    if (liveGraph?.getPointColors && liveGraph?.getPointSizes) {
      const lc = liveGraph.getPointColors()
      const ls = liveGraph.getPointSizes()
      const totalPoints = lc.length / 4
      const uniq = new Set<string>()
      for (let i = 0; i < totalPoints; i += 1) {
        const ci = i * 4
        const key = `${Math.round((lc[ci] as number) * 100)}-${Math.round((lc[ci + 1] as number) * 100)}-${Math.round((lc[ci + 2] as number) * 100)}`
        uniq.add(key)
      }
      uniqueColorCount = uniq.size
      liveColors = []
      liveSizes = []
      // Sample across the array — first 4, middle 4, last 4.
      const indices = [0, 1, 2, 3, Math.floor(totalPoints / 2), Math.floor(totalPoints / 2) + 1, totalPoints - 3, totalPoints - 2, totalPoints - 1]
      for (const i of indices) {
        if (i >= totalPoints) continue
        const ci = i * 4
        liveColors.push([
          Number((lc[ci] as number).toFixed(3)),
          Number((lc[ci + 1] as number).toFixed(3)),
          Number((lc[ci + 2] as number).toFixed(3)),
          Number((lc[ci + 3] as number).toFixed(3)),
        ])
        liveSizes.push(Number((ls[i] as number).toFixed(2)))
      }
    }
    return {
      ready: true,
      colorMode: state.colorMode,
      facetsLoaded,
      facetCardinality,
      sampleHues,
      sampleColors,
      sampleSizes,
      liveColors,
      liveSizes,
      uniqueColorCount,
      nodeCount: net.nodeCount,
    }
  }
}

function countUnique (arr: (string | null)[]): number {
  const s = new Set<string>()
  for (const v of arr) if (v) s.add(v)
  return s.size
}

export function clearNeonDevHooks (): void {
  const w = window as unknown as {
    __neonExplode?: unknown; __neonExitFocus?: unknown;
    __neonPortrait?: unknown; __neonPersonal?: unknown;
  }
  delete w.__neonExplode
  delete w.__neonExitFocus
  delete w.__neonPortrait
  delete w.__neonPersonal
}

export function logAbortable (label: string): (err: unknown) => void {
  return (err: unknown) => {
    if ((err as Error).name !== 'AbortError') console.warn(`[neon-network] ${label}:`, err)
  }
}

export type HubClick = (hub: HubPlacement) => Promise<void>
