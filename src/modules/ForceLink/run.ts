import { ensureVec2 } from '@/graph/modules/Shared/uniform-utils'

import type { ForceLinkRunContext, ForceLinkState } from './contracts'

export function runForceLink (context: ForceLinkRunContext, state: ForceLinkState): void {
  const { config, store, points } = context
  if (!points) return
  if (!state.uniformStore) return
  if (!points.previousPositionTexture || points.previousPositionTexture.destroyed) return
  if (!state.linkFirstIndicesAndAmountTexture || !state.indicesTexture || !state.biasAndStrengthTexture || !state.randomDistanceTexture) return

  if (
    store.pointsTextureSize !== state.previousPointsTextureSize ||
    store.linksTextureSize !== state.previousLinksTextureSize
  ) {
    return
  }

  state.uniformStore.setUniforms({
    forceLinkUniforms: {
      linkSpring: config.simulationLinkSpring,
      linkDistance: config.simulationLinkDistance,
      linkDistRandomVariationRange: ensureVec2(config.simulationLinkDistRandomVariationRange, [0, 0]),
      pointsTextureSize: store.pointsTextureSize,
      linksTextureSize: store.linksTextureSize,
      alpha: store.alpha,
    },
  })

  if (state.runComputePipeline) {
    runCompute(context, state)
  } else if (state.runCommand) {
    runFragment(context, state)
  }
}

function runFragment (context: ForceLinkRunContext, state: ForceLinkState): void {
  const { device, points } = context
  if (!state.runCommand) return
  if (!points?.velocityFbo || points.velocityFbo.destroyed) return
  if (!points.previousPositionTexture || state.linkFirstIndicesAndAmountTexture === undefined || state.indicesTexture === undefined) return

  state.runCommand.setBindings({
    positionsTexture: points.previousPositionTexture,
    linkInfoTexture: state.linkFirstIndicesAndAmountTexture,
    linkBundleTexture: state.indicesTexture,
  })

  const pass = device.beginRenderPass({
    framebuffer: points.velocityFbo,
    clearColor: [0, 0, 0, 0],
  })
  state.runCommand.draw(pass)
  pass.end()
}

function runCompute (context: ForceLinkRunContext, state: ForceLinkState): void {
  const { device, store, points } = context
  if (!state.runComputePipeline || !state.uniformBuffer) return
  if (!points?.previousPositionTexture || points.previousPositionTexture.destroyed) return
  if (!points?.velocityTexture || points.velocityTexture.destroyed) return
  if (!state.linkFirstIndicesAndAmountTexture || !state.indicesTexture) return

  state.runComputePipeline.setBindings({
    forceLinkUniforms: state.uniformBuffer,
    positionsTexture: points.previousPositionTexture,
    linkInfoTexture: state.linkFirstIndicesAndAmountTexture,
    linkBundleTexture: state.indicesTexture,
    velocityOut: points.velocityTexture,
  })

  const size = store.pointsTextureSize ?? 0
  if (size === 0) return
  const groups = Math.ceil(size / 8)

  const pass = device.beginComputePass({ id: 'force.link.compute' })
  pass.setPipeline(state.runComputePipeline)
  pass.dispatch(groups, groups, 1)
  pass.end()
}
