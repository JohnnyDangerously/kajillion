import { Graph, type GraphConfig, type GpuTimingSnapshot } from '@kajillion/graph'
import { encodeBaked, decodeBaked } from './baked-format'
import { generateBA, type GeneratedGraph } from './generate-graph'
import {
  buildDefaultViewSpec,
  generatedGraphToSnapshot,
  graphFrameFromSnapshot,
  graphFrameToVisibleGeneratedGraph,
  type GraphFrame,
  type GraphFrameVisibilityFilter,
  type GraphSnapshot,
  type RenderableGraphData,
  type ViewSpec,
} from './graph-contract'
import {
  createVisualLabControlPlane,
  type GraphInteractionSummary,
  type NeighborhoodExpansion,
  type NodeFilterOptions,
  type NodeFocusOptions,
  type VisualLabControlPlane,
} from './visual-lab-control-plane'
import {
  type GalleryPalette,
  displayPaletteColor,
  fintechLabelAnchors,
  galleryPresetUrlDefaults,
  galleryRenderData,
  galleryLinkColor,
  galleryParticleColor,
  influenceLabelAnchors,
  isGalleryPalette,
  parsePaletteParam,
  talentLabelAnchors,
} from './gallery-presets'
import './gallery-presets.css'
import { generateCosmoLab } from '../../benchmarks/src/generate-cosmo'

interface DemoConfig {
  n: number;
  dataMode: 'cosmo' | 'ba' | 'work';
  seed: number;
  webgpu: boolean;
  msaa: boolean;
  adaptiveDpr: boolean;
  theme: 'dark' | 'light';
  palette: GalleryPalette;
  blend: 'add' | 'normal';
  sim: boolean;
  renderLinks: boolean;
  density: boolean;
  lod: boolean;
  lanes: boolean;
  massConserve: boolean;
  debugFrameTrace: boolean;
  frameRateLimit: number;
  frameRateHeadroomFps: number;
}

type GpuStat = {
  avgMs?: number;
  lastMs?: number;
  sampleCount?: number;
  median?: number;
  min?: number;
  max?: number;
  samples?: number | unknown[];
}

const SOURCE_SPACE_SIZE = 4096
const DEMO_SPACE_SIZE = 8192
const DEMO_CONTENT_SCALE = 1.25
const WORK_GROUPS = [
  { label: 'Revenue', angle: -2.72, radius: 2100, color: 0 },
  { label: 'Marketing', angle: -1.92, radius: 1980, color: 7 },
  { label: 'Success', angle: -0.93, radius: 2060, color: 1 },
  { label: 'Product', angle: -0.04, radius: 2160, color: 5 },
  { label: 'Operations', angle: 0.93, radius: 1920, color: 2 },
  { label: 'Finance', angle: 1.84, radius: 1980, color: 3 },
  { label: 'Partners', angle: 2.68, radius: 2120, color: 4 },
]

const overlayEl = {
  metaN: document.getElementById('meta-n') as HTMLElement,
  wall: document.getElementById('m-wall') as HTMLElement,
  render: document.getElementById('m-render') as HTMLElement,
  budget: document.getElementById('m-budget') as HTMLElement,
  display: document.getElementById('m-display') as HTMLElement,
  target: document.getElementById('m-target') as HTMLElement,
  skip: document.getElementById('m-skip') as HTMLElement,
  cap: document.getElementById('m-cap') as HTMLElement,
  quad: document.getElementById('m-quad') as HTMLElement,
  rep: document.getElementById('m-rep') as HTMLElement,
  link: document.getElementById('m-link') as HTMLElement,
  grav: document.getElementById('m-grav') as HTMLElement,
  canvas: document.getElementById('m-canvas') as HTMLElement,
  linesCull: document.getElementById('m-lines-cull') as HTMLElement,
  lines: document.getElementById('m-lines') as HTMLElement,
  pointsCull: document.getElementById('m-points-cull') as HTMLElement,
  points: document.getElementById('m-points') as HTMLElement,
  alpha: document.getElementById('m-alpha') as HTMLElement,
  dpr: document.getElementById('m-dpr') as HTMLElement,
}

const ctlEl = {
  n: document.getElementById('c-n') as HTMLSelectElement,
  nButtons: [...document.querySelectorAll<HTMLButtonElement>('#n-buttons button')],
  data: document.getElementById('c-data') as HTMLSelectElement,
  seed: document.getElementById('c-seed') as HTMLInputElement,
  webgpu: document.getElementById('c-webgpu') as HTMLInputElement,
  msaa: document.getElementById('c-msaa') as HTMLInputElement,
  adpr: document.getElementById('c-adpr') as HTMLInputElement,
  blend: document.getElementById('c-blend') as HTMLSelectElement,
  frameCap: document.getElementById('c-frame-cap') as HTMLSelectElement,
  theme: document.getElementById('btn-theme') as HTMLButtonElement,
  density: document.getElementById('btn-density') as HTMLButtonElement,
  edges: document.getElementById('btn-edges') as HTMLButtonElement,
  lod: document.getElementById('btn-lod') as HTMLButtonElement,
  lanes: document.getElementById('btn-lanes') as HTMLButtonElement,
  modeReadout: document.getElementById('mode-readout') as HTMLElement,
  sim: document.getElementById('c-sim') as HTMLInputElement,
  record: document.getElementById('btn-record') as HTMLButtonElement,
  recordStatus: document.getElementById('record-status') as HTMLElement,
  replay: document.getElementById('btn-replay') as HTMLButtonElement,
  replayStatus: document.getElementById('replay-status') as HTMLElement,
  bakeLabel: document.getElementById('c-bake-label') as HTMLInputElement,
  bakePointsOnly: document.getElementById('c-bake-points-only') as HTMLInputElement,
  bake: document.getElementById('btn-bake') as HTMLButtonElement,
  bakeStatus: document.getElementById('bake-status') as HTMLElement,
  load: document.getElementById('btn-load') as HTMLButtonElement,
  loadStatus: document.getElementById('load-status') as HTMLElement,
  galleryTab: document.getElementById('gallery-tab') as HTMLButtonElement,
  gallery: document.getElementById('preset-gallery') as HTMLDivElement,
  galleryClose: document.getElementById('gallery-close') as HTMLButtonElement,
  presetCards: [...document.querySelectorAll<HTMLButtonElement>('.preset-card')],
}

const focusEl = {
  title: document.getElementById('focus-title') as HTMLElement,
  subtitle: document.getElementById('focus-subtitle') as HTMLElement,
  node: document.getElementById('focus-node') as HTMLElement,
  degree: document.getElementById('focus-degree') as HTMLElement,
  links: document.getElementById('focus-links') as HTMLElement,
  overview: document.getElementById('btn-focus-overview') as HTMLButtonElement,
  neighbors: document.getElementById('btn-focus-neighbors') as HTMLButtonElement,
  step: document.getElementById('btn-focus-step') as HTMLButtonElement,
}

let isBakeInProgress = false
let isLoadInProgress = false
let isReplayInProgress = false

const graphHost = document.getElementById('graph') as HTMLDivElement
const labelEls = [...document.querySelectorAll<HTMLDivElement>('#cluster-labels .cluster-label')]
const workRegionsEl = document.getElementById('work-regions') as HTMLDivElement

interface LabelAnchor {
  label: string;
  x: number;
  y: number;
}

let labelAnchors: LabelAnchor[] = []
let labelAnimationFrame = 0
let workRegionEls: HTMLDivElement[] = []

type WorkFocusState =
  | {
      type: 'point';
      index: number;
      degree: number;
      neighbors: number[];
      secondDegree: number[];
      connectedLinks: number[];
      directLinks: number[];
      neighborhood: number[];
      visiblePoints: number[];
    }
  | { type: 'link'; index: number; endpoints: number[] }

let workFocusState: WorkFocusState | undefined

function boolParam (value: string | null, fallback: boolean): boolean {
  if (value === null || value === '') return fallback
  return value === '1' || value === 'true'
}

function isWorkMode (cfg: Pick<DemoConfig, 'dataMode' | 'n'> & { palette?: GalleryPalette }): boolean {
  return cfg.dataMode === 'work' || (cfg.n <= 1000 && (!cfg.palette || cfg.palette === 'category'))
}

function hydrateControlsFromUrl (): void {
  const params = new URLSearchParams(window.location.search)
  const n = params.get('n')
  if (n && [...ctlEl.n.options].some(o => o.value === n)) ctlEl.n.value = n
  const data = params.get('data')
  if (data === 'ba' || data === 'cosmo' || data === 'work') ctlEl.data.value = data
  if (data === 'work' && !n) ctlEl.n.value = '500'
  const seed = params.get('seed')
  if (seed !== null && seed !== '') ctlEl.seed.value = seed
  ctlEl.webgpu.checked = boolParam(params.get('useWebGPU'), ctlEl.webgpu.checked)
  const msaa = params.get('msaa')
  if (msaa === '4') ctlEl.msaa.checked = true
  if (msaa === '1') ctlEl.msaa.checked = false
  ctlEl.adpr.checked = boolParam(params.get('adaptiveDpr'), ctlEl.adpr.checked)
  const blend = params.get('linkBlendMode') ?? params.get('blend')
  if (blend === 'normal' || blend === 'add') ctlEl.blend.value = blend
  const theme = params.get('theme')
  if (theme === 'light') {
    ctlEl.theme.classList.remove('active')
    ctlEl.theme.textContent = 'light'
  } else if (theme === 'dark') {
    ctlEl.theme.classList.add('active')
    ctlEl.theme.textContent = 'dark'
  }
  const fpsHeadroom = params.get('frameRateHeadroomFps') ?? params.get('fpsHeadroom')
  const frameCap = fpsHeadroom && fpsHeadroom !== '0'
    ? `headroom-${fpsHeadroom}`
    : params.get('frameRateLimit') ?? params.get('fpsCap')
  if (frameCap && [...ctlEl.frameCap.options].some(o => o.value === frameCap)) ctlEl.frameCap.value = frameCap
  ctlEl.edges.classList.toggle('active', boolParam(params.get('renderLinks'), ctlEl.edges.classList.contains('active')))
  ctlEl.density.classList.toggle('active', boolParam(params.get('density'), ctlEl.density.classList.contains('active')))
  ctlEl.lod.classList.toggle('active', boolParam(params.get('lod'), ctlEl.lod.classList.contains('active')))
  ctlEl.lanes.classList.toggle('active', boolParam(params.get('lanes'), ctlEl.lanes.classList.contains('active')))
  ctlEl.sim.checked = boolParam(params.get('sim'), ctlEl.sim.checked)
}

function readControls (): DemoConfig {
  const params = new URLSearchParams(window.location.search)
  const n = parseInt(ctlEl.n.value, 10)
  const theme = ctlEl.theme.classList.contains('active') ? 'dark' : 'light'
  return {
    n,
    dataMode: ctlEl.data.value === 'ba'
      ? 'ba'
      : ctlEl.data.value === 'work'
        ? 'work'
        : 'cosmo',
    seed: parseInt(ctlEl.seed.value, 10) || 42,
    webgpu: true,
    msaa: ctlEl.msaa.checked,
    adaptiveDpr: ctlEl.adpr.checked,
    theme,
    palette: parsePaletteParam(params.get('palette')),
    blend: ctlEl.blend.value === 'normal' ? 'normal' : 'add',
    sim: ctlEl.sim.checked,
    renderLinks: ctlEl.edges.classList.contains('active'),
    density: ctlEl.density.classList.contains('active'),
    lod: ctlEl.lod.classList.contains('active'),
    lanes: ctlEl.lanes.classList.contains('active'),
    massConserve: boolParam(params.get('massConserve'), false),
    debugFrameTrace: boolParam(
      params.get('flashDebug') ??
        params.get('debugFrameTrace'),
      false
    ),
    frameRateLimit: ctlEl.frameCap.value.startsWith('headroom-') ? 0 : Number.parseFloat(ctlEl.frameCap.value) || 0,
    frameRateHeadroomFps: ctlEl.frameCap.value.startsWith('headroom-')
      ? Number.parseFloat(ctlEl.frameCap.value.slice('headroom-'.length)) || 0
      : 0,
  }
}

function syncNodeButtons (): void {
  for (const button of ctlEl.nButtons) {
    const isActive = button.dataset.n === ctlEl.n.value &&
      (!button.dataset.mode || button.dataset.mode === ctlEl.data.value)
    button.classList.toggle('active', isActive)
    button.setAttribute('aria-pressed', String(isActive))
  }
}

function syncDependentControls (): void {
  ctlEl.webgpu.checked = true
  ctlEl.webgpu.disabled = false
  ctlEl.msaa.disabled = !ctlEl.webgpu.checked
  if (!ctlEl.webgpu.checked) ctlEl.msaa.checked = false
}

function syncToggleButtons (): void {
  const isDark = ctlEl.theme.classList.contains('active')
  syncDependentControls()
  const isWork = currentConfig ? isWorkMode(currentConfig) : ctlEl.data.value === 'work'
  const isDense = ctlEl.density.classList.contains('active')
  const hasEdges = ctlEl.edges.classList.contains('active')
  const hasLod = ctlEl.lod.classList.contains('active')
  const hasLanes = ctlEl.lanes.classList.contains('active')
  ctlEl.theme.textContent = isDark ? 'dark' : 'light'
  ctlEl.density.textContent = isWork ? (isDense ? 'large' : 'compact') : (isDense ? 'dense' : 'sparse')
  ctlEl.edges.textContent = hasEdges ? 'edges' : 'points'
  ctlEl.lod.textContent = isWork ? (hasLod ? 'rank' : 'even') : (hasLod ? 'phantom' : 'exact')
  ctlEl.lanes.textContent = hasLanes ? 'lanes' : 'straight'
  for (const button of [ctlEl.theme, ctlEl.density, ctlEl.edges, ctlEl.lod, ctlEl.lanes]) {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')))
  }
  writeModeReadout()
  syncGalleryButtons()
}

function writeModeReadout (activeLod?: string): void {
  const isDark = ctlEl.theme.classList.contains('active')
  const isWork = ctlEl.data.value === 'work' || ctlEl.n.value === '500'
  const hasEdges = ctlEl.edges.classList.contains('active')
  const hasLod = ctlEl.lod.classList.contains('active')
  const hasLanes = ctlEl.lanes.classList.contains('active')
  const isMassAuto = ctlEl.webgpu.checked && hasLod && !isWork && parseInt(ctlEl.n.value, 10) >= 50000
  const paletteLabel = currentConfig?.palette !== 'category'
    ? currentConfig.palette === 'subnet'
      ? 'subnet map'
      : isDark ? currentConfig.palette : `${currentConfig.palette} light`
    : null
  const modeParts = [
    ctlEl.webgpu.checked ? 'WebGPU' : 'WebGL',
    ctlEl.msaa.checked && ctlEl.webgpu.checked ? 'MSAA 4x' : 'MSAA off',
    ctlEl.adpr.checked && isDark ? 'adaptive DPR' : 'native DPR',
    paletteLabel,
    isMassAuto ? (activeLod ?? 'mass + anchors') : null,
    isWork ? (hasLod ? 'ranked nodes' : 'even nodes') : hasLod ? 'phantom nodes' : 'exact nodes',
    hasEdges
      ? isWork
        ? (hasLanes ? 'curved work graph' : 'straight work graph')
        : (hasLanes ? 'bundled edges' : 'straight edges')
      : 'points only',
    ctlEl.frameCap.options[ctlEl.frameCap.selectedIndex]?.textContent?.trim() ?? 'native',
  ]
  ctlEl.modeReadout.textContent = modeParts.filter(Boolean).join(' · ')
}

