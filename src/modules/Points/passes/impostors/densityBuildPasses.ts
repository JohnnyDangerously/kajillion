import type { Buffer, ComputePass, Device } from '@luma.gl/core'
import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'
import { TILE_ATOMIC_LANES } from '@/graph/modules/Points/passes/shared/constants'
import type { GpuTimerLike } from '@/graph/modules/Points/passes/shared/contracts'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import type { ImpostorBuildParameters } from '@/graph/modules/Points/passes/impostors/types'
import type { TileImpostorBuildPipelineState } from '@/graph/modules/Points/passes/impostors/pipelines/tileBuild'

export type RunImpostorComputePass = (
  label: string,
  execute: (pass: ComputePass) => void,
) => void

export function createImpostorComputePassRunner (
  device: Device,
  timer?: GpuTimerLike,
): RunImpostorComputePass {
  return (label, execute): void => {
    timer?.begin(label)
    const pass = device.beginComputePass({ id: label })
    execute(pass)
    pass.end()
    timer?.end()
  }
}

export function runTileImpostorBuildPasses (options: {
  buildParameters: ImpostorBuildParameters;
  data: GraphData;
  effectivePixelRatio: number;
  positionStorageBuffer: Buffer;
  pointCount: number;
  store: Store;
  tileAtomicBuffer: Buffer;
  tileBuild: TileImpostorBuildPipelineState;
  tileColumns: number;
  tileCount: number;
  tileRows: number;
  tileResolvedBuffer: Buffer;
  colorBuffer: Buffer;
  runComputePass: RunImpostorComputePass;
}): void {
  const {
    buildParameters,
    colorBuffer,
    data,
    effectivePixelRatio,
    pointCount,
    positionStorageBuffer,
    runComputePass,
    store,
    tileAtomicBuffer,
    tileBuild,
    tileColumns,
    tileCount,
    tileRows,
    tileResolvedBuffer,
  } = options
  tileBuild.uniformStore!.setUniforms({
    tileUniforms: {
      ratio: effectivePixelRatio,
      transformationMatrix: store.transformationMatrix4x4,
      spaceSize: store.adjustedSpaceSize,
      screenSize: ensureVec2(store.screenSize, [0, 0]),
      tileSize: buildParameters.tileSize,
      pointCount,
      tileColumns,
      tileRows,
      colorScale: 1024,
      positionScale: 1024,
      buildSampleRate: buildParameters.tileBuildSampleRate,
      buildSampleWeight: buildParameters.tileBuildSampleWeight,
    },
  })

  tileBuild.clearPipeline!.setBindings({
    tileUniforms: tileBuild.uniformBuffer!,
    atomicTiles: tileAtomicBuffer,
    resolvedTiles: tileResolvedBuffer,
  })
  runComputePass('impostor.tiles.clear', (pass) => {
    pass.setPipeline(tileBuild.clearPipeline!)
    pass.dispatch(Math.ceil((tileCount * TILE_ATOMIC_LANES) / 64), 1, 1)
  })

  tileBuild.binPipeline!.setBindings({
    tileUniforms: tileBuild.uniformBuffer!,
    positions: positionStorageBuffer,
    colors: colorBuffer,
    atomicTiles: tileAtomicBuffer,
  })
  runComputePass('impostor.tiles.bin', (pass) => {
    pass.setPipeline(tileBuild.binPipeline!)
    pass.dispatch(Math.ceil(pointCount / 64), 1, 1)
  })

  tileBuild.resolvePipeline!.setBindings({
    tileUniforms: tileBuild.uniformBuffer!,
    atomicTiles: tileAtomicBuffer,
    resolvedTiles: tileResolvedBuffer,
  })
  runComputePass('impostor.tiles.resolve', (pass) => {
    pass.setPipeline(tileBuild.resolvePipeline!)
    pass.dispatch(Math.ceil(tileCount / 64), 1, 1)
  })
}
