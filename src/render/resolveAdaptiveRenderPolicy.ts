import { type RenderLodMode } from '@/graph/config'

export type AdaptiveRenderState = 'direct' | 'culled' | 'aggregated' | 'workExact'
export type AdaptiveZoomBucket = 'macro' | 'discovery' | 'stats' | 'work'
export type AdaptivePointMode = 'exact' | 'impostor'

export interface ResolvedRenderPolicy {
  state: AdaptiveRenderState;
  zoomBucket: AdaptiveZoomBucket;
  pointMode: AdaptivePointMode;
  usePointGpuCull: boolean;
  useLinkGpuCull: boolean;
  densityPointsPerMpx: number;
  effectivePointCount: number;
  effectiveLinkCount: number;
  reasons: string[];
}

export interface AdaptiveRenderPolicyInput {
  isWebGPU: boolean;
  renderLodMode: RenderLodMode;
  pointCount: number;
  linkCount: number;
  activePointCount?: number;
  activeLinkCount?: number;
  hasActivePointFilter: boolean;
  hasActiveLinkFilter: boolean;
  canvasCssWidth: number;
  canvasCssHeight: number;
  zoomDistance: number;
  zoomLevel: number;
  impostorAutoMinPoints: number;
  impostorAutoMaxZoom: number;
  previousState?: AdaptiveRenderState;
}

const DENSE_POINTS_PER_MPX_ENTER = 20000
const DENSE_POINTS_PER_MPX_EXIT = 16000
const VERY_DENSE_POINTS_PER_MPX_ENTER = 75000
const VERY_DENSE_POINTS_PER_MPX_EXIT = 60000
const AGGREGATED_ENTER_DISTANCE = 75
const AGGREGATED_EXIT_DISTANCE = 70
const WORK_ENTER_DISTANCE = 25
const WORK_EXIT_DISTANCE = 30

function bucketForDistance (zoomDistance: number): AdaptiveZoomBucket {
  if (zoomDistance <= WORK_ENTER_DISTANCE) return 'work'
  if (zoomDistance <= 50) return 'stats'
  if (zoomDistance <= 75) return 'discovery'
  return 'macro'
}

function isDense (densityPointsPerMpx: number, previousState?: AdaptiveRenderState): boolean {
  return densityPointsPerMpx >= (
    previousState === 'culled' || previousState === 'aggregated'
      ? DENSE_POINTS_PER_MPX_EXIT
      : DENSE_POINTS_PER_MPX_ENTER
  )
}

function isVeryDense (densityPointsPerMpx: number, previousState?: AdaptiveRenderState): boolean {
  return densityPointsPerMpx >= (
    previousState === 'aggregated'
      ? VERY_DENSE_POINTS_PER_MPX_EXIT
      : VERY_DENSE_POINTS_PER_MPX_ENTER
  )
}

function shouldStayAggregated (zoomDistance: number, previousState?: AdaptiveRenderState): boolean {
  return previousState === 'aggregated'
    ? zoomDistance >= AGGREGATED_EXIT_DISTANCE
    : zoomDistance >= AGGREGATED_ENTER_DISTANCE
}

function shouldUseWorkExact (zoomDistance: number, previousState?: AdaptiveRenderState): boolean {
  return previousState === 'workExact'
    ? zoomDistance <= WORK_EXIT_DISTANCE
    : zoomDistance <= WORK_ENTER_DISTANCE
}

export function resolveAdaptiveRenderPolicy (input: AdaptiveRenderPolicyInput): ResolvedRenderPolicy {
  const effectivePointCount = input.activePointCount ?? input.pointCount
  const effectiveLinkCount = input.activeLinkCount ?? input.linkCount
  const viewportMpx = Math.max((input.canvasCssWidth * input.canvasCssHeight) / 1000000, 0.25)
  const densityPointsPerMpx = effectivePointCount / viewportMpx
  const dense = isDense(densityPointsPerMpx, input.previousState)
  const veryDense = isVeryDense(densityPointsPerMpx, input.previousState)
  const zoomBucket = bucketForDistance(input.zoomDistance)
  const reasons: string[] = [
    zoomBucket,
    dense ? 'dense' : 'sparse',
  ]

  if (!input.isWebGPU || input.pointCount <= 0) {
    return {
      state: 'direct',
      zoomBucket,
      pointMode: 'exact',
      usePointGpuCull: false,
      useLinkGpuCull: false,
      densityPointsPerMpx,
      effectivePointCount,
      effectiveLinkCount,
      reasons: [...reasons, input.isWebGPU ? 'empty' : 'non-webgpu'],
    }
  }

  if (input.renderLodMode === 'impostor' && !input.hasActivePointFilter) {
    return {
      state: 'aggregated',
      zoomBucket,
      pointMode: 'impostor',
      usePointGpuCull: false,
      useLinkGpuCull: effectiveLinkCount >= 10000,
      densityPointsPerMpx,
      effectivePointCount,
      effectiveLinkCount,
      reasons: [...reasons, 'forced-impostor'],
    }
  }

  if (shouldUseWorkExact(input.zoomDistance, input.previousState)) {
    return {
      state: 'workExact',
      zoomBucket: 'work',
      pointMode: 'exact',
      usePointGpuCull: input.hasActivePointFilter || dense,
      useLinkGpuCull: input.hasActiveLinkFilter || effectiveLinkCount >= 10000,
      densityPointsPerMpx,
      effectivePointCount,
      effectiveLinkCount,
      reasons: [...reasons, 'work-exact'],
    }
  }

  const canAggregate =
    input.renderLodMode === 'auto' &&
    !input.hasActivePointFilter &&
    effectivePointCount >= input.impostorAutoMinPoints &&
    input.zoomLevel <= input.impostorAutoMaxZoom * (input.previousState === 'aggregated' ? 1.18 : 1)

  if (canAggregate && shouldStayAggregated(input.zoomDistance, input.previousState) && (dense || veryDense)) {
    return {
      state: 'aggregated',
      zoomBucket,
      pointMode: 'impostor',
      usePointGpuCull: false,
      useLinkGpuCull: effectiveLinkCount >= 10000,
      densityPointsPerMpx,
      effectivePointCount,
      effectiveLinkCount,
      reasons: [...reasons, veryDense ? 'very-dense-aggregate' : 'dense-aggregate'],
    }
  }

  const shouldCull =
    input.hasActivePointFilter ||
    input.hasActiveLinkFilter ||
    (dense && input.zoomDistance < 75) ||
    input.zoomDistance <= 50 ||
    input.renderLodMode === 'phantom'
  const forceCullForCorrectness =
    input.hasActivePointFilter ||
    input.hasActiveLinkFilter ||
    input.renderLodMode === 'phantom'

  return {
    state: shouldCull ? 'culled' : 'direct',
    zoomBucket,
    pointMode: 'exact',
    usePointGpuCull: shouldCull && (forceCullForCorrectness || effectivePointCount >= 10000),
    useLinkGpuCull: (shouldCull || input.zoomDistance <= 75) && (forceCullForCorrectness || effectiveLinkCount >= 10000),
    densityPointsPerMpx,
    effectivePointCount,
    effectiveLinkCount,
    reasons: [...reasons, shouldCull ? 'gpu-cull' : 'direct'],
  }
}