function buildGraphConfig (cfg: DemoConfig): GraphConfig {
  const isLight = cfg.theme === 'light'
  const isWork = isWorkMode(cfg)
  const useEmberPalette = cfg.palette === 'ember' && !isLight
  const useIonPalette = cfg.palette === 'ion' && !isLight
  const useSignalPalette = cfg.palette === 'signal' && !isLight
  const useTokyoPalette = cfg.palette === 'tokyo' && !isLight
  const useInsightPalette = cfg.palette === 'insight' && !isLight
  const useFintechPalette = cfg.palette === 'fintech' && !isLight
  const useInfluencePalette = cfg.palette === 'influence' && !isLight
  const useTalentPalette = cfg.palette === 'talent' && !isLight
  const useSubnetPalette = cfg.palette === 'subnet' && isLight
  const useGalleryPalette = (isGalleryPalette(cfg.palette) && !isLight) || useSubnetPalette
  const useAdditiveLinks = cfg.blend === 'add' && !isLight
  const enableInteractions = isWork
  const useMassConservingLod = cfg.webgpu && cfg.lod && !isWork && cfg.n >= 50000
  const c: GraphConfig = {
    spaceSize: DEMO_SPACE_SIZE,
    backgroundColor: useSubnetPalette ? '#ffffff' : isLight ? '#fbfdff' : useEmberPalette ? '#010101' : useIonPalette ? '#02030a' : useSignalPalette || useTokyoPalette || useInsightPalette || useInfluencePalette ? '#020202' : useFintechPalette ? '#0e1f2b' : useTalentPalette ? '#172333' : (isWork ? '#05070b' : '#06090d'),
    pointDefaultColor: useSubnetPalette ? '#7a3cff' : isLight ? '#005ff2' : useEmberPalette ? '#fff5df' : useIonPalette ? '#97fbff' : useSignalPalette || useTokyoPalette ? '#f6f2e8' : useInsightPalette ? '#555555' : useFintechPalette ? '#2faee8' : useInfluencePalette ? '#ff3214' : useTalentPalette ? '#39a8df' : '#9bc7ff',
    pointDefaultSize: isWork ? 8.5 : cfg.density ? 1.55 : 1.15,
    pointSizeScale: isWork ? 1.08 : 1,
    pointOpacity: useSubnetPalette || useTokyoPalette || useSignalPalette || useInsightPalette || useFintechPalette || useInfluencePalette || useTalentPalette ? 1 : isWork ? 1 : isLight ? (cfg.density ? 0.82 : 0.58) : cfg.lanes ? 0.72 : cfg.density ? 0.84 : 0.34,
    linkDefaultColor: useSubnetPalette ? '#7a3cff' : isLight ? '#2e486a' : useEmberPalette ? '#2b241c' : useIonPalette ? '#152040' : useSignalPalette ? '#ddd8ce' : useTokyoPalette ? '#d8d8d4' : useInsightPalette ? '#383838' : useFintechPalette ? '#2b8aaa' : useInfluencePalette ? '#4b3328' : useTalentPalette ? '#58a9ca' : '#273447',
    linkDefaultWidth: useSubnetPalette ? 1.65 : isWork ? 1.85 : useTokyoPalette ? 0.38 : useSignalPalette ? 0.54 : useInsightPalette ? 0.68 : useFintechPalette ? 0.72 : useInfluencePalette ? 0.28 : useTalentPalette ? 0.0 : cfg.lanes ? (isLight ? 0.42 : 0.56) : cfg.density ? (isLight ? 0.32 : 0.42) : 0.26,
    linkWidthScale: isWork ? 1.06 : isLight ? 0.92 : 1,
    linkOpacity: cfg.renderLinks
      ? isWork
        ? useSubnetPalette ? 0.82 : (isLight ? 0.78 : 0.72)
        : cfg.lanes
          ? isLight
            ? useMassConservingLod ? 0.060 : (useAdditiveLinks ? 0.62 : 0.18)
            : useMassConservingLod ? 0.060 : useEmberPalette ? 0.34 : useIonPalette ? 0.40 : useSignalPalette ? 0.58 : useTokyoPalette ? 0.32 : (cfg.blend === 'add' ? 0.46 : 0.72)
          : cfg.density
            ? isLight
              ? useMassConservingLod ? 0.050 : (useAdditiveLinks ? 0.56 : 0.16)
              : useMassConservingLod ? 0.045 : useEmberPalette ? 0.26 : useIonPalette ? 0.32 : useSignalPalette ? 0.46 : useTokyoPalette ? 0.28 : (cfg.blend === 'add' ? 0.42 : 0.62)
            : isLight
              ? useMassConservingLod ? 0.026 : (useAdditiveLinks ? 0.07 : 0.10)
              : useMassConservingLod ? 0.024 : useEmberPalette ? 0.030 : useIonPalette ? 0.040 : useSignalPalette ? 0.64 : useTokyoPalette ? 0.82 : useInsightPalette ? 0.72 : useFintechPalette ? 0.64 : useInfluencePalette ? 0.50 : useTalentPalette ? 0 : (cfg.blend === 'add' ? 0.018 : 0.045)
      : 0,
    renderLinks: cfg.renderLinks,
    curvedLinks: isWork ? cfg.lanes : cfg.lanes,
    curvedLinkSegments: isWork ? (cfg.lanes ? 22 : 1) : cfg.lanes ? 6 : 1,
    curvedLinkWeight: isWork ? 0.84 : 0.8,
    curvedLinkControlPointDistance: isWork ? (cfg.lanes ? 0.12 : 0) : 0.5,
    linkBundlingStrength: isWork ? (cfg.lanes ? 0.06 : 0) : cfg.lanes ? 0.42 : 0,
    linkBundlingCellSize: isWork ? 240 : 320,
    maxZoomLevel: isWork ? 10 : 8,
    rescalePositions: isWork ? false : undefined,
    constrainCameraToGraph: true,
    cameraBoundsPadding: 0.12,
    fitViewOnInit: true,
    fitViewPadding: isWork ? 0.16 : (cfg.density ? 0.22 : 0.18),
    fitViewDuration: 180,
    enableSimulation: isWork ? false : cfg.sim,
    enableDrag: isWork,
    physicsTickRate: 60,
    simulationFriction: isWork ? 0.90 : 0.85,
    simulationRepulsion: isWork ? 0.035 : 0.12,
    simulationGravity: isWork ? 0.08 : 0.24,
    enableGpuTimings: true,
    disableIdleFrameSkip: true,
    linkBlendMode: (isWork || isLight || useGalleryPalette || useMassConservingLod) ? 'normal' : cfg.blend,
    hoveredPointCursor: enableInteractions ? 'pointer' : 'default',
    hoveredLinkCursor: enableInteractions ? 'pointer' : 'default',
    renderHoveredPointRing: enableInteractions,
    hoveredPointRingColor: useSubnetPalette ? [0.10, 0.28, 1.0, 0.92] : isLight ? [0.0, 0.24, 0.86, 0.96] : useSignalPalette || useTokyoPalette ? [1.0, 0.25, 0.02, 0.96] : isWork ? [0.98, 0.98, 1.0, 0.92] : [0.72, 0.92, 1.0, 0.86],
    focusedPointRingColor: useSubnetPalette ? [1.0, 0.40, 0.0, 1.0] : isLight ? [0.98, 0.31, 0.0, 1.0] : useSignalPalette || useTokyoPalette ? [1.0, 0.28, 0.02, 1.0] : isWork ? [1.0, 0.92, 0.68, 1.0] : [0.95, 1.0, 1.0, 0.98],
    outlinedPointRingColor: isLight ? [0.0, 0.32, 1.0, 0.70] : [0.72, 0.90, 1.0, 0.72],
    pointGreyoutOpacity: isWork ? (isLight ? 0.16 : 0.20) : undefined,
    hoveredLinkColor: isLight ? [0.0, 0.22, 0.74, 0.96] : [0.82, 0.94, 1.0, 0.92],
    hoveredLinkWidthIncrease: 2.25,
    focusedLinkWidthIncrease: 3.5,
    linkGreyoutOpacity: isWork ? (isLight ? 0.08 : 0.10) : 0.1,
    onPointMouseOver: enableInteractions ? (index) => { previewWorkPoint(index) } : undefined,
    onPointMouseOut: enableInteractions ? () => { clearWorkPreview() } : undefined,
    onLinkMouseOver: enableInteractions ? (index) => { previewWorkLink(index) } : undefined,
    onLinkMouseOut: enableInteractions ? () => { clearWorkPreview() } : undefined,
    onPointClick: enableInteractions
      ? (index) => {
        focusWorkPoint(index, true)
        exploreNodeClickHook?.(index)
      }
      : undefined,
    onLinkClick: enableInteractions
      ? (index) => {
        focusWorkLink(index, true)
      }
      : undefined,
    onBackgroundClick: () => {
      clearWorkFocus(false)
    },
    renderLodMode: useMassConservingLod ? 'auto' : 'exact',
    impostorDensityScale: useMassConservingLod ? 2 : cfg.density ? 4 : 5,
    impostorTileSize: useMassConservingLod ? 4 : 7,
    impostorMicroSplats: useMassConservingLod ? 1 : 1,
    impostorTileOpacity: useMassConservingLod
      ? isLight
        ? 0.00035
        : 0.00045
      : useAdditiveLinks ? 0.006 : isLight ? 0.024 : 0.04,
    impostorExactOverlay: true,
    impostorStableOverlay: false,
    impostorExactOverlaySampleRate: useMassConservingLod
      ? cfg.n >= 500000
        ? 0.045
        : cfg.n >= 250000
          ? 0.060
          : 0.090
      : cfg.density ? 0.38 : 0.34,
    impostorExactOverlayOpacity: useMassConservingLod
      ? isLight
        ? 0.42
        : 0.34
      : useAdditiveLinks ? 0.74 : isLight ? 0.58 : 0.82,
    impostorExactOverlaySizeScale: useMassConservingLod ? 0.72 : 0.86,
    impostorSparseTileThreshold: useMassConservingLod ? 2 : 5,
    impostorSparseAnchorOpacity: useMassConservingLod ? 0.50 : 0.95,
    impostorAnchorsPerTile: useMassConservingLod ? (cfg.n >= 500000 ? 2 : 3) : cfg.density ? 6 : 5,
    impostorPointSizeScale: useMassConservingLod ? 0.78 : 1.0,
    impostorCompositeStrength: useMassConservingLod ? (isLight ? 0.018 : 0.025) : useAdditiveLinks ? 0.24 : isLight ? 0.34 : 0.48,
    impostorAutoMinPoints: isWork ? 1_000_000 : useMassConservingLod ? 50000 : 500000,
    impostorAutoMaxZoom: useMassConservingLod ? 0.52 : 0.28,
    linkMinPixelLength: 0,
    pointMinPixelSize: 0,
    pointLodStrength: 0,
    pointLodZoomRange: [0.14, 0.95],
    pointLodMinSampleRate: cfg.density ? 0.22 : 0.32,
    pointLodSizeCompensation: 0.46,
    pointLodOpacityCompensation: useAdditiveLinks ? 0.34 : isLight ? 0.38 : 0.62,
    linkLodStrength: useMassConservingLod ? (cfg.lanes ? 0.68 : 0.78) : 0,
    linkLodZoomRange: [0.14, 0.90],
    linkLodMinSampleRate: useMassConservingLod
      ? isLight
        ? (cfg.lanes ? 0.06 : 0.035)
        : (cfg.lanes ? 0.08 : 0.045)
      : isLight ? (cfg.lanes ? 0.18 : 0.14) : cfg.lanes ? 0.30 : 0.20,
    linkLodWidthCompensation: useMassConservingLod ? (cfg.lanes ? 0.16 : 0.10) : isLight ? 0.26 : cfg.lanes ? 0.38 : 0.22,
    linkLodOpacityCompensation: useMassConservingLod ? (isLight ? 0.12 : 0.18) : useAdditiveLinks ? 0.25 : isLight ? 0.22 : 0.62,
    useWebGPU: cfg.webgpu,
    pixelRatio: window.devicePixelRatio || 1,
    adaptivePixelRatio: cfg.adaptiveDpr && !isLight ? 1 : false,
    msaa: cfg.webgpu && cfg.msaa && !useMassConservingLod ? 4 : 1,
    frameRateLimit: cfg.frameRateLimit,
    frameRateHeadroomFps: cfg.frameRateHeadroomFps,
    debugFrameTrace: cfg.debugFrameTrace,
  }
  return c
}

function scaleGeneratedDataToDemoSpace (data: GeneratedGraph): GeneratedGraph {
  const sourceCenter = SOURCE_SPACE_SIZE / 2
  const demoCenter = DEMO_SPACE_SIZE / 2
  const positions = new Float32Array(data.positions.length)
  for (let i = 0; i < data.positions.length; i += 2) {
    positions[i] = demoCenter + ((data.positions[i] ?? sourceCenter) - sourceCenter) * DEMO_CONTENT_SCALE
    positions[i + 1] = demoCenter + ((data.positions[i + 1] ?? sourceCenter) - sourceCenter) * DEMO_CONTENT_SCALE
  }
  return {
    positions,
    links: data.links,
    nodeCount: data.nodeCount,
    edgeCount: data.edgeCount,
  }
}

