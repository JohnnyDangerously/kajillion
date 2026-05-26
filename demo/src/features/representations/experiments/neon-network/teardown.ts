import { clearNeonDevHooks } from './dev-hooks'
import type { NeonNetworkRuntime } from './runtime'

export function teardownNeonNetwork (rt: NeonNetworkRuntime): void {
  rt.cancelled = true
  rt.cancelBloom?.()
  rt.cancelLayoutTween?.()
  if (rt.ringStartTimer !== 0) clearTimeout(rt.ringStartTimer)
  rt.ringAnimation?.dispose()
  rt.labelStyle.remove()
  delete document.body.dataset.activeRep
  delete document.body.dataset.activeTheme
  rt.explorerHandle?.dispose()
  rt.colorBarHandle?.dispose()
  rt.tooltipHandle?.dispose()
  rt.backButtonHandle?.dispose()
  rt.hubLabelsHandle?.dispose()
  rt.portraitLabelsHandle?.dispose()
  rt.cancelLinkOpacityTween?.()
  rt.cancelForceRelax?.()
  rt.csrAbort?.abort()
  clearNeonDevHooks()
}
