import type { Buffer, ComputePipeline, Device } from '@luma.gl/core'
import type { GpuTimerLike } from '@/graph/modules/Points/passes/shared/contracts'
import type { VisiblePointTileBudgetLayout } from '@/graph/modules/Points/passes/visible-culling/contracts'

type ComputePass = ReturnType<Device['beginComputePass']>

export type VisiblePointCullComputeResources = {
  device: Device;
  cullVisiblePointsPipeline: ComputePipeline;
  clearVisiblePointTileBudgetPipeline: ComputePipeline;
  selectVisiblePointTileBudgetPipeline: ComputePipeline;
  prefixVisiblePointsPipeline: ComputePipeline;
  prefixVisiblePointBlocksPipeline: ComputePipeline;
  addVisiblePointBlockOffsetsPipeline: ComputePipeline;
  scatterVisiblePointsPipeline: ComputePipeline;
  cullUniforms: Buffer;
  positions: Buffer;
  previousPositions: Buffer;
  sizes: Buffer;
  activeMask: Buffer;
  pointStatusBuf: Buffer;
  visibleIndices: Buffer;
  visibleGroupOffsets: Buffer;
  visibleMask: Buffer;
  blockSums: Buffer;
  blockOffsets: Buffer;
  indirectArgs: Buffer;
  tileBudgetPriorities: Buffer;
  pointCount: number;
  visiblePointGroupCapacity: number;
  visiblePointBlockCapacity: number;
  tileBudgetLayout: VisiblePointTileBudgetLayout;
  timer?: GpuTimerLike;
}

export function runVisiblePointCullComputePasses ({
  device,
  cullVisiblePointsPipeline,
  clearVisiblePointTileBudgetPipeline,
  selectVisiblePointTileBudgetPipeline,
  prefixVisiblePointsPipeline,
  prefixVisiblePointBlocksPipeline,
  addVisiblePointBlockOffsetsPipeline,
  scatterVisiblePointsPipeline,
  cullUniforms,
  positions,
  previousPositions,
  sizes,
  activeMask,
  pointStatusBuf,
  visibleIndices,
  visibleGroupOffsets,
  visibleMask,
  blockSums,
  blockOffsets,
  indirectArgs,
  tileBudgetPriorities,
  pointCount,
  visiblePointGroupCapacity,
  visiblePointBlockCapacity,
  tileBudgetLayout,
  timer,
}: VisiblePointCullComputeResources): void {
  const pointDispatchCount = Math.ceil(pointCount / 64)
  const blockOffsetDispatchCount = Math.ceil(visiblePointGroupCapacity / 256)
  const tileBudgetDispatchCount = Math.ceil(tileBudgetLayout.capacity / 64)
  const pointTileBudgetActive = tileBudgetLayout.budget > 0

  cullVisiblePointsPipeline.setBindings({
    cullUniforms,
    positions,
    sizes,
    activeMask,
    pointStatusBuf,
    visibleGroupOffsets,
    visibleMask,
    previousPositions,
    tileBudgetPriorities,
  })
  clearVisiblePointTileBudgetPipeline.setBindings({ tileBudgetPriorities })
  selectVisiblePointTileBudgetPipeline.setBindings({
    cullUniforms,
    positions,
    sizes,
    activeMask,
    pointStatusBuf,
    previousPositions,
    tileBudgetPriorities,
  })
  prefixVisiblePointsPipeline.setBindings({
    visibleGroupOffsets,
    blockSums,
  })
  prefixVisiblePointBlocksPipeline.setBindings({
    blockSums,
    blockOffsets,
    indirectArgs,
  })
  addVisiblePointBlockOffsetsPipeline.setBindings({
    visibleGroupOffsets,
    blockOffsets,
  })
  scatterVisiblePointsPipeline.setBindings({
    cullUniforms,
    visibleIndices,
    visibleGroupOffsets,
    visibleMask,
  })

  const dispatchCullStages = (pass: ComputePass): void => {
    if (pointTileBudgetActive) {
      pass.setPipeline(clearVisiblePointTileBudgetPipeline)
      pass.dispatch(tileBudgetDispatchCount, 1, 1)
      pass.setPipeline(selectVisiblePointTileBudgetPipeline)
      pass.dispatch(pointDispatchCount, 1, 1)
    }
    pass.setPipeline(cullVisiblePointsPipeline)
    pass.dispatch(pointDispatchCount, 1, 1)
    pass.setPipeline(prefixVisiblePointsPipeline)
    pass.dispatch(visiblePointBlockCapacity, 1, 1)
    pass.setPipeline(prefixVisiblePointBlocksPipeline)
    pass.dispatch(1, 1, 1)
    pass.setPipeline(addVisiblePointBlockOffsetsPipeline)
    pass.dispatch(blockOffsetDispatchCount, 1, 1)
    pass.setPipeline(scatterVisiblePointsPipeline)
    pass.dispatch(pointDispatchCount, 1, 1)
  }

  if (!timer) {
    const pass = device.beginComputePass({ id: 'points.visible.cull' })
    dispatchCullStages(pass)
    pass.end()
    return
  }

  if (pointTileBudgetActive) {
    runComputePass(device, timer, 'points.visible.tile-budget.clear', (pass) => {
      pass.setPipeline(clearVisiblePointTileBudgetPipeline)
      pass.dispatch(tileBudgetDispatchCount, 1, 1)
    })
    runComputePass(device, timer, 'points.visible.tile-budget.select', (pass) => {
      pass.setPipeline(selectVisiblePointTileBudgetPipeline)
      pass.dispatch(pointDispatchCount, 1, 1)
    })
  }
  runComputePass(device, timer, 'points.visible.count', (pass) => {
    pass.setPipeline(cullVisiblePointsPipeline)
    pass.dispatch(pointDispatchCount, 1, 1)
  })
  runComputePass(device, timer, 'points.visible.prefix.groups', (pass) => {
    pass.setPipeline(prefixVisiblePointsPipeline)
    pass.dispatch(visiblePointBlockCapacity, 1, 1)
  })
  runComputePass(device, timer, 'points.visible.prefix.blocks', (pass) => {
    pass.setPipeline(prefixVisiblePointBlocksPipeline)
    pass.dispatch(1, 1, 1)
  })
  runComputePass(device, timer, 'points.visible.prefix.add', (pass) => {
    pass.setPipeline(addVisiblePointBlockOffsetsPipeline)
    pass.dispatch(blockOffsetDispatchCount, 1, 1)
  })
  runComputePass(device, timer, 'points.visible.scatter', (pass) => {
    pass.setPipeline(scatterVisiblePointsPipeline)
    pass.dispatch(pointDispatchCount, 1, 1)
  })
}

function runComputePass (
  device: Device,
  timer: GpuTimerLike,
  label: string,
  execute: (pass: ComputePass) => void,
): void {
  timer.begin(label)
  const pass = device.beginComputePass({ id: label })
  execute(pass)
  pass.end()
  timer.end()
}
