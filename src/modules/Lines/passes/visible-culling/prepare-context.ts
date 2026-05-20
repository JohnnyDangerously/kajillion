import type { Buffer, Device } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Points } from '@/graph/modules/Points'
import type { Store } from '@/graph/modules/Store'
import { getEffectiveLinkLodStrength } from '@/graph/modules/Lines/features/draw-lifecycle/lifecycle'
import { DEFAULT_LINK_LOD_ZOOM_RANGE } from '@/graph/modules/Lines/passes/shared/constants'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'

export interface VisibleLinePrepareHost {
  readonly device: Device;
  readonly config: GraphConfigInterface;
  readonly data: GraphData;
  readonly points: Points | undefined;
  readonly store: Store;
}

export type PreparedVisibleLinePoints = Points & {
  positionStorageBuffer: Buffer;
  previousRenderPositionStorageBuffer: Buffer;
}

export interface VisibleLinePrepareContext {
  linkCount: number;
  linkLodRange: [number, number];
  linkLodStrength: number;
  points: PreparedVisibleLinePoints;
}

export function getVisibleLinePrepareContext (
  host: VisibleLinePrepareHost,
  forcePolicy: boolean,
  pointABuffer: Buffer,
  pointBBuffer: Buffer,
  vertexCount: number,
): VisibleLinePrepareContext | undefined {
  const { config, data, device, points, store } = host
  if (device.info?.type !== 'webgpu') return undefined
  const hasActiveFilter = config.activeLinkIndices !== undefined
  if (!data.linksNumber || (!hasActiveFilter && data.linksNumber < 10000)) return undefined
  if (!store.screenSize || store.screenSize[0] === 0 || store.screenSize[1] === 0) return undefined
  if (!store.pointsTextureSize) return undefined
  if (!points?.positionStorageBuffer || points.positionStorageBuffer.destroyed) return undefined
  if (!points.previousRenderPositionStorageBuffer || points.previousRenderPositionStorageBuffer.destroyed) return undefined
  if (pointABuffer.destroyed || pointBBuffer.destroyed || vertexCount === 0) return undefined

  const linkCount = data.linksNumber
  const scale = Math.abs(store.transformationMatrix4x4[0] ?? 1)
  const linkLodStrength = getEffectiveLinkLodStrength(config)
  const linkLodRange = ensureVec2(config.linkLodZoomRange, DEFAULT_LINK_LOD_ZOOM_RANGE)
  const linkLodNearScale = Math.max(linkLodRange[0], linkLodRange[1])
  const linkLodActive = linkLodStrength > 0 && scale < linkLodNearScale
  const linkMinLengthActive = config.linkMinPixelLength > 0
  if (!forcePolicy && !hasActiveFilter && scale < 1.08 && !linkLodActive && !linkMinLengthActive) return undefined

  return {
    linkCount,
    linkLodRange,
    linkLodStrength,
    points: points as PreparedVisibleLinePoints,
  }
}
