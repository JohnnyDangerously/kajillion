import { readControls } from '../control-plane/controls'
import type { DemoRuntimeContext } from './context'

export async function applyDemoControlChange (runtime: DemoRuntimeContext): Promise<void> {
  runtime.state.currentConfig = readControls(runtime.ctlEl)
  runtime.demoControls.syncToggleButtons()
  await runtime.rebuildGraph(runtime.state.currentConfig)
}