function seededUnit (seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function generateWorkGraph (count: number, seed: number): GeneratedGraph {
  const nodeCount = Math.max(64, count)
  const rand = seededUnit(seed)
  const center = DEMO_SPACE_SIZE / 2
  const positions = new Float32Array(nodeCount * 2)
  const groupForNode = new Int32Array(nodeCount)
  const links: number[] = []
  const addLink = (a: number, b: number): void => {
    if (a === b || a < 0 || b < 0 || a >= nodeCount || b >= nodeCount) return
    links.push(a, b)
  }

  positions[0] = center
  positions[1] = center
  groupForNode[0] = -1

  const hubIndices: number[] = []
  let cursor = 1
  for (let group = 0; group < WORK_GROUPS.length && cursor < nodeCount; group += 1) {
    const spec = WORK_GROUPS[group]!
    const x = center + Math.cos(spec.angle) * spec.radius * 0.48
    const y = center + Math.sin(spec.angle) * spec.radius * 0.48
    positions[cursor * 2] = x
    positions[cursor * 2 + 1] = y
    groupForNode[cursor] = group
    hubIndices.push(cursor)
    addLink(0, cursor)
    cursor += 1
  }

  const membersByGroup: number[][] = WORK_GROUPS.map(() => [])
  while (cursor < nodeCount) {
    const group = (cursor - 1) % WORK_GROUPS.length
    const spec = WORK_GROUPS[group]!
    const hub = hubIndices[group] ?? 0
    const ordinal = membersByGroup[group]!.length
    const ring = Math.floor(ordinal / 22)
    const angle = spec.angle + (rand() - 0.5) * 1.24 + ordinal * 0.43
    const radius = 260 + ring * 155 + rand() * 115
    const tangent = (rand() - 0.5) * 360
    const x = (positions[hub * 2] ?? center) + Math.cos(angle) * radius + Math.cos(spec.angle + Math.PI / 2) * tangent
    const y = (positions[hub * 2 + 1] ?? center) + Math.sin(angle) * radius + Math.sin(spec.angle + Math.PI / 2) * tangent
    positions[cursor * 2] = Math.max(220, Math.min(DEMO_SPACE_SIZE - 220, x))
    positions[cursor * 2 + 1] = Math.max(220, Math.min(DEMO_SPACE_SIZE - 220, y))
    groupForNode[cursor] = group
    membersByGroup[group]!.push(cursor)
    addLink(hub, cursor)
    if (ordinal > 0) addLink(membersByGroup[group]![ordinal - 1]!, cursor)
    if (ordinal > 4 && rand() > 0.45) addLink(membersByGroup[group]![Math.floor(rand() * ordinal)]!, cursor)
    cursor += 1
  }

  for (let group = 0; group < WORK_GROUPS.length; group += 1) {
    const hub = hubIndices[group] ?? 0
    const nextHub = hubIndices[(group + 1) % hubIndices.length] ?? 0
    addLink(hub, nextHub)
    const members = membersByGroup[group] ?? []
    const nextMembers = membersByGroup[(group + 1) % WORK_GROUPS.length] ?? []
    const crossCount = Math.min(10, members.length, nextMembers.length)
    for (let i = 0; i < crossCount; i += 1) {
      addLink(members[Math.floor(rand() * members.length)] ?? hub, nextMembers[Math.floor(rand() * nextMembers.length)] ?? nextHub)
    }
  }

  const graph = {
    positions,
    links: new Float32Array(links),
    nodeCount,
    edgeCount: links.length / 2,
  }
  ;(graph as GeneratedGraph & { groupForNode?: Int32Array }).groupForNode = groupForNode
  return graph
}

function buildLabelAnchors (data: GeneratedGraph): LabelAnchor[] {
  if (currentConfig.palette === 'subnet' && currentConfig.theme === 'light') {
    const groupForNode = (data as GeneratedGraph & { groupForNode?: Int32Array }).groupForNode
    if (groupForNode) {
      const labels = ['10.55.2.36', '10.55.2.40', '172.17.12.30', '192.168.22.54', '192.168.22.52', '172.31.111.126', '172.16.3.15']
      const sums = labels.map(label => ({ label, x: 0, y: 0, count: 0 }))
      for (let i = 0; i < data.nodeCount; i += 1) {
        const group = groupForNode[i] ?? -1
        const bucket = group >= 0 ? sums[group] : undefined
        if (!bucket) continue
        bucket.x += data.positions[i * 2] ?? 0
        bucket.y += data.positions[i * 2 + 1] ?? 0
        bucket.count += 1
      }
      return [
        { label: '172.31.111.124', x: DEMO_SPACE_SIZE / 2, y: DEMO_SPACE_SIZE / 2 },
        ...sums.filter(item => item.count > 0).map(item => ({
          label: item.label,
          x: item.x / item.count,
          y: item.y / item.count,
        })),
      ]
    }
  }
  if (isWorkMode(currentConfig)) {
    const center = DEMO_SPACE_SIZE / 2
    return [
      {
        label: 'CRM Graph',
        x: center,
        y: center,
      },
      ...WORK_GROUPS.map(group => ({
        label: group.label,
        x: center + Math.cos(group.angle) * group.radius * 0.35,
        y: center - Math.sin(group.angle) * group.radius * 0.35,
      })),
    ]
  }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < data.positions.length; i += 2) {
    const x = data.positions[i] ?? DEMO_SPACE_SIZE / 2
    const y = data.positions[i + 1] ?? DEMO_SPACE_SIZE / 2
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  if (currentConfig.palette === 'tokyo' && currentConfig.theme === 'dark') {
    return [
      { label: 'CONNECTING', x: minX + (maxX - minX) * 0.24, y: minY + (maxY - minY) * 0.46 },
      { label: 'THE', x: minX + (maxX - minX) * 0.63, y: minY + (maxY - minY) * 0.39 },
      { label: 'UNCONNECTED', x: minX + (maxX - minX) * 0.69, y: minY + (maxY - minY) * 0.31 },
      { label: '結', x: minX + (maxX - minX) * 0.50, y: minY + (maxY - minY) * 0.53 },
    ]
  }
  if (currentConfig.palette === 'signal' && currentConfig.theme === 'dark') {
    return [
      { label: 'BIG_DATA', x: minX + (maxX - minX) * 0.16, y: minY + (maxY - minY) * 0.24 },
      { label: 'R-7.1', x: minX + (maxX - minX) * 0.67, y: minY + (maxY - minY) * 0.18 },
      { label: 'INPUT', x: minX + (maxX - minX) * 0.83, y: minY + (maxY - minY) * 0.38 },
      { label: 'NODE.08', x: minX + (maxX - minX) * 0.76, y: minY + (maxY - minY) * 0.72 },
      { label: '2024-5094', x: minX + (maxX - minX) * 0.22, y: minY + (maxY - minY) * 0.68 },
      { label: 'SYSTEM', x: minX + (maxX - minX) * 0.49, y: minY + (maxY - minY) * 0.46 },
    ]
  }
  if (currentConfig.palette === 'insight' && currentConfig.theme === 'dark') {
    return [
      { label: 'nation', x: minX + (maxX - minX) * 0.39, y: minY + (maxY - minY) * 0.43 },
      { label: 'check', x: minX + (maxX - minX) * 0.41, y: minY + (maxY - minY) * 0.68 },
      { label: 'back', x: minX + (maxX - minX) * 0.69, y: minY + (maxY - minY) * 0.36 },
      { label: 'mississippi', x: minX + (maxX - minX) * 0.58, y: minY + (maxY - minY) * 0.43 },
      { label: 'faith', x: minX + (maxX - minX) * 0.77, y: minY + (maxY - minY) * 0.25 },
      { label: 'hope', x: minX + (maxX - minX) * 0.61, y: minY + (maxY - minY) * 0.24 },
    ]
  }
  if (currentConfig.palette === 'fintech' && currentConfig.theme === 'dark') {
    return fintechLabelAnchors(DEMO_SPACE_SIZE)
  }
  if (currentConfig.palette === 'influence' && currentConfig.theme === 'dark') {
    return influenceLabelAnchors(DEMO_SPACE_SIZE)
  }
  if (currentConfig.palette === 'talent' && currentConfig.theme === 'dark') {
    return talentLabelAnchors(DEMO_SPACE_SIZE)
  }
  const names = ['Research', 'Product', 'Growth', 'Operations', 'Finance', 'Success', 'Customer']
  const spots: [number, number][] = [
    [0.50, 0.22],
    [0.64, 0.44],
    [0.34, 0.47],
    [0.50, 0.74],
    [0.77, 0.64],
  ]
  return names.map((label, i) => {
    const [nx, ny] = spots[i] ?? [0.5, 0.5]
    return {
      label,
      x: minX + (maxX - minX) * nx,
      y: minY + (maxY - minY) * ny,
    }
  })
}

function ensureLabelElements (count: number): HTMLDivElement[] {
  const container = document.getElementById('cluster-labels')
  while (labelEls.length < count && container) {
    const el = document.createElement('div')
    el.className = 'cluster-label'
    container.appendChild(el)
    labelEls.push(el)
  }
  return labelEls
}

function ensureWorkRegions (): HTMLDivElement[] {
  if (workRegionEls.length === WORK_GROUPS.length) return workRegionEls
  workRegionsEl.innerHTML = ''
  workRegionEls = WORK_GROUPS.map((group) => {
    const el = document.createElement('div')
    const [r, g, b] = displayPaletteColor(group.color, currentConfig.theme === 'light')
    el.className = 'work-region'
    el.style.setProperty(
      '--region-color',
      `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`
    )
    workRegionsEl.appendChild(el)
    return el
  })
  return workRegionEls
}

function updateWorkRegions (graph: Graph): void {
  const regions = ensureWorkRegions()
  if (!isWorkMode(currentConfig)) {
    for (const el of regions) el.style.opacity = '0'
    return
  }
  const center = DEMO_SPACE_SIZE / 2
  for (const [i, WORK_GROUP] of WORK_GROUPS.entries()) {
    const group = WORK_GROUP!
    const el = regions[i]
    if (!el) continue
    const worldX = center + Math.cos(group.angle) * group.radius * 0.48
    const worldY = center - Math.sin(group.angle) * group.radius * 0.48
    const [x, y] = graph.spaceToScreenPosition([worldX, worldY])
    const [rx] = graph.spaceToScreenPosition([worldX + 340, worldY])
    const radius = Math.max(52, Math.abs(rx - x))
    el.style.width = `${(radius * 2).toFixed(1)}px`
    el.style.height = `${(radius * 2).toFixed(1)}px`
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
    el.style.opacity = '1'
  }
}

function updateLabelOverlay (graph: Graph): void {
  updateWorkRegions(graph)
  const hostRect = graphHost.getBoundingClientRect()
  const labels = ensureLabelElements(labelAnchors.length)
  for (const [i, el] of labels.entries()) {
    const anchor = labelAnchors[i]
    if (!el) continue
    if (!anchor) {
      el.style.opacity = '0'
      continue
    }
    if (el.textContent !== anchor.label) el.textContent = anchor.label
    const [x, y] = graph.spaceToScreenPosition([anchor.x, anchor.y])
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
    const isVisible = x > -120 && x < hostRect.width + 120 && y > -80 && y < hostRect.height + 80
    const zoom = (graph as unknown as { getZoomLevel?: () => number }).getZoomLevel?.() ?? 1
    const zoomFade = isWorkMode(currentConfig)
      ? Math.max(0.18, Math.min(1, (4.4 - zoom) / 2.8))
      : Math.max(0, Math.min(1, (1.65 - zoom) / 1.1))
    const labelOpacity = isWorkMode(currentConfig)
      ? (currentConfig.theme === 'light' ? 0.88 : 0.78)
      : currentConfig.palette === 'influence'
        ? 0.96
        : currentConfig.palette === 'talent'
          ? 0.88
          : currentConfig.palette === 'fintech'
            ? 0.92
            : (currentConfig.theme === 'light' ? 0.72 : 0.54)
    el.style.opacity = isVisible ? (labelOpacity * zoomFade).toFixed(2) : '0'
  }
}

function startLabelLoop (): void {
  if (labelAnimationFrame !== 0) return
  const loop = (): void => {
    const g = currentGraph ?? (window as unknown as { __demoGraph?: Graph }).__demoGraph ?? null
    if (g) updateLabelOverlay(g)
    labelAnimationFrame = requestAnimationFrame(loop)
  }
  labelAnimationFrame = requestAnimationFrame(loop)
}

function applyTheme (theme: DemoConfig['theme']): void {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.graphMode = isWorkMode(currentConfig) ? 'work' : 'galaxy'
  document.documentElement.dataset.palette = currentConfig.palette
  ctlEl.theme.classList.toggle('active', theme === 'dark')
  syncToggleButtons()
}

function fintechColor (group: number): [number, number, number] {
  const colors: [number, number, number][] = [
    [0.12, 0.62, 0.92],
    [0.96, 0.22, 0.58],
    [0.58, 0.23, 0.72],
  ]
  return colors[group % colors.length] ?? colors[0]!
}

function influenceColor (group: number): [number, number, number] {
  const colors: [number, number, number][] = [
    [1.00, 0.18, 0.04],
    [1.00, 0.70, 0.00],
    [0.95, 0.95, 0.90],
    [0.00, 0.82, 0.92],
    [0.65, 0.95, 1.00],
    [0.24, 0.14, 1.00],
  ]
  return colors[group % colors.length] ?? colors[0]!
}

function talentColor (group: number): [number, number, number] {
  const colors: [number, number, number][] = [
    [0.18, 0.58, 0.88],
    [0.98, 0.86, 0.16],
    [0.94, 0.28, 0.45],
    [0.98, 0.56, 0.25],
    [0.36, 0.78, 0.68],
    [0.66, 0.38, 0.82],
    [0.92, 0.36, 0.70],
  ]
  return colors[group % colors.length] ?? colors[0]!
}

function buildVisualAttributes (data: GeneratedGraph | RenderableGraphData): {
  pointColors: Float32Array;
  pointSizes: Float32Array;
  linkColors: Float32Array;
  linkWidths: Float32Array;
} {
  const isLight = currentConfig.theme === 'light'
  const isDense = currentConfig.density
  const isWork = isWorkMode(currentConfig)
  const useGalleryPalette = (isGalleryPalette(currentConfig.palette) && !isLight) ||
    (currentConfig.palette === 'subnet' && isLight)
  const isTokyoPalette = currentConfig.palette === 'tokyo' && useGalleryPalette
  const isSubnetPalette = currentConfig.palette === 'subnet' && useGalleryPalette
  const isFintechPalette = currentConfig.palette === 'fintech' && useGalleryPalette
  const isInfluencePalette = currentConfig.palette === 'influence' && useGalleryPalette
  const isTalentPalette = currentConfig.palette === 'talent' && useGalleryPalette
  const useMassConservingLod = false
  const isRankedWork = !isWork || currentConfig.lod
  const useLanes = currentConfig.lanes
  const pointColors = new Float32Array(data.nodeCount * 4)
  const pointSizes = new Float32Array(data.nodeCount)
  const linkColors = new Float32Array(data.edgeCount * 4)
  const linkWidths = new Float32Array(data.edgeCount)
  const degrees = new Uint16Array(data.nodeCount)
  for (let i = 0; i < data.edgeCount; i += 1) {
    const a = data.links[i * 2] ?? -1
    const b = data.links[i * 2 + 1] ?? -1
    if (a >= 0 && a < data.nodeCount) degrees[a] += 1
    if (b >= 0 && b < data.nodeCount) degrees[b] += 1
  }
  const groupForNode = (data as GeneratedGraph & { groupForNode?: Int32Array }).groupForNode
  const edgeKindForEdge = (data as RenderableGraphData).edgeKind
  const edgeWeightForEdge = (data as RenderableGraphData).edgeWeight
  const edgeConfidenceForEdge = (data as RenderableGraphData).edgeConfidence
  const cx = DEMO_SPACE_SIZE / 2
  const cy = DEMO_SPACE_SIZE / 2
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  if (useGalleryPalette) {
    for (let i = 0; i < data.nodeCount; i += 1) {
      const x = data.positions[i * 2] ?? cx
      const y = data.positions[i * 2 + 1] ?? cy
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  const normalizeX = (x: number): number => useGalleryPalette && maxX > minX ? (x - minX) / (maxX - minX) : 0.5
  const normalizeY = (y: number): number => useGalleryPalette && maxY > minY ? 1 - ((y - minY) / (maxY - minY)) : 0.5

  for (let i = 0; i < data.nodeCount; i += 1) {
    const x = data.positions[i * 2] ?? cx
    const y = data.positions[i * 2 + 1] ?? cy
    const angle = Math.atan2(y - cy, x - cx)
    const bucket = isWork && groupForNode
      ? Math.max(0, groupForNode[i] ?? 0)
      : Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 8)
    const hash = (Math.imul(i + 1, 2654435761) >>> 0) / 0x1_0000_0000
    const degree = degrees[i] ?? 0
    const [r, g, b] = isInfluencePalette && groupForNode
      ? influenceColor(Math.max(0, groupForNode[i] ?? 0))
      : isTalentPalette && groupForNode
        ? talentColor(Math.max(0, groupForNode[i] ?? 0))
        : isFintechPalette && groupForNode
          ? fintechColor(Math.max(0, groupForNode[i] ?? 0))
          : isSubnetPalette
            ? displayPaletteColor(bucket, true)
            : useGalleryPalette
              ? galleryParticleColor(currentConfig.palette, normalizeX(x), normalizeY(y), hash, degree)
              : displayPaletteColor(bucket, isLight)
    const isHub = isWork ? degree >= 11 || i === 0 : hash > 0.982
    const isMicroDetail = false
    const lightScale = useGalleryPalette ? 1.0 : isWork ? 1.04 : 1.14
    pointColors[i * 4] = isLight ? Math.min(1, r * lightScale) : r
    pointColors[i * 4 + 1] = isLight ? Math.min(1, g * lightScale) : g
    pointColors[i * 4 + 2] = isLight ? Math.min(1, b * lightScale) : b
    pointColors[i * 4 + 3] = isWork
      ? (isHub ? 1 : (isLight ? 0.82 : 0.90))
      : isSubnetPalette
        ? 0.96
        : isTokyoPalette
          ? (isHub ? 1 : 0.92)
          : isInfluencePalette
            ? (i === 0 || degree > 18 ? 1 : 0.92)
            : isTalentPalette
              ? 0.98
              : isMicroDetail
                ? (isLight ? 0.16 : 0.20)
                : isHub
                  ? 1
                  : isLight
                    ? (isDense ? 0.64 : 0.48)
                    : (isDense ? 0.84 : 0.48)
    const baseSize = isWork
      ? isRankedWork
        ? i === 0
          ? 38
          : isSubnetPalette
            ? 14.5 + hash * 1.8 + Math.min(4.5, degree * 0.18)
            : isHub
              ? 18 + Math.min(12, Math.sqrt(degree) * 2.1)
              : 9.4 + hash * 4.2 + Math.min(2.8, degree * 0.24)
        : i === 0
          ? isSubnetPalette ? 24 : 18
          : isSubnetPalette ? 14.0 + hash * 1.4 : 12.4 + hash * 1.2
      : isTokyoPalette
        ? isHub
          ? 3.25 + hash * 1.05
          : 1.78 + hash * 0.64
        : currentConfig.palette === 'insight'
          ? isHub
            ? 14 + hash * 5.0
            : 6.2 + hash * 4.6
          : isFintechPalette
            ? isHub || degree > 8
              ? 15 + hash * 4.0
              : 2.8 + hash * 1.8
            : isInfluencePalette
              ? i === 0
                ? 24
                : degree > 32
                  ? 6.5 + hash * 2.0
                  : degree > 12
                    ? 3.2 + hash * 1.3
                    : 1.75 + hash * 0.85
              : isTalentPalette
                ? degree > 4 || hash > 0.80
                  ? 15 + Math.pow(hash, 2.0) * 26
                  : 5.2 + hash * 7.0
                : currentConfig.palette === 'signal'
                  ? isHub
                    ? 3.4 + hash * 1.8
                    : 1.55 + hash * 0.78
                  : isHub
                    ? 3.8 + hash * 3.9
                    : 1.18 + hash * 1.18
    pointSizes[i] = baseSize * (isWork ? (isDense ? 1.08 : 0.92) : (isTokyoPalette || currentConfig.palette === 'signal' || currentConfig.palette === 'insight' || isFintechPalette || isInfluencePalette || isTalentPalette) ? 1 : isLight ? (isDense ? 1.10 : 0.54) : isDense ? 1 : 0.44) * (isMicroDetail ? 0.45 : 1)
  }

  for (let i = 0; i < data.edgeCount; i += 1) {
    const a = data.links[i * 2] ?? 0
    const bIndex = data.links[i * 2 + 1] ?? a
    const group = isWork && groupForNode
      ? Math.max(0, groupForNode[a] ?? groupForNode[bIndex] ?? 0)
      : a % 8
    const ax = data.positions[a * 2] ?? cx
    const ay = data.positions[a * 2 + 1] ?? cy
    const bx = data.positions[bIndex * 2] ?? ax
    const by = data.positions[bIndex * 2 + 1] ?? ay
    const edgeMix = isSubnetPalette ? 0.92 : useMassConservingLod ? 0.86 : isLight && !isWork ? 0.74 : 0.42
    const edgeBase: [number, number, number] = useMassConservingLod
      ? [0.36, 0.40, 0.50]
      : isLight && !isWork
        ? currentConfig.palette === 'subnet' ? [0.96, 0.96, 0.96] : [0.44, 0.48, 0.58]
        : currentConfig.palette === 'ember' ? [0.58, 0.48, 0.36] : currentConfig.palette === 'ion' ? [0.18, 0.28, 0.50] : currentConfig.palette === 'signal' ? [0.86, 0.84, 0.78] : currentConfig.palette === 'tokyo' ? [0.74, 0.74, 0.72] : currentConfig.palette === 'insight' ? [0.23, 0.23, 0.23] : currentConfig.palette === 'fintech' ? [0.10, 0.42, 0.58] : currentConfig.palette === 'influence' ? [0.42, 0.30, 0.22] : currentConfig.palette === 'talent' ? [0.28, 0.55, 0.68] : [0.70, 0.74, 0.82]
    const aDegree = degrees[a] ?? 0
    const bDegree = degrees[bIndex] ?? 0
    const edgeKind = edgeKindForEdge?.[i] ?? 0
    const projectedEdge = edgeKind === 1
    const predictedEdge = edgeKind === 2
    const edgeWeight = edgeWeightForEdge?.[i] ?? 1
    const edgeConfidence = edgeConfidenceForEdge?.[i] ?? 0
    const sourceParticle = useGalleryPalette
      ? isInfluencePalette && groupForNode
        ? influenceColor(Math.max(0, groupForNode[a] ?? 0))
        : isTalentPalette && groupForNode
          ? talentColor(Math.max(0, groupForNode[a] ?? 0))
          : isFintechPalette && groupForNode
            ? fintechColor(Math.max(0, groupForNode[a] ?? 0))
            : isSubnetPalette
              ? displayPaletteColor(groupForNode ? Math.max(0, groupForNode[a] ?? 0) : group, true)
              : galleryParticleColor(currentConfig.palette, normalizeX(ax), normalizeY(ay), (Math.imul(a + 1, 2654435761) >>> 0) / 0x1_0000_0000, aDegree)
      : undefined
    const targetParticle = useGalleryPalette
      ? isInfluencePalette && groupForNode
        ? influenceColor(Math.max(0, groupForNode[bIndex] ?? 0))
        : isTalentPalette && groupForNode
          ? talentColor(Math.max(0, groupForNode[bIndex] ?? 0))
          : isFintechPalette && groupForNode
            ? fintechColor(Math.max(0, groupForNode[bIndex] ?? 0))
            : isSubnetPalette
              ? displayPaletteColor(groupForNode ? Math.max(0, groupForNode[bIndex] ?? 0) : group, true)
              : galleryParticleColor(currentConfig.palette, normalizeX(bx), normalizeY(by), (Math.imul(bIndex + 1, 2654435761) >>> 0) / 0x1_0000_0000, bDegree)
      : undefined
    const [r, g, b] = predictedEdge
      ? [1.0, 0.43, 0.10] as [number, number, number]
      : projectedEdge
        ? [0.42, 0.84, 1.0] as [number, number, number]
        : useGalleryPalette && sourceParticle && targetParticle
          ? galleryLinkColor(
            currentConfig.palette,
            normalizeY(ay),
            normalizeY(by),
            sourceParticle,
            targetParticle
          )
          : displayPaletteColor(group, isLight)
    const edgeR = (isLight && !isWork) || useGalleryPalette ? edgeBase[0] + (r - edgeBase[0]) * edgeMix : r
    const edgeG = (isLight && !isWork) || useGalleryPalette ? edgeBase[1] + (g - edgeBase[1]) * edgeMix : g
    const edgeB = (isLight && !isWork) || useGalleryPalette ? edgeBase[2] + (b - edgeBase[2]) * edgeMix : b
    const touchesCenter = isWork && (a === 0 || bIndex === 0)
    const touchesHub = isWork && (touchesCenter || aDegree >= 11 || bDegree >= 11)
    const sameGroup = isWork && groupForNode && (groupForNode[a] ?? -2) === (groupForNode[bIndex] ?? -3)
    const edgeStrength = isSubnetPalette
      ? isRankedWork
        ? (touchesHub ? 1.38 : sameGroup ? 1.08 : 0.92)
        : (sameGroup ? 1.04 : 0.86)
      : isTokyoPalette
        ? (useLanes ? 1.10 : 0.92)
        : currentConfig.palette === 'signal'
          ? 1.18
          : currentConfig.palette === 'insight'
            ? 1.26
            : isFintechPalette
              ? 1.16
              : isInfluencePalette
                ? (a === 0 || bIndex === 0 ? 1.42 : 0.84)
                : isTalentPalette
                  ? 0
                  : isWork
                    ? isRankedWork
                      ? (touchesHub ? 1.45 : sameGroup ? 1.14 : 0.86)
                      : (sameGroup ? 1.05 : 0.78)
                    : useLanes ? 1.32 : isDense ? 0.82 : 0.10
    linkColors[i * 4] = Math.min(1, edgeR * (isSubnetPalette ? 1.0 : isLight ? (isWork ? 0.78 : useMassConservingLod ? 0.72 : 0.46) : currentConfig.palette === 'ember' ? 0.86 : currentConfig.palette === 'ion' ? 0.74 : currentConfig.palette === 'signal' ? 1.05 : currentConfig.palette === 'tokyo' ? 1.08 : currentConfig.palette === 'insight' ? 1.04 : isFintechPalette ? 1.05 : isInfluencePalette ? 1.12 : isTalentPalette ? 0 : isWork ? 0.72 : 0.40) * edgeStrength)
    linkColors[i * 4 + 1] = Math.min(1, edgeG * (isSubnetPalette ? 1.0 : isLight ? (isWork ? 0.78 : useMassConservingLod ? 0.72 : 0.46) : currentConfig.palette === 'ember' ? 0.76 : currentConfig.palette === 'ion' ? 0.76 : currentConfig.palette === 'signal' ? 1.02 : currentConfig.palette === 'tokyo' ? 1.04 : currentConfig.palette === 'insight' ? 1.04 : isFintechPalette ? 1.05 : isInfluencePalette ? 0.92 : isTalentPalette ? 0 : isWork ? 0.72 : 0.40) * edgeStrength)
    linkColors[i * 4 + 2] = Math.min(1, edgeB * (isSubnetPalette ? 1.0 : isLight ? (isWork ? 0.84 : useMassConservingLod ? 0.76 : 0.54) : currentConfig.palette === 'ember' ? 0.62 : currentConfig.palette === 'ion' ? 0.92 : currentConfig.palette === 'signal' ? 0.96 : currentConfig.palette === 'tokyo' ? 1.0 : currentConfig.palette === 'insight' ? 1.04 : isFintechPalette ? 1.05 : isInfluencePalette ? 0.80 : isTalentPalette ? 0 : isWork ? 0.76 : 0.42) * edgeStrength)
    const baseAlpha = isWork
      ? isRankedWork && touchesHub
        ? isSubnetPalette ? 0.76 : (isLight ? 0.62 : 0.74)
        : sameGroup
          ? isSubnetPalette ? 0.56 : (isLight ? 0.44 : 0.56)
          : isSubnetPalette ? 0.40 : (isLight ? 0.30 : 0.40)
      : (useMassConservingLod ? 0.012 : isLight ? 0.045 : currentConfig.palette === 'ember' ? 0.11 : currentConfig.palette === 'ion' ? 0.14 : currentConfig.palette === 'signal' ? 0.42 : currentConfig.palette === 'tokyo' ? 0.38 : currentConfig.palette === 'insight' ? 0.50 : isFintechPalette ? 0.46 : isInfluencePalette ? 0.42 : isTalentPalette ? 0 : 0.18) * (useLanes ? 0.78 : edgeStrength)
    linkColors[i * 4 + 3] = predictedEdge
      ? Math.max(baseAlpha, 0.28 + edgeConfidence * 0.32)
      : projectedEdge
        ? Math.max(baseAlpha * 0.46, 0.08 + Math.min(0.22, edgeConfidence * 0.24))
        : baseAlpha
    linkWidths[i] = isWork
      ? isRankedWork
        ? touchesCenter
          ? isSubnetPalette ? 5.2 : 4.4
          : touchesHub
            ? isSubnetPalette ? 3.2 : 2.8
            : sameGroup
              ? isSubnetPalette ? 1.85 : 1.65
              : isSubnetPalette ? 1.18 : 1.05
        : sameGroup ? (isSubnetPalette ? 1.8 : 1.65) : (isSubnetPalette ? 1.12 : 1.05)
      : predictedEdge
        ? 1.4 + edgeConfidence * 1.8
        : projectedEdge
          ? 0.55 + Math.min(1.25, Math.log2(Math.max(1, edgeWeight)) * 0.28)
          : 1
  }

  if (isWork && workFocusState) {
    applyWorkFocusVisuals(data, pointColors, pointSizes, linkColors, linkWidths)
  }

  return { pointColors, pointSizes, linkColors, linkWidths }
}

function applyWorkFocusVisuals (
  data: GeneratedGraph,
  pointColors: Float32Array,
  pointSizes: Float32Array,
  linkColors: Float32Array,
  linkWidths: Float32Array
): void {
  const isLight = currentConfig.theme === 'light'
  if (workFocusState?.type === 'point') {
    const focusSet = new Set([workFocusState.index])
    const neighborSet = new Set(workFocusState.neighbors)
    const secondSet = new Set(workFocusState.secondDegree)
    for (let i = 0; i < data.nodeCount; i += 1) {
      const alphaOffset = i * 4 + 3
      const currentAlpha = pointColors[alphaOffset] ?? 1
      if (focusSet.has(i)) {
        pointSizes[i] = Math.max(pointSizes[i] ?? 0, 34)
        pointColors[alphaOffset] = 1
      } else if (neighborSet.has(i)) {
        pointSizes[i] = Math.max(pointSizes[i] ?? 0, isLight ? 15.5 : 14.5)
        pointColors[alphaOffset] = Math.max(currentAlpha, isLight ? 0.92 : 0.96)
      } else if (secondSet.has(i)) {
        pointSizes[i] = Math.max(pointSizes[i] ?? 0, isLight ? 8.2 : 7.6)
        pointColors[alphaOffset] = Math.max(currentAlpha * 0.72, isLight ? 0.46 : 0.42)
      } else {
        pointColors[alphaOffset] = Math.min(currentAlpha, isLight ? 0.20 : 0.24)
      }
    }

    const directLinks = new Set(workFocusState.directLinks)
    const contextLinks = new Set(workFocusState.connectedLinks)
    for (let i = 0; i < data.edgeCount; i += 1) {
      const alphaOffset = i * 4 + 3
      const currentAlpha = linkColors[alphaOffset] ?? 1
      if (directLinks.has(i)) {
        linkWidths[i] = Math.max(linkWidths[i] ?? 0, 3.6)
        linkColors[alphaOffset] = Math.max(currentAlpha, isLight ? 0.70 : 0.80)
      } else if (contextLinks.has(i)) {
        linkWidths[i] = Math.max(linkWidths[i] ?? 0, 1.85)
        linkColors[alphaOffset] = Math.max(currentAlpha, isLight ? 0.30 : 0.36)
      } else {
        linkColors[alphaOffset] = Math.min(currentAlpha, isLight ? 0.06 : 0.08)
      }
    }
    return
  }

  if (workFocusState?.type === 'link') {
    const endpoints = new Set(workFocusState.endpoints)
    for (let i = 0; i < data.nodeCount; i += 1) {
      const alphaOffset = i * 4 + 3
      const currentAlpha = pointColors[alphaOffset] ?? 1
      if (endpoints.has(i)) {
        pointSizes[i] = Math.max(pointSizes[i] ?? 0, 18)
        pointColors[alphaOffset] = 1
      } else {
        pointColors[alphaOffset] = Math.min(currentAlpha, isLight ? 0.18 : 0.22)
      }
    }
    linkWidths[workFocusState.index] = Math.max(linkWidths[workFocusState.index] ?? 0, 4.8)
    linkColors[workFocusState.index * 4 + 3] = 1
  }
}

function applyCurrentVisualAttributes (
  graph: Graph,
  data: GeneratedGraph,
  options: { updatePoints?: boolean; updateLinks?: boolean } = {}
): void {
  const updatePoints = options.updatePoints ?? true
  const updateLinks = options.updateLinks ?? true
  const visual = buildVisualAttributes(data)
  if (updatePoints) {
    graph.setPointColors(visual.pointColors)
    graph.setPointSizes(visual.pointSizes)
  }
  if (updateLinks) {
    graph.setLinkColors(visual.linkColors)
    graph.setLinkWidths(visual.linkWidths)
  }
}

function renderDataFromFrame (frame: GraphFrame, viewSpec: ViewSpec, cfg: DemoConfig): GeneratedGraph {
  const frameData = graphFrameToVisibleGeneratedGraph(
    frame,
    viewSpec.edge.visibleKinds,
    labNodeFilterMask
      ? { pointMask: labNodeFilterMask, edgeMode: labNodeFilterEdgeMode }
      : undefined
  )
  return galleryRenderData(cfg.palette, frameData, DEMO_SPACE_SIZE)
}

function applyFrameToCurrentGraph (): void {
  const graph = currentGraph
  const frame = currentFrame
  const viewSpec = currentViewSpec
  if (!graph || !frame || !viewSpec) return
  const previousRenderData = currentRenderData
  const renderData = renderDataFromFrame(frame, viewSpec, currentConfig)
  const updatePoints = !previousRenderData ||
    previousRenderData.nodeCount !== renderData.nodeCount ||
    previousRenderData.positions !== renderData.positions
  currentRenderData = renderData
  labelAnchors = buildLabelAnchors(renderData)
  if (updatePoints) {
    graph.setPointPositions(renderData.positions, isWorkMode(currentConfig) || renderData.positions !== frame.positions)
  }
  graph.setLinks(renderData.links)
  applyCurrentVisualAttributes(graph, renderData, { updatePoints, updateLinks: true })
  graph.render()
}

function workGroupNameForPoint (index: number): string {
  if (index === 0) return 'CRM Graph'
  const groupForNode = (currentData as (GeneratedGraph & { groupForNode?: Int32Array }) | null)?.groupForNode
  const group = groupForNode?.[index]
  return group !== undefined && group >= 0
    ? WORK_GROUPS[group]?.label ?? 'Account'
    : 'Account'
}

function updateWorkFocusPanel (): void {
  const isWork = isWorkMode(currentConfig)
  focusEl.overview.disabled = !isWork || !currentGraph
  focusEl.neighbors.disabled = !isWork || !currentGraph || workFocusState?.type !== 'point'
  focusEl.step.disabled = !isWork || !currentGraph || workFocusState?.type !== 'point'

  if (!isWork) {
    focusEl.title.textContent = 'Overview'
    focusEl.subtitle.textContent = 'Work graph'
    focusEl.node.textContent = '—'
    focusEl.degree.textContent = '—'
    focusEl.links.textContent = '—'
    return
  }

  if (!workFocusState) {
    focusEl.title.textContent = 'Overview'
    focusEl.subtitle.textContent = `${(currentData?.nodeCount ?? currentConfig.n).toLocaleString()} nodes`
    focusEl.node.textContent = '—'
    focusEl.degree.textContent = '—'
    focusEl.links.textContent = '—'
    return
  }

  if (workFocusState.type === 'point') {
    focusEl.title.textContent = workGroupNameForPoint(workFocusState.index)
    focusEl.subtitle.textContent = `Point ${workFocusState.index.toLocaleString()}`
    focusEl.node.textContent = workFocusState.index.toLocaleString()
    focusEl.degree.textContent = workFocusState.degree.toLocaleString()
    focusEl.links.textContent = workFocusState.connectedLinks.length.toLocaleString()
    return
  }

  focusEl.title.textContent = 'Connection'
  focusEl.subtitle.textContent = workFocusState.endpoints.map(index => `${workGroupNameForPoint(index)} ${index}`).join(' <-> ')
  focusEl.node.textContent = workFocusState.endpoints.length.toLocaleString()
  focusEl.degree.textContent = '—'
  focusEl.links.textContent = '1'
}

function clearWorkPreview (): void {
  const graph = currentGraph
  if (!graph || workFocusState) return
  graph.setConfigPartial({
    outlinedPointIndices: undefined,
    highlightedLinkIndices: undefined,
  })
  graph.render()
}

function previewWorkPoint (index: number): void {
  const graph = currentGraph
  if (!graph || workFocusState || !isWorkMode(currentConfig)) return
  const neighbors = graph.getNeighboringPointIndices(index)
  const neighborhood = [index, ...neighbors]
  graph.setConfigPartial({
    outlinedPointIndices: neighborhood,
    highlightedLinkIndices: graph.getConnectedLinkIndices(neighborhood),
    linkGreyoutOpacity: currentConfig.theme === 'light' ? 0.18 : 0.22,
  })
  graph.render()
}

function previewWorkLink (index: number): void {
  const graph = currentGraph
  if (!graph || workFocusState || !isWorkMode(currentConfig)) return
  graph.setConfigPartial({
    outlinedPointIndices: graph.getConnectedPointIndices(index),
    highlightedLinkIndices: [index],
    linkGreyoutOpacity: currentConfig.theme === 'light' ? 0.18 : 0.22,
  })
  graph.render()
}

function directLinkIndicesForPoint (data: GeneratedGraph, index: number): number[] {
  const links: number[] = []
  for (let i = 0; i < data.edgeCount; i += 1) {
    const a = data.links[i * 2] ?? -1
    const b = data.links[i * 2 + 1] ?? -1
    if (a === index || b === index) links.push(i)
  }
  return links
}

function secondDegreeForPoint (graph: Graph, index: number, neighbors: number[]): number[] {
  const first = new Set(neighbors)
  const second = new Set<number>()
  for (const neighbor of neighbors) {
    for (const candidate of graph.getNeighboringPointIndices(neighbor)) {
      if (candidate !== index && !first.has(candidate)) second.add(candidate)
    }
  }
  return [...second]
}

function clearWorkFocus (fitOverview: boolean): void {
  const graph = currentGraph
  workFocusState = undefined
  updateWorkFocusPanel()
  if (!graph) return
  graph.setConfigPartial({
    focusedPointIndex: undefined,
    focusedLinkIndex: undefined,
    highlightedPointIndices: undefined,
    highlightedLinkIndices: undefined,
    outlinedPointIndices: undefined,
    pointGreyoutOpacity: buildGraphConfig(currentConfig).pointGreyoutOpacity,
    linkGreyoutOpacity: buildGraphConfig(currentConfig).linkGreyoutOpacity,
  })
  if (currentData) applyCurrentVisualAttributes(graph, currentData)
  if (fitOverview && isWorkMode(currentConfig)) graph.fitView(420, 0.16, false)
  graph.render()
}

function focusWorkPoint (index: number, shouldZoom: boolean): void {
  const graph = currentGraph
  const data = currentRenderData ?? currentData
  if (!graph || !data || !isWorkMode(currentConfig)) return
  const neighbors = graph.getNeighboringPointIndices(index)
  const secondDegree = secondDegreeForPoint(graph, index, neighbors)
  const neighborhood = [index, ...neighbors]
  const visiblePoints = [...new Set([...neighborhood, ...secondDegree])]
  const connectedLinks = graph.getConnectedLinkIndices(neighborhood)
  const directLinks = directLinkIndicesForPoint(data, index)
  workFocusState = {
    type: 'point',
    index,
    degree: neighbors.length,
    neighbors,
    secondDegree,
    connectedLinks,
    directLinks,
    neighborhood,
    visiblePoints,
  }
  updateWorkFocusPanel()
  graph.setConfigPartial({
    focusedPointIndex: index,
    focusedLinkIndex: undefined,
    highlightedPointIndices: visiblePoints,
    highlightedLinkIndices: connectedLinks,
    outlinedPointIndices: undefined,
    pointGreyoutOpacity: currentConfig.theme === 'light' ? 0.14 : 0.18,
    linkGreyoutOpacity: currentConfig.theme === 'light' ? 0.06 : 0.08,
  })
  applyCurrentVisualAttributes(graph, data)
  if (shouldZoom) graph.zoomToPointByIndex(index, 380, Math.max(4.8, graph.getZoomLevel()), false, false)
  graph.render()
}

function focusWorkLink (index: number, shouldZoom: boolean): void {
  const graph = currentGraph
  const data = currentData
  if (!graph || !data || !isWorkMode(currentConfig)) return
  const endpoints = graph.getConnectedPointIndices(index)
  workFocusState = { type: 'link', index, endpoints }
  updateWorkFocusPanel()
  graph.setConfigPartial({
    focusedPointIndex: undefined,
    focusedLinkIndex: index,
    highlightedPointIndices: endpoints,
    highlightedLinkIndices: [index],
    outlinedPointIndices: undefined,
    pointGreyoutOpacity: currentConfig.theme === 'light' ? 0.18 : 0.22,
    linkGreyoutOpacity: currentConfig.theme === 'light' ? 0.04 : 0.06,
  })
  applyCurrentVisualAttributes(graph, data)
  if (shouldZoom && endpoints.length > 0) graph.fitViewByPointIndices(endpoints, 360, 0.36, false)
  graph.render()
}

function fitWorkNeighborhood (): void {
  const graph = currentGraph
  if (!graph || workFocusState?.type !== 'point') return
  graph.fitViewByPointIndices(workFocusState.neighborhood, 420, 0.26, false)
}

function stepIntoWorkPoint (): void {
  const graph = currentGraph
  if (!graph || workFocusState?.type !== 'point') return
  const nextZoom = Math.min(9, Math.max(5.2, graph.getZoomLevel() + 1.35))
  graph.zoomToPointByIndex(workFocusState.index, 320, nextZoom, false, false)
}

function sampleIndices (indices: number[], limit = 80): number[] {
  return indices.length <= limit ? [...indices] : indices.slice(0, limit)
}

function boundedNeighborhoodForNode (
  graph: Graph,
  rootIndex: number,
  hops: number,
  maxNodes: number
): number[] {
  const nodeCount = currentRenderData?.nodeCount ?? currentData?.nodeCount ?? 0
  if (rootIndex < 0 || rootIndex >= nodeCount) return []
  const visited = new Set<number>([rootIndex])
  let frontier = [rootIndex]
  for (let hop = 0; hop < hops && frontier.length > 0 && visited.size < maxNodes; hop += 1) {
    const next: number[] = []
    for (const pointIndex of frontier) {
      const neighbors = graph.getNeighboringPointIndices(pointIndex)
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        next.push(neighbor)
        if (visited.size >= maxNodes) break
      }
      if (visited.size >= maxNodes) break
    }
    frontier = next
  }
  return [...visited]
}

function nodeMaskFromIndices (pointIndices: number[], nodeCount: number): Uint8Array {
  const mask = new Uint8Array(nodeCount)
  for (const index of pointIndices) {
    if (index >= 0 && index < nodeCount) mask[index] = 1
  }
  return mask
}

function linkIndicesForPointSet (
  data: GeneratedGraph,
  pointIndices: number[],
  edgeMode: 'inside' | 'incident'
): number[] {
  const pointSet = new Set(pointIndices)
  const linkIndices: number[] = []
  for (let i = 0; i < data.edgeCount; i += 1) {
    const a = data.links[i * 2] ?? -1
    const b = data.links[i * 2 + 1] ?? -1
    const aVisible = pointSet.has(a)
    const bVisible = pointSet.has(b)
    if (edgeMode === 'incident' ? aVisible || bVisible : aVisible && bVisible) {
      linkIndices.push(i)
    }
  }
  return linkIndices
}

function graphInteractionSummary (
  mode: GraphInteractionSummary['mode'],
  pointIndices: number[],
  linkIndices: number[],
  filtered: boolean,
  materialized: boolean,
  rootNode?: number,
  hops?: number,
  linkCount = linkIndices.length
): GraphInteractionSummary {
  return {
    mode,
    rootNode,
    hops,
    nodeCount: pointIndices.length,
    linkCount,
    filtered,
    materialized,
    samplePointIndices: sampleIndices(pointIndices),
    sampleLinkIndices: sampleIndices(linkIndices),
  }
}

function setLabNodeFilter (pointIndices: number[], options: NodeFilterOptions = {}): GraphInteractionSummary | null {
  const graph = currentGraph
  const frame = currentFrame
  if (!graph || !frame) return null
  const validPointIndices = [...new Set(pointIndices)]
    .filter(index => Number.isInteger(index) && index >= 0 && index < frame.nodeCount)
  const materialize = options.materialize === true
  labNodeFilterMask = null
  labNodeFilterEdgeMode = options.edgeMode ?? 'inside'
  const linkIndices = currentRenderData
    ? linkIndicesForPointSet(currentRenderData, validPointIndices, labNodeFilterEdgeMode)
    : graph.getConnectedLinkIndices(validPointIndices)
  graph.setConfigPartial({
    focusedPointIndex: undefined,
    focusedLinkIndex: undefined,
    highlightedPointIndices: validPointIndices.length > 0 ? validPointIndices : undefined,
    highlightedLinkIndices: linkIndices.length > 0 ? linkIndices : undefined,
    activePointIndices: materialize && validPointIndices.length > 0 ? validPointIndices : undefined,
    activeLinkIndices: materialize && linkIndices.length > 0 ? linkIndices : undefined,
    outlinedPointIndices: undefined,
    pointGreyoutOpacity: validPointIndices.length > 0 ? (currentConfig.theme === 'light' ? 0.10 : 0.14) : buildGraphConfig(currentConfig).pointGreyoutOpacity,
    linkGreyoutOpacity: currentConfig.theme === 'light' ? 0.05 : 0.07,
  })
  if (options.fit !== false && validPointIndices.length > 0) {
    graph.fitViewByPointIndices(validPointIndices, 320, 0.24, false)
  }
  labInteractionState = graphInteractionSummary(
    'filter',
    validPointIndices,
    linkIndices,
    validPointIndices.length > 0,
    materialize,
    undefined,
    undefined,
    linkIndices.length
  )
  graph.render()
  return labInteractionState
}

function focusLabNode (index: number, options: NodeFocusOptions = {}): GraphInteractionSummary | null {
  const graph = currentGraph
  if (!graph) return null
  const hops = Math.max(0, Math.min(4, Math.trunc(options.hops ?? 1)))
  const maxNodes = Math.max(1, Math.min(50_000, Math.trunc(options.maxNodes ?? 2_000)))
  const pointIndices = boundedNeighborhoodForNode(graph, index, hops, maxNodes)
  if (pointIndices.length === 0) return null

  const shouldFilter = options.filter === true || options.filter === 'visual' || options.filter === 'materialized'
  const materialize = options.filter === 'materialized'
  if (shouldFilter) {
    setLabNodeFilter(pointIndices, { fit: false, edgeMode: 'inside', materialize })
  }

  const linkIndices = currentRenderData
    ? linkIndicesForPointSet(currentRenderData, pointIndices, 'inside')
    : graph.getConnectedLinkIndices(pointIndices)
  graph.setConfigPartial({
    focusedPointIndex: index,
    focusedLinkIndex: undefined,
    highlightedPointIndices: pointIndices,
    highlightedLinkIndices: linkIndices.length > 0 ? linkIndices : undefined,
    activePointIndices: materialize ? pointIndices : undefined,
    activeLinkIndices: materialize ? linkIndices : undefined,
    outlinedPointIndices: undefined,
    pointGreyoutOpacity: currentConfig.theme === 'light' ? 0.10 : 0.14,
    linkGreyoutOpacity: currentConfig.theme === 'light' ? 0.05 : 0.07,
  })
  if (options.fit !== false) {
    if (pointIndices.length <= 2) graph.zoomToPointByIndex(index, 300, Math.max(4.4, graph.getZoomLevel()), false, false)
    else graph.fitViewByPointIndices(pointIndices, 320, 0.24, false)
  }
  labInteractionState = graphInteractionSummary(
    'focus',
    pointIndices,
    linkIndices,
    shouldFilter,
    materialize,
    index,
    hops,
    linkIndices.length
  )
  graph.render()
  return labInteractionState
}

function applyLabNodeExpansion (
  expansion: NeighborhoodExpansion,
  options: NodeFocusOptions = {}
): GraphInteractionSummary | null {
  const graph = currentGraph
  if (!graph) return null
  const pointIndices = expansion.pointIndices
  const linkIndices = expansion.linkIndices
  if (pointIndices.length === 0) return null
  const shouldFilter = options.filter === true || options.filter === 'visual' || options.filter === 'materialized'
  const materialize = options.filter === 'materialized'
  graph.setConfigPartial({
    focusedPointIndex: expansion.rootNode,
    focusedLinkIndex: undefined,
    highlightedPointIndices: pointIndices,
    highlightedLinkIndices: linkIndices.length > 0 ? linkIndices : undefined,
    activePointIndices: materialize ? pointIndices : undefined,
    activeLinkIndices: materialize ? linkIndices : undefined,
    outlinedPointIndices: undefined,
    pointGreyoutOpacity: currentConfig.theme === 'light' ? 0.10 : 0.14,
    linkGreyoutOpacity: currentConfig.theme === 'light' ? 0.05 : 0.07,
  })
  if (options.fit !== false) {
    if (pointIndices.length <= 2) graph.zoomToPointByIndex(expansion.rootNode, 300, Math.max(4.4, graph.getZoomLevel()), false, false)
    else graph.fitViewByPointIndices(pointIndices, 320, 0.24, false)
  }
  labInteractionState = graphInteractionSummary(
    'focus',
    pointIndices,
    linkIndices,
    shouldFilter,
    materialize,
    expansion.rootNode,
    expansion.hops,
    linkIndices.length
  )
  graph.render()
  return labInteractionState
}

function clearLabInteraction (): void {
  const graph = currentGraph
  labNodeFilterMask = null
  labNodeFilterEdgeMode = 'inside'
  labInteractionState = null
  if (!graph) return
  applyFrameToCurrentGraph()
  graph.setConfigPartial({
    focusedPointIndex: undefined,
    focusedLinkIndex: undefined,
    highlightedPointIndices: undefined,
    highlightedLinkIndices: undefined,
    activePointIndices: undefined,
    activeLinkIndices: undefined,
    outlinedPointIndices: undefined,
    pointGreyoutOpacity: buildGraphConfig(currentConfig).pointGreyoutOpacity,
    linkGreyoutOpacity: buildGraphConfig(currentConfig).linkGreyoutOpacity,
  })
  graph.render()
}

// Rolling wall-fps probe: count rAF callbacks per 500 ms window. Used by both
// the live overlay and the baseline recorder (the recorder integrates over the
// full measurement window instead of using these samples).
class WallFps {
  public latest = 0
  public displayHz = 0
  private previousTs = 0
  private readonly frameDeltas: number[] = []
  private isActive = true

  public start (): void {
    const tick = (now: number): void => {
      if (!this.isActive) return
      if (this.previousTs > 0) {
        const dt = now - this.previousTs
        // Ignore page-generation, GC, tab-switch, and debugger stalls. A single
        // long task should not make the visible FPS badge read "2 fps" for a
        // smooth scene after the stall has passed.
        if (dt > 0 && dt < 250) {
          this.frameDeltas.push(dt)
          if (this.frameDeltas.length > 45) this.frameDeltas.shift()
          this.latest = 1000 / median(this.frameDeltas)
          this.displayHz = this.latest
        }
      }
      this.previousTs = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  public stop (): void { this.isActive = false }
}

function fmtMs (s?: GpuStat): string {
  const sampleCount = typeof s?.sampleCount === 'number'
    ? s.sampleCount
    : Array.isArray(s?.samples)
      ? s.samples.length
      : typeof s?.samples === 'number'
        ? s.samples
        : 0
  const ms = typeof s?.avgMs === 'number' ? s.avgMs : s?.median
  if (!s || sampleCount === 0 || typeof ms !== 'number') return '—'
  return `${ms.toFixed(2)} ms`
}

function statMs (snap: GpuTimingSnapshot | null, key: string): number {
  const s = snap?.[key] as GpuStat | undefined
  const sampleCount = typeof s?.sampleCount === 'number'
    ? s.sampleCount
    : Array.isArray(s?.samples)
      ? s.samples.length
      : typeof s?.samples === 'number'
        ? s.samples
        : 0
  const ms = typeof s?.avgMs === 'number' ? s.avgMs : s?.median
  return sampleCount > 0 && typeof ms === 'number' ? ms : 0
}

function estimateGpuFrameMs (snap: GpuTimingSnapshot | null, graph: Graph): number {
  if (!snap) return 0
  const canvasMs = statMs(snap, 'render.canvas')
  const renderMs = canvasMs > 0
    ? canvasMs
    : statMs(snap, 'render.lines') + statMs(snap, 'render.points')
  if (!graph.isSimulationRunning) return renderMs
  const forceMs =
    statMs(snap, 'force.gravity') +
    statMs(snap, 'force.center') +
    statMs(snap, 'force.quadtree.build') +
    statMs(snap, 'force.repulsion') +
    statMs(snap, 'force.link.incoming') +
    statMs(snap, 'force.link.outgoing') +
    statMs(snap, 'force.cluster') +
    statMs(snap, 'force.mouse')
  return renderMs + forceMs
}

function effectiveDpr (host: HTMLDivElement): number {
  const canvas = document.querySelector<HTMLCanvasElement>('#graph canvas') ?? host.querySelector('canvas')
  if (!canvas) return window.devicePixelRatio
  const cssWidth = canvas.clientWidth || canvas.getBoundingClientRect().width
  if (cssWidth === 0) return window.devicePixelRatio
  return canvas.width / cssWidth
}

let currentGraph: Graph | null = null
let currentData: GeneratedGraph | null = null
let currentRenderData: GeneratedGraph | null = null
let currentSnapshot: GraphSnapshot | null = null
let currentFrame: GraphFrame | null = null
let currentViewSpec: ViewSpec | null = null
let visualLabControlPlane: VisualLabControlPlane | null = null
let labNodeFilterMask: Uint8Array | null = null
let labNodeFilterEdgeMode: GraphFrameVisibilityFilter['edgeMode'] = 'inside'
let labInteractionState: GraphInteractionSummary | null = null
let currentDataKey = ''
// Live link-attribute buffers for incremental appendEdges streaming.
let agentLinkColors: Float32Array | null = null
let agentLinkWidths: Float32Array | null = null
// Set by the explore module so node clicks reach it across graph rebuilds.
const exploreNodeClickHook: ((index: number) => void) | null = null
hydrateControlsFromUrl()
syncDependentControls()
let currentConfig: DemoConfig = readControls()
applyTheme(currentConfig.theme)
const wallFps = new WallFps()
let lastRenderSampleCount = 0
let lastRenderSampleTs = performance.now()
let renderFps: number | undefined

function exposeDebugGraph (graph: Graph): void {
  const debugWindow = window as unknown as {
    __demoGraph: Graph;
    __demoSnapshot?: GraphSnapshot | null;
    __demoFrame?: GraphFrame | null;
    __demoViewSpec?: ViewSpec | null;
    __kajillionLab?: VisualLabControlPlane | null;
    __dumpKajillionTrace: () => unknown;
    __markKajillionFlash: (label?: string) => void;
    __clearKajillionTrace: () => void;
    __runKajillionReplay: () => Promise<unknown>;
  }
  debugWindow.__demoGraph = graph
  debugWindow.__demoSnapshot = currentSnapshot
  debugWindow.__demoFrame = currentFrame
  debugWindow.__demoViewSpec = currentViewSpec
  visualLabControlPlane ||= createVisualLabControlPlane({
    getSnapshot: () => currentSnapshot,
    getFrame: () => currentFrame,
    getViewSpec: () => currentViewSpec,
    getInteractionState: () => labInteractionState,
    setSnapshot: (snapshot, frame) => {
      currentSnapshot = snapshot
      currentFrame = frame
      debugWindow.__demoSnapshot = currentSnapshot
      debugWindow.__demoFrame = currentFrame
      applyFrameToCurrentGraph()
    },
    setViewSpec: (viewSpec) => {
      currentViewSpec = viewSpec
      debugWindow.__demoViewSpec = currentViewSpec
      applyFrameToCurrentGraph()
    },
    focusNode: focusLabNode,
    applyNodeExpansion: applyLabNodeExpansion,
    setNodeFilter: setLabNodeFilter,
    clearInteraction: clearLabInteraction,
  })
  debugWindow.__kajillionLab = visualLabControlPlane
  debugWindow.__dumpKajillionTrace = () => graph.getDebugFrameTrace()
  debugWindow.__markKajillionFlash = (label = 'manual') => graph.markDebugFlash(label)
  debugWindow.__clearKajillionTrace = () => graph.clearDebugFrameTrace()
  debugWindow.__runKajillionReplay = () => runReplayCapture()
}

async function rebuildGraph (cfg: DemoConfig): Promise<void> {
  applyTheme(cfg.theme)
  overlayEl.metaN.textContent = cfg.n.toLocaleString()
  lastRenderSampleCount = 0
  lastRenderSampleTs = performance.now()
  renderFps = undefined
  if (currentGraph) {
    try { currentGraph.destroy() } catch { /* ignore */ }
    currentGraph = null
  }
  graphHost.innerHTML = ''

  // Generate (cache by n+seed so we only regen when needed)
  const dataKey = `${cfg.dataMode}:${cfg.n}:${cfg.seed}`
  const needsRegen = !currentData || currentDataKey !== dataKey
  if (needsRegen) {
    const generated = cfg.dataMode === 'work'
      ? generateWorkGraph(cfg.n, cfg.seed)
      : cfg.dataMode === 'cosmo'
        ? generateCosmoLab({ count: cfg.n, seed: cfg.seed, layoutStyle: 'organic' })
        : generateBA(cfg.n, 3, cfg.seed)
    currentData = cfg.dataMode === 'work' ? generated : scaleGeneratedDataToDemoSpace(generated)
    currentDataKey = dataKey
  }
  const data = currentData!
  const snapshot = generatedGraphToSnapshot(data, {
    datasetId: cfg.dataMode,
    graphId: `${cfg.dataMode}-${cfg.n}`,
    title: `${cfg.dataMode} ${cfg.n.toLocaleString()}`,
    generator: cfg.dataMode,
    seed: cfg.seed,
    sourceSpaceSize: DEMO_SPACE_SIZE,
  })
  const viewSpec = buildDefaultViewSpec({
    palette: cfg.palette,
    theme: cfg.theme,
    density: cfg.density,
    lanes: cfg.lanes,
    renderLinks: cfg.renderLinks,
  })
  const frame = graphFrameFromSnapshot(snapshot, viewSpec.layout)
  labNodeFilterMask = null
  labNodeFilterEdgeMode = 'inside'
  labInteractionState = null
  const renderData = renderDataFromFrame(frame, viewSpec, cfg)
  currentSnapshot = snapshot
  currentFrame = frame
  currentViewSpec = viewSpec
  currentRenderData = renderData
  labelAnchors = buildLabelAnchors(renderData)
  workFocusState = undefined
  updateWorkFocusPanel()

  const graph = new Graph(graphHost, buildGraphConfig(cfg))
  await graph.ready
  graph.setPointPositions(renderData.positions, isWorkMode(cfg) || renderData !== data)
  graph.setLinks(renderData.links)
  applyCurrentVisualAttributes(graph, renderData)
  currentGraph = graph
  // Expose for ad-hoc debugging (browser console, e2e probes). The demo is
  // explicitly a debug surface; no need to gate this.
  exposeDebugGraph(graph)
  updateWorkFocusPanel()
  graph.render()
}

async function applyControlChange (): Promise<void> {
  // Any change triggers a rebuild — simplifies state management at the cost
  // of a re-init. n=100k re-init takes ~200 ms which is fine for a control.
  currentConfig = readControls()
  syncToggleButtons()
  await rebuildGraph(currentConfig)
}

function applyVisualControls (): void {
  currentConfig = readControls()
  syncToggleButtons()
  applyTheme(currentConfig.theme)
  const graph = currentGraph
  const data = currentData
  if (!graph || !data) {
    applyControlChange().catch(err => console.error(err))
    return
  }

  const graphConfig = buildGraphConfig(currentConfig)
  graph.setConfigPartial({
    backgroundColor: graphConfig.backgroundColor,
    pointDefaultColor: graphConfig.pointDefaultColor,
    pointOpacity: graphConfig.pointOpacity,
    pointSizeScale: graphConfig.pointSizeScale,
    pointGreyoutOpacity: graphConfig.pointGreyoutOpacity,
    outlinedPointRingColor: graphConfig.outlinedPointRingColor,
    linkDefaultColor: graphConfig.linkDefaultColor,
    linkDefaultWidth: graphConfig.linkDefaultWidth,
    linkWidthScale: graphConfig.linkWidthScale,
    linkOpacity: graphConfig.linkOpacity,
    linkGreyoutOpacity: graphConfig.linkGreyoutOpacity,
    renderLinks: graphConfig.renderLinks,
    linkBlendMode: graphConfig.linkBlendMode,
    renderLodMode: graphConfig.renderLodMode,
    impostorDensityScale: graphConfig.impostorDensityScale,
    impostorTileSize: graphConfig.impostorTileSize,
    impostorMicroSplats: graphConfig.impostorMicroSplats,
    impostorTileOpacity: graphConfig.impostorTileOpacity,
    impostorExactOverlay: graphConfig.impostorExactOverlay,
    impostorExactOverlaySampleRate: graphConfig.impostorExactOverlaySampleRate,
    impostorExactOverlayOpacity: graphConfig.impostorExactOverlayOpacity,
    impostorExactOverlaySizeScale: graphConfig.impostorExactOverlaySizeScale,
    impostorSparseTileThreshold: graphConfig.impostorSparseTileThreshold,
    impostorSparseAnchorOpacity: graphConfig.impostorSparseAnchorOpacity,
    impostorAnchorsPerTile: graphConfig.impostorAnchorsPerTile,
    impostorPointSizeScale: graphConfig.impostorPointSizeScale,
    impostorCompositeStrength: graphConfig.impostorCompositeStrength,
    impostorAutoMinPoints: graphConfig.impostorAutoMinPoints,
    linkMinPixelLength: graphConfig.linkMinPixelLength,
    pointMinPixelSize: graphConfig.pointMinPixelSize,
    pointLodStrength: graphConfig.pointLodStrength,
    pointLodZoomRange: graphConfig.pointLodZoomRange,
    pointLodMinSampleRate: graphConfig.pointLodMinSampleRate,
    pointLodSizeCompensation: graphConfig.pointLodSizeCompensation,
    pointLodOpacityCompensation: graphConfig.pointLodOpacityCompensation,
    linkLodStrength: graphConfig.linkLodStrength,
    linkLodZoomRange: graphConfig.linkLodZoomRange,
    linkLodMinSampleRate: graphConfig.linkLodMinSampleRate,
    linkLodWidthCompensation: graphConfig.linkLodWidthCompensation,
    linkLodOpacityCompensation: graphConfig.linkLodOpacityCompensation,
    curvedLinks: graphConfig.curvedLinks,
    curvedLinkSegments: graphConfig.curvedLinkSegments,
    curvedLinkWeight: graphConfig.curvedLinkWeight,
    curvedLinkControlPointDistance: graphConfig.curvedLinkControlPointDistance,
    linkBundlingStrength: graphConfig.linkBundlingStrength,
    linkBundlingCellSize: graphConfig.linkBundlingCellSize,
    enableDrag: graphConfig.enableDrag,
  })
  applyCurrentVisualAttributes(graph, data)
  updateWorkFocusPanel()
  graph.render()
}

for (const button of ctlEl.nButtons) {
  button.addEventListener('click', () => {
    if (!button.dataset.n) return
    ctlEl.n.value = button.dataset.n
    if (button.dataset.mode === 'work') ctlEl.data.value = 'work'
    else if (ctlEl.data.value === 'work') ctlEl.data.value = 'cosmo'
    syncNodeButtons()
    applyControlChange().catch(err => console.error(err))
  })
}

;[ctlEl.n, ctlEl.data, ctlEl.seed, ctlEl.webgpu, ctlEl.msaa, ctlEl.adpr, ctlEl.blend, ctlEl.frameCap, ctlEl.sim]
  .forEach(el => el.addEventListener('change', () => {
    if (el === ctlEl.data && ctlEl.data.value === 'work') ctlEl.n.value = '500'
    else if (el === ctlEl.data && ctlEl.data.value !== 'work' && ctlEl.n.value === '500') ctlEl.n.value = '10000'
    syncDependentControls()
    syncNodeButtons()
    applyControlChange().catch(err => console.error(err))
  }))

for (const button of [ctlEl.density, ctlEl.edges, ctlEl.lod, ctlEl.lanes]) {
  button.addEventListener('click', () => {
    button.classList.toggle('active')
    applyVisualControls()
  })
}

ctlEl.theme.addEventListener('click', () => {
  ctlEl.theme.classList.toggle('active')
  applyVisualControls()
})

focusEl.overview.addEventListener('click', () => {
  clearWorkFocus(true)
})

focusEl.neighbors.addEventListener('click', () => {
  fitWorkNeighborhood()
})

focusEl.step.addEventListener('click', () => {
  stepIntoWorkPoint()
})

function syncGalleryButtons (): void {
  for (const card of ctlEl.presetCards) {
    const preset = parsePaletteParam(card.dataset.preset ?? null)
    const isActive = preset === currentConfig.palette
    card.classList.toggle('active', isActive)
    card.setAttribute('aria-pressed', String(isActive))
  }
}

function setGalleryOpen (open: boolean): void {
  ctlEl.gallery.classList.toggle('open', open)
  ctlEl.galleryTab.setAttribute('aria-expanded', String(open))
}

function applyGalleryPreset (preset: DemoConfig['palette']): void {
  const previousPalette = currentConfig.palette
  const params = new URLSearchParams(window.location.search)
  if (preset === 'category') params.delete('palette')
  else params.set('palette', preset)
  for (const [key, value] of Object.entries(galleryPresetUrlDefaults(preset))) {
    if (value === null) params.delete(key)
    else params.set(key, value)
  }
  const query = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  hydrateControlsFromUrl()
  currentConfig = readControls()
  syncToggleButtons()
  if (
    previousPalette === 'tokyo' ||
    preset === 'tokyo' ||
    previousPalette === 'subnet' ||
    preset === 'subnet' ||
    previousPalette === 'signal' ||
    preset === 'signal' ||
    previousPalette === 'insight' ||
    preset === 'insight' ||
    previousPalette === 'fintech' ||
    preset === 'fintech' ||
    previousPalette === 'influence' ||
    preset === 'influence' ||
    previousPalette === 'talent' ||
    preset === 'talent'
  ) {
    rebuildGraph(currentConfig).catch(err => console.error(err))
  } else {
    applyVisualControls()
  }
}

ctlEl.galleryTab.addEventListener('click', () => {
  setGalleryOpen(!ctlEl.gallery.classList.contains('open'))
})

ctlEl.galleryClose.addEventListener('click', () => {
  setGalleryOpen(false)
})

for (const card of ctlEl.presetCards) {
  card.addEventListener('click', () => {
    applyGalleryPreset(parsePaletteParam(card.dataset.preset ?? null))
  })
}

function paintOverlay (): void {
  const g = currentGraph ?? (window as unknown as { __demoGraph?: Graph }).__demoGraph ?? null
  if (!g) {
    overlayEl.wall.textContent = '—'
    return
  }
  const snap = g.getGpuTimings() as GpuTimingSnapshot | null
  overlayEl.wall.textContent = `${wallFps.latest.toFixed(1)} fps`
  const renderSampleCount =
    ((snap?.['render.canvas'] as GpuStat | undefined)?.sampleCount ?? 0) ||
    Math.max(
      (snap?.['render.lines'] as GpuStat | undefined)?.sampleCount ?? 0,
      (snap?.['render.points'] as GpuStat | undefined)?.sampleCount ?? 0
    )
  const now = performance.now()
  const renderSampleDelta = renderSampleCount - lastRenderSampleCount
  const renderTimeDelta = now - lastRenderSampleTs
  if (renderSampleDelta < 0) {
    lastRenderSampleCount = renderSampleCount
    lastRenderSampleTs = now
    renderFps = undefined
  } else if (renderSampleDelta > 0 && renderTimeDelta >= 500) {
    renderFps = renderSampleDelta * 1000 / renderTimeDelta
    lastRenderSampleCount = renderSampleCount
    lastRenderSampleTs = now
  }
  const hasRenderFps = renderFps !== undefined && Number.isFinite(renderFps)
  const shouldShowRenderFps = hasRenderFps && (g.isSimulationRunning || renderFps >= 5)
  overlayEl.render.textContent = renderSampleCount > 0
    ? (shouldShowRenderFps ? `${renderFps.toFixed(1)} fps` : g.isSimulationRunning ? 'sampling' : 'settled')
    : '—'
  const gpuFrameMs = estimateGpuFrameMs(snap, g)
  const pacing = g.getFramePacingStats()
  overlayEl.budget.textContent = gpuFrameMs > 0 ? `${(1000 / gpuFrameMs).toFixed(0)} fps` : '—'
  overlayEl.display.textContent = pacing.estimatedRefreshHz > 0 ? `${pacing.estimatedRefreshHz.toFixed(1)} hz` : '—'
  overlayEl.target.textContent = pacing.targetFps > 0 ? `${pacing.targetFps.toFixed(0)} fps` : 'native'
  overlayEl.skip.textContent = `${(pacing.skipRatio * 100).toFixed(1)}%`
  overlayEl.cap.textContent = currentConfig.frameRateLimit > 0
    ? `${currentConfig.frameRateLimit.toFixed(0)} fps`
    : currentConfig.frameRateHeadroomFps > 0
      ? `display -${currentConfig.frameRateHeadroomFps.toFixed(0)}`
      : 'native'
  overlayEl.quad.textContent = fmtMs(snap?.['force.quadtree.build'] as GpuStat | undefined)
  overlayEl.rep.textContent = fmtMs(snap?.['force.repulsion'] as GpuStat | undefined)
  const linMs = statMs(snap, 'force.link.incoming')
  const loutMs = statMs(snap, 'force.link.outgoing')
  overlayEl.link.textContent = (linMs + loutMs) > 0 ? `${(linMs + loutMs).toFixed(2)} ms` : '—'
  overlayEl.grav.textContent = fmtMs(snap?.['force.gravity'] as GpuStat | undefined)
  overlayEl.canvas.textContent = fmtMs(snap?.['render.canvas'] as GpuStat | undefined)
  overlayEl.linesCull.textContent = fmtMs(snap?.['render.lines.cull'] as GpuStat | undefined)
  overlayEl.lines.textContent = fmtMs(snap?.['render.lines'] as GpuStat | undefined)
  overlayEl.pointsCull.textContent = fmtMs(snap?.['render.points.cull'] as GpuStat | undefined)
  overlayEl.points.textContent = fmtMs(snap?.['render.points'] as GpuStat | undefined)
  overlayEl.alpha.textContent = `${g.progress.toFixed(3)}${g.isSimulationRunning ? '' : ' (settled)'}`
  overlayEl.dpr.textContent = effectiveDpr(graphHost).toFixed(2)
}

function startOverlayLoop (): void {
  const loop = (): void => {
    paintOverlay()
    setTimeout(loop, 250)
  }
  loop()
}

/* ────────────────────────────  Baseline recorder  ────────────────────────── */

interface BaselineRun {
  wallFps: number;
  wallFpsIdle: number;
  gpuTimings: GpuTimingSnapshot;
}

function delay (ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function downloadBlob (blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

async function measureWallFps (windowMs: number): Promise<number> {
  let frames = 0
  let active = true
  const tick = (): void => {
    if (!active) return
    frames += 1
    requestAnimationFrame(tick)
  }
  const start = performance.now()
  requestAnimationFrame(tick)
  await delay(windowMs)
  active = false
  const elapsed = performance.now() - start
  return elapsed > 0 ? (frames * 1000) / elapsed : 0
}

async function recordSingleRun (
  data: GeneratedGraph,
  cfg: DemoConfig,
  warmupMs: number,
  measureMs: number,
  status: (s: string) => void
): Promise<BaselineRun> {
  // Tear down current graph + create a fresh one for clean timing buckets.
  if (currentGraph) {
    try { currentGraph.destroy() } catch { /* ignore */ }
    currentGraph = null
  }
  graphHost.innerHTML = ''
  const graph = new Graph(graphHost, buildGraphConfig(cfg))
  currentGraph = graph
  await graph.ready
  const renderData = galleryRenderData(cfg.palette, data, DEMO_SPACE_SIZE)
  const visual = buildVisualAttributes(renderData)
  graph.setPointPositions(renderData.positions, isWorkMode(cfg) || renderData !== data)
  graph.setPointColors(visual.pointColors)
  graph.setPointSizes(visual.pointSizes)
  graph.setLinks(renderData.links)
  graph.setLinkColors(visual.linkColors)
  graph.setLinkWidths(visual.linkWidths)
  graph.render()

  status(`warmup ${warmupMs} ms…`)
  await delay(warmupMs)
  graph.resetGpuTimings()

  // Active-sim wall fps over measureMs.
  status(`measuring active ${measureMs} ms…`)
  const wallFpsActive = await measureWallFps(measureMs)
  const gpuTimings = graph.getGpuTimings() ?? {}

  // Idle wall fps: wait a bit past settle, then measure again. Cap at 6 s of
  // additional wait — if sim hasn't settled by then, surface 0 for idle.
  status('waiting for settle…')
  const settleDeadline = performance.now() + 6000
  while (graph.isSimulationRunning && performance.now() < settleDeadline) {
    await delay(100)
  }
  let wallFpsIdle = 0
  if (!graph.isSimulationRunning) {
    status('measuring idle 2000 ms…')
    wallFpsIdle = await measureWallFps(2000)
  }

  return { wallFps: wallFpsActive, wallFpsIdle, gpuTimings: gpuTimings as GpuTimingSnapshot }
}

function median (xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function aggregateGpu (runs: BaselineRun[]): Record<string, { median: number; min: number; max: number; runs: number }> {
  const keys = new Set<string>()
  for (const r of runs) Object.keys(r.gpuTimings).forEach(k => keys.add(k))
  const out: Record<string, { median: number; min: number; max: number; runs: number }> = {}
  for (const k of keys) {
    const medians: number[] = []
    for (const r of runs) {
      const ms = statMs(r.gpuTimings, k)
      if (ms > 0) medians.push(ms)
    }
    if (medians.length === 0) continue
    out[k] = {
      median: median(medians),
      min: Math.min(...medians),
      max: Math.max(...medians),
      runs: medians.length,
    }
  }
  return out
}

async function recordBaseline (): Promise<void> {
  ctlEl.record.disabled = true
  const cfg = currentConfig
  const data = currentData!
  const repeats = 5
  const warmupMs = 2000
  const measureMs = 8000

  const status = (s: string): void => { ctlEl.recordStatus.textContent = s }
  const runs: BaselineRun[] = []
  try {
    for (let i = 0; i < repeats; i += 1) {
      status(`run ${i + 1}/${repeats}: starting`)
      const r = await recordSingleRun(data, cfg, warmupMs, measureMs, (s) => {
        status(`run ${i + 1}/${repeats}: ${s}`)
      })
      runs.push(r)
    }

    const payload = {
      schemaVersion: 1,
      label: 'baseline',
      timestamp: new Date().toISOString(),
      ua: navigator.userAgent,
      config: cfg,
      graph: { nodeCount: data.nodeCount, edgeCount: data.edgeCount },
      protocol: { repeats, warmupMs, measureMs },
      wallFps: {
        active: { median: median(runs.map(r => r.wallFps)), runs: runs.map(r => r.wallFps) },
        idle: { median: median(runs.map(r => r.wallFpsIdle)), runs: runs.map(r => r.wallFpsIdle) },
      },
      gpuTimings: aggregateGpu(runs),
    }
    status('uploading…')
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    const body = JSON.stringify(payload, null, 2)
    try {
      const resp = await fetch('/record-baseline', {
        method: 'POST',
        headers,
        body,
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json() as { savedTo: string }
      status(`saved · ${json.savedTo.split('/').slice(-2).join('/')}`)
    } catch {
      downloadBlob(new Blob([body], { type: 'application/json' }), `kajillion-baseline-${payload.timestamp}.json`)
      status('downloaded baseline json')
    }
  } catch (err) {
    status(`error: ${(err as Error).message}`)
  } finally {
    ctlEl.record.disabled = false
    // Restore live-overlay graph
    rebuildGraph(currentConfig).catch(err => console.error(err))
  }
}

ctlEl.record.addEventListener('click', () => { recordBaseline().catch(err => console.error(err)) })

/* ────────────────────────────  Replay recorder  ─────────────────────────── */

type MemorySnapshot = {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

interface ReplaySample {
  t: number;
  step: string;
  wallFps: number;
  renderFps: number | null;
  gpuFrameMs: number;
  dpr: number;
  alpha: number;
  simulationRunning: boolean;
  pacing: ReturnType<Graph['getFramePacingStats']>;
  memory?: MemorySnapshot;
}

interface ReplayStepSummary {
  name: string;
  durationMs: number;
  samples: number;
  wallFpsMedian: number;
  gpuFrameMsMedian: number;
  dprMedian: number;
  skipRatioMax: number;
}

function percentile (xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? 0
}

function memorySnapshot (): MemorySnapshot | undefined {
  const memory = (performance as Performance & {
    memory?: MemorySnapshot;
  }).memory
  if (!memory) return undefined
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  }
}

function collectReplaySample (graph: Graph, step: string, replayStart: number): ReplaySample {
  const snap = graph.getGpuTimings() as GpuTimingSnapshot | null
  return {
    t: performance.now() - replayStart,
    step,
    wallFps: wallFps.latest,
    renderFps: Number.isFinite(renderFps) ? renderFps ?? null : null,
    gpuFrameMs: estimateGpuFrameMs(snap, graph),
    dpr: effectiveDpr(graphHost),
    alpha: graph.progress,
    simulationRunning: graph.isSimulationRunning,
    pacing: graph.getFramePacingStats(),
    memory: memorySnapshot(),
  }
}

function summarizeReplayStep (name: string, durationMs: number, samples: ReplaySample[]): ReplayStepSummary {
  const stepSamples = samples.filter(sample => sample.step === name)
  return {
    name,
    durationMs,
    samples: stepSamples.length,
    wallFpsMedian: median(stepSamples.map(sample => sample.wallFps).filter(Number.isFinite)),
    gpuFrameMsMedian: median(stepSamples.map(sample => sample.gpuFrameMs).filter(ms => Number.isFinite(ms) && ms > 0)),
    dprMedian: median(stepSamples.map(sample => sample.dpr).filter(Number.isFinite)),
    skipRatioMax: Math.max(0, ...stepSamples.map(sample => sample.pacing.skipRatio).filter(Number.isFinite)),
  }
}

function findNearestPointIndex (data: GeneratedGraph, nx: number, ny: number): number {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < data.nodeCount; i += 1) {
    const x = data.positions[i * 2] ?? DEMO_SPACE_SIZE / 2
    const y = data.positions[i * 2 + 1] ?? DEMO_SPACE_SIZE / 2
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const targetX = minX + (maxX - minX) * nx
  const targetY = minY + (maxY - minY) * ny
  let bestIndex = 0
  let bestDistanceSq = Infinity
  for (let i = 0; i < data.nodeCount; i += 1) {
    const x = data.positions[i * 2] ?? targetX
    const y = data.positions[i * 2 + 1] ?? targetY
    const dx = x - targetX
    const dy = y - targetY
    const distanceSq = dx * dx + dy * dy
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq
      bestIndex = i
    }
  }
  return bestIndex
}

function pointPositionForIndex (data: GeneratedGraph, index: number): Float32Array {
  const i = Math.max(0, Math.min(data.nodeCount - 1, index))
  return new Float32Array([
    data.positions[i * 2] ?? DEMO_SPACE_SIZE / 2,
    data.positions[i * 2 + 1] ?? DEMO_SPACE_SIZE / 2,
  ])
}

function dispatchMouseMoveInGraph (x: number, y: number): void {
  const canvas = graphHost.querySelector('canvas')
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  canvas.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + x,
    clientY: rect.top + y,
  }))
}

async function runMeasuredReplayStep (
  graph: Graph,
  name: string,
  durationMs: number,
  samples: ReplaySample[],
  replayStart: number,
  action: (elapsed: number, progress: number) => void | Promise<void>,
  status: (s: string) => void
): Promise<ReplayStepSummary> {
  status(`${name}…`)
  const stepStart = performance.now()
  await action(0, 0)
  let lastSample = 0
  while (performance.now() - stepStart < durationMs) {
    const elapsed = performance.now() - stepStart
    const progress = Math.max(0, Math.min(1, elapsed / durationMs))
    await action(elapsed, progress)
    if (elapsed - lastSample >= 200) {
      samples.push(collectReplaySample(graph, name, replayStart))
      lastSample = elapsed
    }
    await delay(16)
  }
  samples.push(collectReplaySample(graph, name, replayStart))
  return summarizeReplayStep(name, durationMs, samples)
}

async function runReplayCapture (): Promise<unknown> {
  if (isReplayInProgress) return null
  const graph = currentGraph
  const data = currentData
  if (!graph || !data) {
    ctlEl.replayStatus.textContent = 'no graph loaded'
    return null
  }

  isReplayInProgress = true
  ctlEl.record.disabled = true
  updateBakeLoadButtons()
  const status = (s: string): void => { ctlEl.replayStatus.textContent = s }
  const samples: ReplaySample[] = []
  const summaries: ReplayStepSummary[] = []
  const replayStart = performance.now()
  const focusA = findNearestPointIndex(data, 0.30, 0.53)
  const focusB = findNearestPointIndex(data, 0.72, 0.46)
  const hostRect = graphHost.getBoundingClientRect()

  try {
    status('warming…')
    graph.clearDebugFrameTrace()
    graph.resetGpuTimings()
    await delay(800)

    summaries.push(await runMeasuredReplayStep(
      graph,
      'overview-fit',
      900,
      samples,
      replayStart,
      async (_elapsed, progress) => {
        if (progress === 0) graph.setZoomTransformByPointPositions(data.positions, 520, undefined, 0.14, false)
      },
      status
    ))

    summaries.push(await runMeasuredReplayStep(
      graph,
      'focus-left-community',
      1000,
      samples,
      replayStart,
      async (_elapsed, progress) => {
        if (progress === 0) graph.setZoomTransformByPointPositions(pointPositionForIndex(data, focusA), 560, 2.8, 0.16, false)
      },
      status
    ))

    summaries.push(await runMeasuredReplayStep(
      graph,
      'hover-sweep',
      1400,
      samples,
      replayStart,
      (_elapsed, progress) => {
        const x = hostRect.width * (0.24 + 0.52 * progress)
        const y = hostRect.height * (0.40 + 0.16 * Math.sin(progress * Math.PI * 2))
        dispatchMouseMoveInGraph(x, y)
      },
      status
    ))

    summaries.push(await runMeasuredReplayStep(
      graph,
      'focus-right-community',
      1000,
      samples,
      replayStart,
      async (_elapsed, progress) => {
        if (progress === 0) graph.setZoomTransformByPointPositions(pointPositionForIndex(data, focusB), 560, 3.4, 0.16, false)
      },
      status
    ))

    summaries.push(await runMeasuredReplayStep(
      graph,
      'return-overview',
      900,
      samples,
      replayStart,
      async (_elapsed, progress) => {
        if (progress === 0) graph.setZoomTransformByPointPositions(data.positions, 520, undefined, 0.14, false)
      },
      status
    ))

    const gpuTimings = graph.getGpuTimings() ?? {}
    const payload = {
      schemaVersion: 1,
      label: 'deterministic-replay',
      timestamp: new Date().toISOString(),
      ua: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      config: currentConfig,
      graph: { nodeCount: data.nodeCount, edgeCount: data.edgeCount },
      protocol: {
        sampleIntervalMs: 200,
        steps: summaries.map(({ name, durationMs }) => ({ name, durationMs })),
        focusIndices: [focusA, focusB],
      },
      summary: {
        wallFpsP50: percentile(samples.map(sample => sample.wallFps), 50),
        wallFpsP05: percentile(samples.map(sample => sample.wallFps), 5),
        gpuFrameMsP50: percentile(samples.map(sample => sample.gpuFrameMs).filter(ms => ms > 0), 50),
        gpuFrameMsP95: percentile(samples.map(sample => sample.gpuFrameMs).filter(ms => ms > 0), 95),
        maxSkipRatio: Math.max(0, ...samples.map(sample => sample.pacing.skipRatio)),
        dprMin: Math.min(...samples.map(sample => sample.dpr)),
        dprMax: Math.max(...samples.map(sample => sample.dpr)),
      },
      steps: summaries,
      samples,
      gpuTimings,
      debugFrameTraceTail: graph.getDebugFrameTrace().slice(-240),
    }

    const body = JSON.stringify(payload, null, 2)
    status('uploading replay…')
    try {
      const resp = await fetch('/record-replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json() as { savedTo: string }
      status(`saved · ${json.savedTo.split('/').slice(-2).join('/')}`)
    } catch {
      downloadBlob(new Blob([body], { type: 'application/json' }), `kajillion-replay-${payload.timestamp}.json`)
      status('downloaded replay json')
    }
    return payload
  } catch (err) {
    status(`error: ${(err as Error).message}`)
    throw err
  } finally {
    isReplayInProgress = false
    ctlEl.record.disabled = false
    updateBakeLoadButtons()
  }
}

ctlEl.replay.addEventListener('click', () => { runReplayCapture().catch(err => console.error(err)) })

/* ────────────────────────────  Bake & Load  ─────────────────────────────── */

function updateBakeLoadButtons (): void {
  const busy = isBakeInProgress || isLoadInProgress || isReplayInProgress
  ctlEl.bake.disabled = busy
  ctlEl.load.disabled = busy
  ctlEl.replay.disabled = busy
}

function isHtmlFallbackResponse (buf: ArrayBuffer, contentType: string): boolean {
  if (contentType.toLowerCase().includes('text/html')) return true
  if (buf.byteLength < 4) return false
  const bytes = new Uint8Array(buf, 0, 4)
  return bytes[0] === 0x3c && bytes[1] === 0x21 && bytes[2] === 0x64 && bytes[3] === 0x6f
}

async function bakeCurrentLayout (): Promise<void> {
  if (isBakeInProgress || isLoadInProgress) return
  const graph = currentGraph
  const data = currentData
  if (!graph || !data) {
    ctlEl.bakeStatus.textContent = 'no graph loaded'
    return
  }
  isBakeInProgress = true
  updateBakeLoadButtons()
  ctlEl.loadStatus.textContent = 'load disabled while baking'
  const label = ctlEl.bakeLabel.value.trim() || 'default'
  const pointsOnly = ctlEl.bakePointsOnly.checked
  try {
    // Reset alpha to 1 so the simulation gets full energy starting NOW,
    // regardless of how long ago the graph was generated. Without this,
    // the time-based alpha decay (~500 ms default) may have already
    // pushed the engine to "settled" before the user clicked Bake — the
    // wait loop would exit immediately and we'd save initial positions.
    graph.start(1)
    // Wait for the RAF-driven frame loop to actually settle. With
    // decay=500 and a fresh alpha=1, settle is ~1.5 s of wall time at
    // small n, more at large n (each frame's sim step is slower). Cap
    // at 90 s to allow 1M to settle properly while still bounding the
    // wait. The progress reading goes from ~0.22 (alpha=1) to 1.0
    // (alpha = stopThreshold).
    const settleDeadline = performance.now() + 90_000
    while (graph.isSimulationRunning && performance.now() < settleDeadline) {
      ctlEl.bakeStatus.textContent = `settling… progress ${graph.progress.toFixed(3)}`
      await delay(200)
    }
    if (graph.isSimulationRunning) {
      ctlEl.bakeStatus.textContent = 'warning: sim still running at 90 s, baking mid-state'
    } else {
      ctlEl.bakeStatus.textContent = 'settled · reading back…'
    }
    // Give the engine one more RAF tick so the final syncPositionStorageBuffer
    // call in renderFrame copies the final currentPositionTexture into the
    // storage buffer that readback reads from. Without this we can race
    // and capture the second-to-last state.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const positions = await graph.readbackPointPositions()
    if (positions.length === 0) {
      ctlEl.bakeStatus.textContent = 'error: empty readback (WebGPU only)'
      return
    }
    const blob = encodeBaked({
      nodeCount: data.nodeCount,
      edgeCount: pointsOnly ? 0 : data.edgeCount,
      positions,
      links: pointsOnly ? new Float32Array(0) : data.links,
    })
    const totalMb = (blob.byteLength / (1024 * 1024)).toFixed(2)
    ctlEl.bakeStatus.textContent = `uploading ${totalMb} MB…`
    const headers = new Headers()
    headers.set('Content-Type', 'application/octet-stream')
    try {
      const resp = await fetch(`/bake?label=${encodeURIComponent(label)}`, {
        method: 'POST',
        headers,
        body: blob,
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
      const json = await resp.json() as { savedTo: string; bytes: number }
      ctlEl.bakeStatus.textContent = `saved · ${json.savedTo.split('/').pop()} · ${(json.bytes / (1024 * 1024)).toFixed(2)} MB`
      ctlEl.loadStatus.textContent = `ready · baked-${label}.bin`
    } catch {
      downloadBlob(new Blob([blob], { type: 'application/octet-stream' }), `baked-${label}.bin`)
      ctlEl.bakeStatus.textContent = `downloaded · ${(blob.byteLength / (1024 * 1024)).toFixed(2)} MB`
      ctlEl.loadStatus.textContent = 'ready after placing downloaded file in demo/public'
    }
  } catch (err) {
    ctlEl.bakeStatus.textContent = `error: ${(err as Error).message}`
  } finally {
    isBakeInProgress = false
    updateBakeLoadButtons()
  }
}

async function loadBakedLayout (): Promise<void> {
  if (isBakeInProgress) {
    ctlEl.loadStatus.textContent = 'wait for bake to finish'
    return
  }
  if (isLoadInProgress) return
  const label = ctlEl.bakeLabel.value.trim() || 'default'
  isLoadInProgress = true
  updateBakeLoadButtons()
  try {
    ctlEl.loadStatus.textContent = `fetching baked-${label}.bin…`
    const resp = await fetch(`/baked-${encodeURIComponent(label)}.bin`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buf = await resp.arrayBuffer()
    const contentType = resp.headers.get('Content-Type') ?? ''
    if (isHtmlFallbackResponse(buf, contentType)) {
      throw new Error(`no baked layout named "${label}"`)
    }
    const layout = decodeBaked(buf)
    ctlEl.loadStatus.textContent = `decoded: ${layout.nodeCount.toLocaleString()} nodes, ${layout.edgeCount.toLocaleString()} edges. Rendering…`

    // Tear down the live (sim-active) graph and rebuild with the baked
    // positions, simulation disabled. The visitor sees a settled graph at
    // scale — the audit's "headline screenshot the engine has earned".
    if (currentGraph) {
      try { currentGraph.destroy() } catch { /* ignore */ }
      currentGraph = null
    }
    graphHost.innerHTML = ''
    const cfg: DemoConfig = { ...currentConfig, sim: false }
    const gcfg = buildGraphConfig(cfg)
    const graph = new Graph(graphHost, gcfg)
    await graph.ready
    const loadedData = {
      positions: layout.positions,
      links: layout.links,
      nodeCount: layout.nodeCount,
      edgeCount: layout.edgeCount,
    }
    const renderData = galleryRenderData(currentConfig.palette, loadedData, DEMO_SPACE_SIZE)
    const visual = buildVisualAttributes(renderData)
    graph.setPointPositions(renderData.positions, true /* dontRescale: positions are already in spaceSize */)
    graph.setPointColors(visual.pointColors)
    graph.setPointSizes(visual.pointSizes)
    if (layout.edgeCount > 0) graph.setLinks(renderData.links)
    if (layout.edgeCount > 0) graph.setLinkColors(visual.linkColors)
    if (layout.edgeCount > 0) graph.setLinkWidths(visual.linkWidths)
    graph.render()
    currentGraph = graph
    currentData = loadedData
    currentRenderData = renderData
    overlayEl.metaN.textContent = `${layout.nodeCount.toLocaleString()} (baked)`
    exposeDebugGraph(graph)
    ctlEl.loadStatus.textContent = `loaded · ${(buf.byteLength / (1024 * 1024)).toFixed(2)} MB`
  } catch (err) {
    ctlEl.loadStatus.textContent = `error: ${(err as Error).message}`
  } finally {
    isLoadInProgress = false
    updateBakeLoadButtons()
  }
}

ctlEl.bake.addEventListener('click', () => { bakeCurrentLayout().catch(err => console.error(err)) })
ctlEl.load.addEventListener('click', () => { loadBakedLayout().catch(err => console.error(err)) })

/* ────────────────────────────  Agent API  ───────────────────────────────── */

interface AgentGraphNode {
  id?: string | number;
  label?: string;
  x?: number;
  y?: number;
}

interface AgentGraphEdge {
  source: string | number;
  target: string | number;
}

interface AgentGraphPayload {
  nodeCount?: number;
  edgeCount?: number;
  positions?: number[];
  links?: number[];
  nodes?: AgentGraphNode[];
  edges?: AgentGraphEdge[];
}

type AgentCommand =
  | { type: 'loadGraph'; graph: AgentGraphPayload; options?: { title?: string; graphId?: string; fit?: boolean; workMode?: boolean } }
  | { type: 'appendEdges'; links: number[] }
  | { type: 'focusNode'; index: number; options?: NodeFocusOptions & { async?: boolean } }
  | { type: 'filterNodes'; pointIndices: number[]; options?: NodeFilterOptions }
  | { type: 'clearInteraction' }
  | { type: 'setVisibleEdgeKinds'; visibleKinds: Array<'observed' | 'second_degree' | 'predicted'> }
  | { type: 'secondDegreeProjection'; options?: Parameters<VisualLabControlPlane['runSecondDegreeProjection']>[0] }

interface AgentCommandEnvelope {
  id: number;
  command: AgentCommand;
}

function finiteNumber (value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function agentGraphPayloadToGeneratedGraph (payload: AgentGraphPayload): GeneratedGraph {
  if (Array.isArray(payload.positions) && Array.isArray(payload.links)) {
    const nodeCount = payload.nodeCount ?? Math.floor(payload.positions.length / 2)
    const edgeCount = payload.edgeCount ?? Math.floor(payload.links.length / 2)
    if (nodeCount < 0 || edgeCount < 0) throw new Error('nodeCount and edgeCount must be non-negative')
    if (payload.positions.length < nodeCount * 2) throw new Error('positions length is shorter than nodeCount * 2')
    if (payload.links.length < edgeCount * 2) throw new Error('links length is shorter than edgeCount * 2')
    return {
      positions: new Float32Array(payload.positions.slice(0, nodeCount * 2)),
      links: new Float32Array(payload.links.slice(0, edgeCount * 2)),
      nodeCount,
      edgeCount,
    }
  }

  if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
    throw new Error('loadGraph expects either {positions, links} or {nodes, edges}')
  }

  const nodes = payload.nodes
  const edges = payload.edges
  const nodeCount = nodes.length
  const positions = new Float32Array(nodeCount * 2)
  const idToIndex = new Map<string, number>()
  for (let i = 0; i < nodeCount; i += 1) {
    const node = nodes[i] ?? {}
    idToIndex.set(String(node.id ?? i), i)
    const hasPosition = finiteNumber(node.x) && finiteNumber(node.y)
    if (hasPosition) {
      positions[i * 2] = node.x
      positions[i * 2 + 1] = node.y
    } else {
      const angle = (i / Math.max(1, nodeCount)) * Math.PI * 2
      const radius = DEMO_SPACE_SIZE * (0.18 + 0.22 * ((i * 2654435761 % 997) / 997))
      positions[i * 2] = DEMO_SPACE_SIZE / 2 + Math.cos(angle) * radius
      positions[i * 2 + 1] = DEMO_SPACE_SIZE / 2 + Math.sin(angle) * radius
    }
  }

  const links: number[] = []
  for (const edge of edges) {
    const source = typeof edge.source === 'number' ? edge.source : idToIndex.get(String(edge.source))
    const target = typeof edge.target === 'number' ? edge.target : idToIndex.get(String(edge.target))
    if (source === undefined || target === undefined) continue
    if (source < 0 || source >= nodeCount || target < 0 || target >= nodeCount) continue
    links.push(source, target)
  }

  return {
    positions,
    links: new Float32Array(links),
    nodeCount,
    edgeCount: links.length / 2,
  }
}

async function installAgentGraph (payload: AgentGraphPayload, options: { title?: string; graphId?: string; fit?: boolean; workMode?: boolean } = {}): Promise<unknown> {
  const data = agentGraphPayloadToGeneratedGraph(payload)
  const cfg: DemoConfig = {
    ...currentConfig,
    n: data.nodeCount,
    dataMode: options.workMode === false ? 'cosmo' : 'work',
    sim: false,
    renderLinks: data.edgeCount > 0,
    palette: currentConfig.palette,
  }
  currentConfig = cfg
  currentData = data
  currentDataKey = `agent:${options.graphId ?? Date.now()}:${data.nodeCount}:${data.edgeCount}`
  if (currentGraph) {
    try { currentGraph.destroy() } catch { /* ignore */ }
    currentGraph = null
  }
  graphHost.innerHTML = ''
  const graph = new Graph(graphHost, buildGraphConfig(cfg))
  await graph.ready
  currentGraph = graph
  const snapshot = generatedGraphToSnapshot(data, {
    datasetId: 'agent',
    graphId: options.graphId ?? `agent-${data.nodeCount}-${data.edgeCount}`,
    title: options.title ?? 'Agent graph',
    generator: 'agent-api',
    sourceSpaceSize: DEMO_SPACE_SIZE,
  })
  const viewSpec = buildDefaultViewSpec({
    palette: cfg.palette,
    theme: cfg.theme,
    density: cfg.density,
    lanes: cfg.lanes,
    renderLinks: cfg.renderLinks,
  })
  const frame = graphFrameFromSnapshot(snapshot, viewSpec.layout)
  const renderData = renderDataFromFrame(frame, viewSpec, cfg)
  currentSnapshot = snapshot
  currentFrame = frame
  currentViewSpec = viewSpec
  currentRenderData = renderData
  labNodeFilterMask = null
  labNodeFilterEdgeMode = 'inside'
  labInteractionState = null
  labelAnchors = buildLabelAnchors(renderData)
  workFocusState = undefined
  const visual = buildVisualAttributes(renderData)
  agentLinkColors = visual.linkColors
  agentLinkWidths = visual.linkWidths
  graph.setPointPositions(renderData.positions, true)
  graph.setPointColors(visual.pointColors)
  graph.setPointSizes(visual.pointSizes)
  graph.setLinks(renderData.links)
  graph.setLinkColors(visual.linkColors)
  graph.setLinkWidths(visual.linkWidths)
  graph.render()
  overlayEl.metaN.textContent = `${data.nodeCount.toLocaleString()} (agent)`
  exposeDebugGraph(graph)
  if (options.fit !== false) graph.fitView(240, 0.18, false)
  return {
    nodeCount: data.nodeCount,
    edgeCount: data.edgeCount,
    graphId: snapshot.metadata.graphId,
  }
}

/**
 * Incrementally appends edges to the live graph without rebuilding it.
 * Used by the explore module to stream a network's mesh in after the
 * skeleton (positions + spokes) has already loaded. `pairs` is a flat
 * array of node-index pairs into the current graph.
 */
function appendEdgesToCurrentGraph (pairs: number[]): { edgeCount: number } {
  const graph = currentGraph
  const rd = currentRenderData
  if (!graph || !rd) throw new Error('appendEdges: no active graph')
  if (pairs.length === 0 || pairs.length % 2 !== 0) {
    return { edgeCount: rd.edgeCount }
  }
  const addedEdges = pairs.length / 2
  const oldLinks = rd.links
  const newLinks = new Float32Array(oldLinks.length + pairs.length)
  newLinks.set(oldLinks, 0)
  newLinks.set(pairs, oldLinks.length)

  // Faint cool-grey so streamed mesh edges read as background vs. spokes.
  const faint = [0.46, 0.62, 0.95, 0.16]
  const oldColors = agentLinkColors ?? new Float32Array(0)
  const newColors = new Float32Array(oldColors.length + addedEdges * 4)
  newColors.set(oldColors, 0)
  for (let i = 0; i < addedEdges; i += 1) {
    newColors.set(faint, oldColors.length + i * 4)
  }
  const oldWidths = agentLinkWidths ?? new Float32Array(0)
  const newWidths = new Float32Array(oldWidths.length + addedEdges)
  newWidths.set(oldWidths, 0)
  newWidths.fill(0.6, oldWidths.length)

  rd.links = newLinks
  rd.edgeCount = newLinks.length / 2
  agentLinkColors = newColors
  agentLinkWidths = newWidths

  graph.setLinks(newLinks)
  graph.setLinkColors(newColors)
  graph.setLinkWidths(newWidths)
  graph.render()
  return { edgeCount: rd.edgeCount }
}

async function applyAgentCommand (command: AgentCommand): Promise<unknown> {
  const lab = visualLabControlPlane
  switch (command.type) {
  case 'loadGraph':
    return await installAgentGraph(command.graph, command.options)
  case 'appendEdges':
    return appendEdgesToCurrentGraph(command.links)
  case 'focusNode':
    if (!lab) return null
    return command.options?.async === false
      ? lab.focusNode(command.index, command.options)
      : await lab.focusNodeAsync(command.index, command.options)
  case 'filterNodes':
    return lab?.setNodeFilter(command.pointIndices, command.options) ?? null
  case 'clearInteraction':
    lab?.clearInteraction()
    return { cleared: true }
  case 'setVisibleEdgeKinds':
    return lab?.setVisibleEdgeKinds(command.visibleKinds) ?? null
  case 'secondDegreeProjection':
    return await lab?.runSecondDegreeProjection(command.options)
  default:
    throw new Error(`Unknown agent command: ${(command as { type?: string }).type ?? 'missing type'}`)
  }
}

async function ackAgentCommand (id: number, ok: boolean, result: unknown): Promise<void> {
  try {
    await fetch('/agent/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ok, result }),
    })
  } catch {
    // The agent API exists only on the Vite dev server.
  }
}

function startAgentCommandLoop (): void {
  let cursor = 0
  let stopped = false
  const poll = async (): Promise<void> => {
    if (stopped) return
    try {
      const response = await fetch(`/agent/commands?after=${cursor}`, { cache: 'no-store' })
      if (!response.ok) {
        window.setTimeout(() => { void poll() }, 2000)
        return
      }
      const payload = await response.json() as { cursor: number; commands: AgentCommandEnvelope[] }
      for (const envelope of payload.commands ?? []) {
        cursor = Math.max(cursor, envelope.id)
        try {
          const result = await applyAgentCommand(envelope.command)
          await ackAgentCommand(envelope.id, true, result)
        } catch (error) {
          await ackAgentCommand(envelope.id, false, error instanceof Error ? error.message : String(error))
        }
      }
      cursor = Math.max(cursor, payload.cursor ?? cursor)
      window.setTimeout(() => { void poll() }, 250)
    } catch {
      window.setTimeout(() => { void poll() }, 2000)
    }
  }
  ;(window as unknown as {
    __kajillionAgent?: {
      stop: () => void;
      apply: (command: AgentCommand) => Promise<unknown>;
    };
  }).__kajillionAgent = {
    stop: () => { stopped = true },
    apply: applyAgentCommand,
  }
  void poll()
}

/* ────────────────────────────  Boot  ────────────────────────────────────── */

async function boot (): Promise<void> {
  currentConfig = readControls()
  syncNodeButtons()
  await rebuildGraph(currentConfig)
  wallFps.start()
  startOverlayLoop()
  startLabelLoop()
  startAgentCommandLoop()
}

boot().catch(err => console.error(err))
