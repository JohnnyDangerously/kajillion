import { buildTargetAttributes, getNetwork, state } from './cache'
import { bootstrapNeonNetwork } from './bootstrap'
import { createRingAnimation } from './ring-animation'
import { installInteractionHandlers } from './interaction-handlers'
import { loadRealEdgesForExplode } from './load-real-edges'
import { mountNeonOverlays } from './mount-overlays'
import {
  enterExplode,
  enterPersonalNetwork,
  enterPortraitFromHub,
  exitToAtlas,
} from './navigation'
import { exposeNeonGraph, installNeonDevHooks } from './dev-hooks'
import { createNeonRuntime } from './runtime'
import { playBloom, refreshClusterIndex, scheduleRingsStart } from './runtime-actions'
import { renderTopOfStack } from './render-top'
import { teardownNeonNetwork } from './teardown'
import { hideUntilReady, installNeonUiScope } from './ui-scope'
import type { RepresentationInstallContext } from '../../types'

export function installNeonNetwork (
  ctx: RepresentationInstallContext,
): () => void {
  const rt = createNeonRuntime(ctx, installNeonUiScope())
  hideUntilReady(ctx.graph, ctx.data.nodeCount)
  void Promise.resolve(getNetwork() ?? state.networkPromise).then(async () => {
    await bootstrapNeonNetwork(ctx, () => rt.cancelled)
    if (rt.cancelled) return
    finishBootstrap(rt).catch((err: unknown) => {
      if ((err as Error).name !== 'AbortError') console.warn('[neon-network] bootstrap failed:', err)
    })
  })
  return () => teardownNeonNetwork(rt)
}

async function finishBootstrap (
  rt: ReturnType<typeof createNeonRuntime>,
): Promise<void> {
  const api = {
    renderTopOfStack: () => renderTopOfStack(rt, api),
    loadRealEdgesForExplode: (level: Parameters<typeof loadRealEdgesForExplode>[1], signal: AbortSignal) =>
      loadRealEdgesForExplode(rt, level, signal),
  }
  const nav = {
    renderTopOfStack: api.renderTopOfStack,
  }
  const actions = {
    exitToAtlas: () => exitToAtlas(rt, nav),
    enterExplode: (idx: number) => enterExplode(rt, idx, nav),
    enterPortraitFromHub: (hub: Parameters<typeof enterPortraitFromHub>[1]) =>
      enterPortraitFromHub(rt, hub, nav),
    enterPersonalNetwork: (idx: number) => enterPersonalNetwork(rt, idx, nav),
  }

  exposeNeonGraph(rt.ctx.graph)
  rt.ringAnimation = createRingAnimation(rt.ctx.graph)
  rt.ctx.graph.setPointColors(buildTargetAttributes(rt.ctx.data.nodeCount).colors)
  playBloom(rt)
  scheduleRingsStart(rt, 1500)
  refreshClusterIndex(rt, state.colorMode, rt.ctx.data.positions)
  installInteractionHandlers(rt)
  installNeonDevHooks({
    enterExplode: actions.enterExplode,
    exitToAtlas: actions.exitToAtlas,
    enterPersonalNetwork: actions.enterPersonalNetwork,
  })
  await mountNeonOverlays(rt, actions)
}
