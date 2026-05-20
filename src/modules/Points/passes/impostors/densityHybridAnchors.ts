import type { Buffer, ComputePass, Device } from '@luma.gl/core'
import type { GraphConfigInterface } from '@/graph/config'
import type { Store } from '@/graph/modules/Store'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { ensureHybridAnchorBuffers } from '@/graph/modules/Points/passes/impostors/buffers'
import { ensureHybridAnchorBuildPipelines } from '@/graph/modules/Points/passes/impostors/pipelines/hybridBuild'
import type {
  ImpostorBuildParameters,
  RenderImpostorDensityState,
} from '@/graph/modules/Points/passes/impostors/types'

type RunComputePass = (
  label: string,
  execute: (pass: ComputePass) => void,
) => void

export function runHybridAnchorBuild (options: {
  device: Device;
  config: GraphConfigInterface;
  store: Store;
  state: RenderImpostorDensityState;
  positionStorageBuffer: Buffer;
  colorBuffer: Buffer;
  sizeBuffer: Buffer;
  tileResolvedBuffer: Buffer;
  pointCount: number;
  effectivePixelRatio: number;
  buildParameters: ImpostorBuildParameters;
  runComputePass: RunComputePass;
}): { completed: boolean; state: RenderImpostorDensityState } {
  let state = { ...options.state }
  const { config, device, store } = options

  const hybridAnchorBufferState = ensureHybridAnchorBuffers(device, {
    hybridAnchorCountBuffer: state.hybridAnchorCountBuffer,
    hybridAnchorPositionBuffer: state.hybridAnchorPositionBuffer,
    hybridAnchorColorBuffer: state.hybridAnchorColorBuffer,
    hybridAnchorIndirectBuffer: state.hybridAnchorIndirectBuffer,
    hybridAnchorCapacity: state.hybridAnchorCapacity,
    impostorBuildSignature: state.impostorBuildSignature,
  }, {
    tileCount: state.tileCount,
    anchorsPerTile: options.buildParameters.hybridAnchorsPerTile,
  })
  state = {
    ...state,
    hybridAnchorCountBuffer: hybridAnchorBufferState.hybridAnchorCountBuffer,
    hybridAnchorPositionBuffer: hybridAnchorBufferState.hybridAnchorPositionBuffer,
    hybridAnchorColorBuffer: hybridAnchorBufferState.hybridAnchorColorBuffer,
    hybridAnchorIndirectBuffer: hybridAnchorBufferState.hybridAnchorIndirectBuffer,
    hybridAnchorCapacity: hybridAnchorBufferState.hybridAnchorCapacity,
    impostorBuildSignature: hybridAnchorBufferState.impostorBuildSignature,
  }

  state.hybridAnchorBuildPipelines = ensureHybridAnchorBuildPipelines({
    device,
    state: state.hybridAnchorBuildPipelines,
    ratio: options.effectivePixelRatio,
    transformationMatrix: store.transformationMatrix4x4,
    spaceSize: store.adjustedSpaceSize,
    screenSize: store.screenSize,
    tileSize: options.buildParameters.tileSize,
    pointCount: options.pointCount,
    tileColumns: state.tileColumns,
    tileRows: state.tileRows,
    anchorsPerTile: options.buildParameters.hybridAnchorsPerTile,
    denseSampleRate: config.impostorExactOverlaySampleRate,
    sparseTileThreshold: config.impostorSparseTileThreshold,
  })
  const hybridBuild = state.hybridAnchorBuildPipelines
  if (
    !hybridBuild.uniformStore ||
    !hybridBuild.uniformBuffer ||
    !hybridBuild.clearPipeline ||
    !hybridBuild.fillPipeline ||
    !hybridBuild.materializePipeline ||
    !state.hybridAnchorCountBuffer ||
    !state.hybridAnchorPositionBuffer ||
    !state.hybridAnchorColorBuffer ||
    !state.hybridAnchorIndirectBuffer
  ) {
    return { completed: false, state }
  }

  const hybridUniformBuffer = hybridBuild.uniformBuffer
  const clearHybridPipeline = hybridBuild.clearPipeline
  const fillHybridPipeline = hybridBuild.fillPipeline
  const materializeHybridPipeline = hybridBuild.materializePipeline
  const hybridAnchorCountBuffer = state.hybridAnchorCountBuffer
  const hybridAnchorPositionBuffer = state.hybridAnchorPositionBuffer
  const hybridAnchorColorBuffer = state.hybridAnchorColorBuffer
  const hybridAnchorIndirectBuffer = state.hybridAnchorIndirectBuffer

  hybridBuild.uniformStore.setUniforms({
    hybridAnchorBuildUniforms: {
      ratio: options.effectivePixelRatio,
      transformationMatrix: store.transformationMatrix4x4,
      spaceSize: store.adjustedSpaceSize,
      screenSize: ensureVec2(store.screenSize, [0, 0]),
      tileSize: options.buildParameters.tileSize,
      pointCount: options.pointCount,
      tileColumns: state.tileColumns,
      tileRows: state.tileRows,
      anchorsPerTile: options.buildParameters.hybridAnchorsPerTile,
      denseSampleRate: config.impostorExactOverlaySampleRate,
      sparseTileThreshold: config.impostorSparseTileThreshold,
    },
  })

  clearHybridPipeline.setBindings({
    anchorUniforms: hybridUniformBuffer,
    anchorCounts: hybridAnchorCountBuffer,
    anchorPositions: hybridAnchorPositionBuffer,
    anchorColors: hybridAnchorColorBuffer,
    anchorIndirectArgs: hybridAnchorIndirectBuffer,
  })
  options.runComputePass('impostor.anchors.clear', (pass) => {
    pass.setPipeline(clearHybridPipeline)
    pass.dispatch(Math.ceil(Math.max(state.tileCount, state.hybridAnchorCapacity) / 64), 1, 1)
  })

  fillHybridPipeline.setBindings({
    anchorUniforms: hybridUniformBuffer,
    positions: options.positionStorageBuffer,
    sizes: options.sizeBuffer,
    resolvedTiles: options.tileResolvedBuffer,
    anchorCounts: hybridAnchorCountBuffer,
  })
  options.runComputePass('impostor.anchors.fill', (pass) => {
    pass.setPipeline(fillHybridPipeline)
    pass.dispatch(Math.ceil(options.pointCount / 64), 1, 1)
  })

  materializeHybridPipeline.setBindings({
    anchorUniforms: hybridUniformBuffer,
    positions: options.positionStorageBuffer,
    colors: options.colorBuffer,
    sizes: options.sizeBuffer,
    resolvedTiles: options.tileResolvedBuffer,
    anchorCounts: hybridAnchorCountBuffer,
    anchorPositions: hybridAnchorPositionBuffer,
    anchorColors: hybridAnchorColorBuffer,
    anchorIndirectArgs: hybridAnchorIndirectBuffer,
  })
  options.runComputePass('impostor.anchors.materialize', (pass) => {
    pass.setPipeline(materializeHybridPipeline)
    pass.dispatch(Math.ceil(state.hybridAnchorCapacity / 64), 1, 1)
  })

  return { completed: true, state }
}
