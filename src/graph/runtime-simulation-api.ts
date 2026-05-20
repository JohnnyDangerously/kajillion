import {
  pauseRuntimeSimulation,
  startRuntimeSimulation,
  stepRuntimeSimulation,
  stopRuntimeSimulation,
  unpauseRuntimeSimulation,
} from '@/graph/graph/runtime-simulation-controls'
import { GraphRuntimeQueryApi } from '@/graph/graph/runtime-query-api'

export abstract class GraphRuntimeSimulationApi extends GraphRuntimeQueryApi {
  /**
   * Start the simulation.
   * This only controls the simulation state, not rendering.
   * @param alpha Value from 0 to 1. The higher the value, the more initial energy the simulation will get.
   */
  public start (alpha = 1): void {
    startRuntimeSimulation(this.getSimulationControlContext(), alpha, () => this.start(alpha))
  }

  /**
   * Stop the simulation. This stops the simulation and resets its state.
   * Use start() to begin a new simulation cycle.
   */
  public stop (): void {
    stopRuntimeSimulation(this.getSimulationControlContext())
  }

  /**
   * Pause the simulation. When paused, the simulation stops running
   * but preserves its current state (progress, alpha).
   * Can be resumed using the unpause method.
   */
  public pause (): void {
    pauseRuntimeSimulation(this.getSimulationControlContext(), () => this.pause())
  }

  /**
   * Unpause the simulation. This method resumes a paused
   * simulation and continues its execution.
   */
  public unpause (): void {
    unpauseRuntimeSimulation(this.getSimulationControlContext(), () => this.unpause())
  }

  /**
   * Run one step of the simulation manually.
   * Works even when the simulation is paused.
   */
  public step (): void {
    stepRuntimeSimulation(this.getSimulationControlContext(), () => this.step())
  }
}
