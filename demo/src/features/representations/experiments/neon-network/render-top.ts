import { renderExplodeLevel } from './render-explode'
import { renderPersonalLevel } from './render-personal'
import { renderPortraitLevel } from './render-portrait'
import type { NeonRenderApi } from './render-api'
import type { NeonNetworkRuntime } from './runtime'
import { stopRings } from './runtime-actions'

export function renderTopOfStack (
  rt: NeonNetworkRuntime,
  api: NeonRenderApi,
): void {
  const top = rt.viewStack[rt.viewStack.length - 1]
  if (!top) return
  stopRings(rt)
  rt.cancelBloom?.()
  rt.cancelBloom = null
  rt.cancelForceRelax?.()
  rt.cancelForceRelax = null
  if (top.kind === 'explode') renderExplodeLevel(rt, top, api)
  else if (top.kind === 'portrait') renderPortraitLevel(rt, top)
  else renderPersonalLevel(rt, top)
}
