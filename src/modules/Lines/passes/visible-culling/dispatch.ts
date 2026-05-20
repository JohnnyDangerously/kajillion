import type { Buffer, ComputePipeline, Device, UniformStore } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { ZERO_VEC2 } from '@/graph/modules/Lines/passes/shared/constants'
import type { GpuTimerLike } from '@/graph/modules/Lines/passes/shared/contracts'
import type {
  ClearVisibleLinesUniformStoreShape,
  CullVisibleLinesUniformStoreShape,
} from '@/graph/modules/Lines/passes/visible-culling/contracts'
import type { PreparedVisibleLinePoints } from '@/graph/modules/Lines/passes/visible-culling/prepare-context'
import { runVisibleLineComputePass } from '@/graph/modules/Lines/passes/visible-culling/compute-pass'

export interface VisibleLineClearDispatchInput {
  device: Device;
  timer: GpuTimerLike | undefined;
  vertexCount: number;
  clearUniformStore: UniformStore<ClearVisibleLinesUniformStoreShape>;
  clearUniformBuffer: Buffer;
  clearPipeline: ComputePipeline;
  visibleLineIndirectBuffer: Buffer;
}

export interface VisibleLineCullDispatchInput {
  device: Device;
  timer: GpuTimerLike | undefined;
  config: GraphConfigInterface;
  store: Store;
  points: PreparedVisibleLinePoints;
  pointABuffer: Buffer;
  pointBBuffer: Buffer;
  linkCount: number;
  linkLodRange: [number, number];
  linkLodStrength: number;
  cullUniformStore: UniformStore<CullVisibleLinesUniformStoreShape>;
  cullUniformBuffer: Buffer;
  cullPipeline: ComputePipeline;
  visibleLineIndexBuffer: Buffer;
  visibleLineIndirectBuffer: Buffer;
  activeLineMaskBuffer: Buffer;
}

export function runVisibleLineClearDispatch (input: VisibleLineClearDispatchInput): void {
  const {
    clearPipeline,
    clearUniformBuffer,
    clearUniformStore,
    device,
    timer,
    vertexCount,
    visibleLineIndirectBuffer,
  } = input

  clearUniformStore.setUniforms({
    clearLineUniforms: {
      vertexCount,
    },
  })
  clearPipeline.setBindings({
    clearLineUniforms: clearUniformBuffer,
    indirectArgs: visibleLineIndirectBuffer,
  })

  runVisibleLineComputePass(device, timer, 'lines.visible.clear', (pass) => {
    pass.setPipeline(clearPipeline)
    pass.dispatch(1, 1, 1)
  })
}

export function runVisibleLineCullDispatch (input: VisibleLineCullDispatchInput): void {
  const {
    activeLineMaskBuffer,
    config,
    cullPipeline,
    cullUniformBuffer,
    cullUniformStore,
    device,
    linkCount,
    linkLodRange,
    linkLodStrength,
    pointABuffer,
    pointBBuffer,
    points,
    store,
    timer,
    visibleLineIndexBuffer,
    visibleLineIndirectBuffer,
  } = input

  cullUniformStore.setUniforms({
    cullLineUniforms: {
      transformationMatrix: store.transformationMatrix4x4,
      linkCount,
      pointsTextureSize: store.pointsTextureSize,
      spaceSize: store.adjustedSpaceSize,
      screenSize: ensureVec2(store.screenSize, ZERO_VEC2),
      curvedLinkControlPointDistance: config.curvedLinkControlPointDistance,
      renderPositionMix: points.renderPositionMix ?? 1,
      linkMinPixelLength: config.linkMinPixelLength,
      linkLodStrength,
      linkLodZoomRange: linkLodRange,
      linkLodMinSampleRate: config.linkLodMinSampleRate,
      hoveredLinkIndex: store.hoveredLinkIndex ?? -1,
      focusedLinkIndex: config.focusedLinkIndex ?? -1,
    },
  })
  cullPipeline.setBindings({
    cullLineUniforms: cullUniformBuffer,
    positions: points.positionStorageBuffer,
    pointAArr: pointABuffer,
    pointBArr: pointBBuffer,
    visibleIndices: visibleLineIndexBuffer,
    indirectArgs: visibleLineIndirectBuffer,
    activeMask: activeLineMaskBuffer,
    previousPositions: points.previousRenderPositionStorageBuffer,
  })
  runVisibleLineComputePass(device, timer, 'lines.visible.cull', (pass) => {
    pass.setPipeline(cullPipeline)
    pass.dispatch(Math.ceil(linkCount / 64), 1, 1)
  })
}
