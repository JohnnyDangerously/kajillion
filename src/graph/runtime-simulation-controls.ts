import type { GraphConfigInterface } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'

export interface RuntimeSimulationControlContext {
  isDestroyed: () => boolean
  ensureDevice: (callback: () => void) => boolean
  config: GraphConfigInterface
  graph: GraphData
  store: Store
  hasPointsTexture: () => boolean
  resetSimulationTicks: () => void
  runSimulationStep: (forceExecution?: boolean) => void
  requestWebGpuPointPositionsSnapshot: (force?: boolean) => void
  forceHoverDetection: () => void
}

export function startRuntimeSimulation (
  context: RuntimeSimulationControlContext,
  alpha = 1,
  requeue: () => void,
): void {
  if (context.isDestroyed()) return
  if (context.ensureDevice(requeue)) return
  if (!context.graph.pointsNumber) return
  context.store.isSimulationRunning = true
  context.store.simulationProgress = 0
  context.store.alpha = alpha
  context.resetSimulationTicks()
  context.config.onSimulationStart?.()
}

export function stopRuntimeSimulation (context: RuntimeSimulationControlContext): void {
  if (context.isDestroyed()) return
  context.store.isSimulationRunning = false
  context.store.simulationProgress = 0
  context.store.alpha = 0
  context.resetSimulationTicks()
  context.config.onSimulationEnd?.()
}

export function pauseRuntimeSimulation (
  context: RuntimeSimulationControlContext,
  requeue: () => void,
): void {
  if (context.isDestroyed()) return
  if (context.ensureDevice(requeue)) return
  context.store.isSimulationRunning = false
  context.resetSimulationTicks()
  context.config.onSimulationPause?.()
}

export function unpauseRuntimeSimulation (
  context: RuntimeSimulationControlContext,
  requeue: () => void,
): void {
  if (context.isDestroyed()) return
  if (context.ensureDevice(requeue)) return
  context.store.isSimulationRunning = true
  context.config.onSimulationUnpause?.()
}

export function stepRuntimeSimulation (
  context: RuntimeSimulationControlContext,
  requeue: () => void,
): void {
  if (context.isDestroyed()) return
  if (context.ensureDevice(requeue)) return
  if (!context.config.enableSimulation) return
  if (!context.hasPointsTexture()) return
  context.runSimulationStep(true)
}

export function endRuntimeSimulation (context: RuntimeSimulationControlContext): void {
  context.store.isSimulationRunning = false
  context.store.simulationProgress = 1
  context.resetSimulationTicks()
  context.config.onSimulationEnd?.()
  context.requestWebGpuPointPositionsSnapshot(true)
  context.forceHoverDetection()
}
