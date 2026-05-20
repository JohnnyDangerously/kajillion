import { type GraphConfig } from '@kajillion/graph'

export interface BenchParams {
  nodeCount: number;
  edgesPerNode: number;
  seed: number;
  dataMode: 'ba' | 'cosmo';
  warmupMs: number;
  measureMs: number;
  pixelRatio: number | undefined;
  label: string | undefined;
  repeat: number;
  zoomLevel: number | undefined;
  linkBlendMode: 'normal' | 'add';
  linkOpacity: number | undefined;
  renderLinks: boolean;
  continuousRender: boolean;
  pointDefaultSize: number | undefined;
  linkDefaultWidth: number | undefined;
  pointMinPixelSize: number | undefined;
  pointLodStrength: number | undefined;
  activePointFraction: number | undefined;
  impostorMassRadiusScale: number | undefined;
  impostorMassThreshold: number | undefined;
  impostorMassMaxAlpha: number | undefined;
  impostorMassColorBoost: number | undefined;
  impostorMassExtrusion: number | undefined;
  linkMinPixelLength: number | undefined;
  renderLodMode: GraphConfig['renderLodMode'] | undefined;
  useWebGPU: boolean;
  nosim: boolean;
  adaptiveDpr: boolean | undefined;
  msaa: 1 | 4;
  linkWidthScale: number | undefined;
  frameRateLimit: number | undefined;
  frameRateHeadroomFps: number | undefined;
}

function parseNum (raw: string | null, fallback: number, paramName: string): number {
  if (raw === null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    console.warn(`[bench] '${paramName}=${raw}' is not a finite number; using default ${fallback}`)
    return fallback
  }
  return n
}

function parseOptionalNum (raw: string | null, paramName: string): number | undefined {
  if (raw === null || raw === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    console.warn(`[bench] '${paramName}=${raw}' is not a finite number; ignoring`)
    return undefined
  }
  return n
}

export function readParams (): BenchParams {
  const u = new URL(window.location.href)
  const p = u.searchParams
  const label = p.get('label')
  const dataMode = p.get('data') === 'cosmo' ? 'cosmo' : 'ba'
  const adaptiveDprRaw = p.get('adaptiveDpr')
  const adaptiveDpr =
    adaptiveDprRaw === '1' || adaptiveDprRaw === 'true'
      ? true
      : adaptiveDprRaw === '0' || adaptiveDprRaw === 'false'
        ? false
        : undefined
  return {
    nodeCount: parseNum(p.get('n'), 100000, 'n'),
    edgesPerNode: parseNum(p.get('m'), 3, 'm'),
    seed: parseNum(p.get('seed'), 42, 'seed'),
    dataMode,
    warmupMs: parseNum(p.get('warmup'), 2000, 'warmup'),
    measureMs: parseNum(p.get('measure'), 8000, 'measure'),
    pixelRatio: parseOptionalNum(p.get('pixelRatio'), 'pixelRatio'),
    label: label === null || label === '' ? undefined : label,
    repeat: Math.max(1, parseNum(p.get('repeat'), 1, 'repeat')),
    zoomLevel: parseOptionalNum(p.get('zoomLevel'), 'zoomLevel'),
    linkBlendMode: p.get('linkBlendMode') === 'add' ? 'add' : 'normal',
    linkOpacity: parseOptionalNum(p.get('linkOpacity'), 'linkOpacity'),
    renderLinks: p.get('renderLinks') !== '0' && p.get('renderLinks') !== 'false',
    continuousRender: p.get('continuousRender') === '1' || p.get('continuousRender') === 'true',
    pointDefaultSize: parseOptionalNum(p.get('pointDefaultSize'), 'pointDefaultSize'),
    linkDefaultWidth: parseOptionalNum(p.get('linkDefaultWidth'), 'linkDefaultWidth'),
    pointMinPixelSize: parseOptionalNum(p.get('pointMinPixelSize'), 'pointMinPixelSize'),
    pointLodStrength: parseOptionalNum(p.get('pointLodStrength'), 'pointLodStrength'),
    activePointFraction: parseOptionalNum(p.get('activePointFraction'), 'activePointFraction'),
    impostorMassRadiusScale: parseOptionalNum(p.get('impostorMassRadiusScale'), 'impostorMassRadiusScale'),
    impostorMassThreshold: parseOptionalNum(p.get('impostorMassThreshold'), 'impostorMassThreshold'),
    impostorMassMaxAlpha: parseOptionalNum(p.get('impostorMassMaxAlpha'), 'impostorMassMaxAlpha'),
    impostorMassColorBoost: parseOptionalNum(p.get('impostorMassColorBoost'), 'impostorMassColorBoost'),
    impostorMassExtrusion: parseOptionalNum(p.get('impostorMassExtrusion'), 'impostorMassExtrusion'),
    linkMinPixelLength: parseOptionalNum(p.get('linkMinPixelLength'), 'linkMinPixelLength'),
    renderLodMode: (
      p.get('renderLodMode') === 'auto' ||
      p.get('renderLodMode') === 'impostor' ||
      p.get('renderLodMode') === 'phantom' ||
      p.get('renderLodMode') === 'exact'
    ) ? p.get('renderLodMode') as GraphConfig['renderLodMode'] : undefined,
    useWebGPU: p.get('useWebGPU') === '1' || p.get('useWebGPU') === 'true',
    nosim: p.get('nosim') === '1' || p.get('nosim') === 'true',
    adaptiveDpr,
    msaa: p.get('msaa') === '4' ? 4 : 1,
    linkWidthScale: parseOptionalNum(p.get('linkWidthScale'), 'linkWidthScale'),
    frameRateLimit: parseOptionalNum(p.get('frameRateLimit') ?? p.get('fpsCap'), 'frameRateLimit'),
    frameRateHeadroomFps: parseOptionalNum(p.get('frameRateHeadroomFps') ?? p.get('fpsHeadroom'), 'frameRateHeadroomFps'),
  }
}

export function makeActivePointIndices (nodeCount: number, fraction: number | undefined): number[] | undefined {
  if (fraction === undefined) return undefined
  const clamped = Math.max(0, Math.min(1, fraction))
  if (clamped <= 0 || clamped >= 1) return undefined
  const indices: number[] = []
  const threshold = Math.floor(clamped * 0xffffffff)
  for (let i = 0; i < nodeCount; i += 1) {
    let x = (i + 1) >>> 0
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0
    x = (x ^ (x >>> 16)) >>> 0
    if (x <= threshold) indices.push(i)
  }
  return indices
}
