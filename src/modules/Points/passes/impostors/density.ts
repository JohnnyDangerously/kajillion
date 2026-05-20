import type { Buffer, Device } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import type { GpuTimerLike } from '@/graph/modules/Points/passes/shared/contracts'
import { ensureTileImpostorBuffers } from '@/graph/modules/Points/passes/impostors/buffers'
import {
  createImpostorComputePassRunner,
  runTileImpostorBuildPasses,
} from '@/graph/modules/Points/passes/impostors/densityBuildPasses'
import { runHybridAnchorBuild } from '@/graph/modules/Points/passes/impostors/densityHybridAnchors'
import { ensureTileImpostorBuildPipelines } from '@/graph/modules/Points/passes/impostors/pipelines/tileBuild'
import { isLiveBuffer } from '@/graph/modules/Points/passes/impostors/helpers'
import { getImpostorBuildSignature } from '@/graph/modules/Points/passes/impostors/signature'
import type {
  ImpostorBuildParameters,
  RenderImpostorDensityResult,
  RenderImpostorDensityState,
} from '@/graph/modules/Points/passes/impostors/types'

export function renderImpostorDensity (options: {
  device: Device;
  config: GraphConfigInterface;
  data: GraphData;
  store: Store;
  state: RenderImpostorDensityState;
  positionStorageBuffer: Buffer | undefined;
  effectivePixelRatio: number;
  buildParameters: ImpostorBuildParameters;
  timer?: GpuTimerLike;
  positionEpoch: number;
  ensureColorBuffer: () => Buffer | undefined;
  ensureSizeBuffer: () => Buffer | undefined;
}): RenderImpostorDensityResult {
  let state = { ...options.state }
  const { config, data, device, store } = options
  if (device.info?.type !== 'webgpu') return { rendered: false, state }
  if (!data.pointsNumber || data.pointsNumber === 0) return { rendered: false, state }
  if (!store.screenSize || store.screenSize[0] === 0 || store.screenSize[1] === 0) {
    return { rendered: false, state }
  }
  if (!isLiveBuffer(options.positionStorageBuffer)) return { rendered: false, state }

  if (!state.colorBuffer) state.colorBuffer = options.ensureColorBuffer()
  if (!state.colorBuffer) return { rendered: false, state }
  if (!state.sizeBuffer) state.sizeBuffer = options.ensureSizeBuffer()
  if (!state.sizeBuffer) return { rendered: false, state }

  const tileBufferState = ensureTileImpostorBuffers(device, {
    tileAtomicBuffer: state.tileAtomicBuffer,
    tileResolvedBuffer: state.tileResolvedBuffer,
    tileColumns: state.tileColumns,
    tileRows: state.tileRows,
    tileCount: state.tileCount,
    impostorBuildSignature: state.impostorBuildSignature,
  }, {
    screenSize: store.screenSize,
    ratio: options.effectivePixelRatio,
    tileSize: options.buildParameters.tileSize,
  })
  state = {
    ...state,
    tileAtomicBuffer: tileBufferState.tileAtomicBuffer,
    tileResolvedBuffer: tileBufferState.tileResolvedBuffer,
    tileColumns: tileBufferState.tileColumns,
    tileRows: tileBufferState.tileRows,
    tileCount: tileBufferState.tileCount,
    impostorBuildSignature: tileBufferState.impostorBuildSignature,
  }

  state.tileBuildPipelines = ensureTileImpostorBuildPipelines({
    device,
    state: state.tileBuildPipelines,
    ratio: options.effectivePixelRatio,
    transformationMatrix: store.transformationMatrix4x4,
    spaceSize: store.adjustedSpaceSize,
    screenSize: store.screenSize,
    tileSize: options.buildParameters.tileSize,
    pointCount: data.pointsNumber,
    tileColumns: state.tileColumns,
    tileRows: state.tileRows,
    buildSampleRate: options.buildParameters.tileBuildSampleRate,
    buildSampleWeight: options.buildParameters.tileBuildSampleWeight,
  })
  const tileBuild = state.tileBuildPipelines
  if (
    !tileBuild.uniformStore ||
    !tileBuild.uniformBuffer ||
    !tileBuild.clearPipeline ||
    !tileBuild.binPipeline ||
    !tileBuild.resolvePipeline ||
    !state.tileAtomicBuffer ||
    !state.tileResolvedBuffer ||
    state.tileCount === 0
  ) {
    return { rendered: false, state }
  }

  const pointCount = data.pointsNumber
  const tileAtomicBuffer = state.tileAtomicBuffer
  const tileResolvedBuffer = state.tileResolvedBuffer
  const colorBuffer = state.colorBuffer
  const sizeBuffer = state.sizeBuffer
  if (!colorBuffer || !sizeBuffer) return { rendered: false, state }
  const impostorBuildSignature = getImpostorBuildSignature({
    config,
    data,
    store,
    positionEpoch: options.positionEpoch,
    effectivePixelRatio: options.effectivePixelRatio,
    tileColumns: state.tileColumns,
    tileRows: state.tileRows,
    buildParameters: options.buildParameters,
  })
  if (state.impostorBuildSignature === impostorBuildSignature) {
    return { rendered: true, state }
  }

  const runComputePass = createImpostorComputePassRunner(device, options.timer)
  runTileImpostorBuildPasses({
    buildParameters: options.buildParameters,
    colorBuffer,
    data,
    effectivePixelRatio: options.effectivePixelRatio,
    positionStorageBuffer: options.positionStorageBuffer,
    pointCount,
    runComputePass,
    store,
    tileAtomicBuffer,
    tileBuild,
    tileColumns: state.tileColumns,
    tileCount: state.tileCount,
    tileRows: state.tileRows,
    tileResolvedBuffer,
  })

  if (config.impostorExactOverlay && !config.impostorStableOverlay) {
    const hybridAnchorBuild = runHybridAnchorBuild({
      device,
      config,
      store,
      state,
      positionStorageBuffer: options.positionStorageBuffer,
      colorBuffer,
      sizeBuffer,
      tileResolvedBuffer,
      pointCount,
      effectivePixelRatio: options.effectivePixelRatio,
      buildParameters: options.buildParameters,
      runComputePass,
    })
    state = hybridAnchorBuild.state
    if (!hybridAnchorBuild.completed) return { rendered: true, state }
  }

  state.impostorBuildSignature = impostorBuildSignature
  return { rendered: true, state }
}
