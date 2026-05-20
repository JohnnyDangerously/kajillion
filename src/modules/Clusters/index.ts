import type { Framebuffer, Buffer, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import { CoreModule } from '@/graph/modules/core-module'

import { readCentroidPositions } from './centroids'
import type {
  ApplyForcesUniformStoreShape,
  CalculateCentermassUniformStoreShape,
} from './contracts'
import {
  createClusterRuntimeState,
  destroyClusterRuntimeState,
} from './lifecycle'
import { initializeClusterPrograms } from './programs'
import { renderApplyForces, renderCalculateCentermass } from './render'

export class Clusters extends CoreModule {
  public centermassFbo: Framebuffer | undefined
  public clusterCount: number | undefined

  private calculateCentermassCommand: Model | undefined
  private applyForcesCommand: Model | undefined
  private clusterTexture: Texture | undefined
  private clusterPositionsTexture: Texture | undefined
  private clusterForceCoefficientTexture: Texture | undefined
  private centermassTexture: Texture | undefined
  private pointIndices: Buffer | undefined
  private clustersTextureSize: number | undefined

  /**
   * Cached result of the last `getCentroidPositions()` computation.
   * Populated when the simulation is inactive to avoid redundant GPU render passes and readbacks.
   * Nulled in `create()` and `destroy()` to handle structural changes (e.g. `setPointPositions`,
   * `setPointClusters`). Positional changes are handled separately via `Points.areClusterCentroidsUpToDate`.
   */
  private cachedCentroidPositions: number[] | null = null
  private applyForcesVertexCoordBuffer: Buffer | undefined

  // Track previous sizes to detect changes
  private previousPointsTextureSize: number | undefined
  private previousClustersTextureSize: number | undefined
  private previousClusterCount: number | undefined

  // Uniform stores for scalar uniforms
  private calculateCentermassUniformStore: UniformStore<CalculateCentermassUniformStoreShape> | undefined

  private applyForcesUniformStore: UniformStore<ApplyForcesUniformStoreShape> | undefined

  public create (): void {
    this.cachedCentroidPositions = null
    const { device, store, data } = this
    const { pointsTextureSize } = store

    const runtimeState = createClusterRuntimeState({
      device,
      pointsTextureSize,
      pointsNumber: data.pointsNumber,
      pointClusters: data.pointClusters,
      clusterPositionValues: data.clusterPositions,
      clusterStrength: data.clusterStrength,
      previousPointsTextureSize: this.previousPointsTextureSize,
      previousClustersTextureSize: this.previousClustersTextureSize,
      previousClusterCount: this.previousClusterCount,
      clusterTexture: this.clusterTexture,
      clusterPositionsTexture: this.clusterPositionsTexture,
      clusterForceCoefficientTexture: this.clusterForceCoefficientTexture,
      centermassTexture: this.centermassTexture,
      centermassFbo: this.centermassFbo,
      pointIndices: this.pointIndices,
      calculateCentermassCommand: this.calculateCentermassCommand,
    })
    if (!runtimeState) return
    Object.assign(this, runtimeState)
  }

  public initPrograms (): void {
    const { device, store, data } = this
    // Use same check as create() and run() for consistency
    if (data.pointsNumber === undefined || (!data.pointClusters && !data.clusterPositions)) return

    const programs = initializeClusterPrograms({
      device,
      pointsTextureSize: store.pointsTextureSize,
      pointsNumber: data.pointsNumber ?? 0,
      alpha: store.alpha,
      clustersTextureSize: this.clustersTextureSize ?? 0,
      simulationCluster: this.config.simulationCluster,
      pointIndices: this.pointIndices,
      calculateCentermassUniformStore: this.calculateCentermassUniformStore,
      calculateCentermassCommand: this.calculateCentermassCommand,
      applyForcesUniformStore: this.applyForcesUniformStore,
      applyForcesVertexCoordBuffer: this.applyForcesVertexCoordBuffer,
      applyForcesCommand: this.applyForcesCommand,
    })
    this.calculateCentermassUniformStore = programs.calculateCentermassUniformStore
    this.calculateCentermassCommand = programs.calculateCentermassCommand
    this.applyForcesUniformStore = programs.applyForcesUniformStore
    this.applyForcesVertexCoordBuffer = programs.applyForcesVertexCoordBuffer
    this.applyForcesCommand = programs.applyForcesCommand
  }

  public calculateCentermass (): void {
    renderCalculateCentermass({
      device: this.device,
      command: this.calculateCentermassCommand,
      uniformStore: this.calculateCentermassUniformStore,
      pointIndices: this.pointIndices,
      framebuffer: this.centermassFbo,
      clusterTexture: this.clusterTexture,
      positionsTexture: this.points?.previousPositionTexture,
      pointsNumber: this.data.pointsNumber,
      pointsTextureSize: this.store.pointsTextureSize,
      clustersTextureSize: this.clustersTextureSize,
    })
  }

  /** Do not mutate the returned array; it may be the internal cache. */
  public getCentroidPositions (): Readonly<number[]> {
    const { config: { enableSimulation }, store: { isSimulationRunning } } = this
    const simulationInactive = !enableSimulation || !isSimulationRunning

    // Return cache when simulation is stopped and positions haven't changed
    if (simulationInactive && this.points?.areClusterCentroidsUpToDate && this.cachedCentroidPositions) {
      return this.cachedCentroidPositions
    }

    this.calculateCentermass()

    // Guard: calculateCentermass() may return early if GPU resources aren't ready
    if (!this.centermassFbo || this.centermassFbo.destroyed || this.clusterCount === undefined) return []

    const positions = readCentroidPositions({
      device: this.device,
      framebuffer: this.centermassFbo,
      clusterCount: this.clusterCount,
    })

    // Warm the cache when simulation is inactive
    if (simulationInactive && this.points) {
      this.cachedCentroidPositions = positions
      this.points.areClusterCentroidsUpToDate = true
    }

    return positions
  }

  public run (): void {
    if (!this.data.pointClusters && !this.data.clusterPositions) return

    // Calculate centermass (creates its own RenderPass - different framebuffer)
    this.calculateCentermass()

    renderApplyForces({
      device: this.device,
      command: this.applyForcesCommand,
      uniformStore: this.applyForcesUniformStore,
      clusterTexture: this.clusterTexture,
      centermassTexture: this.centermassTexture,
      clusterPositionsTexture: this.clusterPositionsTexture,
      clusterForceCoefficientTexture: this.clusterForceCoefficientTexture,
      positionsTexture: this.points?.previousPositionTexture,
      velocityFbo: this.points?.velocityFbo,
      alpha: this.store.alpha,
      clustersTextureSize: this.clustersTextureSize,
      simulationCluster: this.config.simulationCluster,
    })
  }

  /**
   * Destruction order matters
   * Models -> Framebuffers -> Textures -> UniformStores -> Buffers
   */
  public destroy (): void {
    this.cachedCentroidPositions = null
    Object.assign(this, destroyClusterRuntimeState({
      calculateCentermassCommand: this.calculateCentermassCommand,
      applyForcesCommand: this.applyForcesCommand,
      centermassFbo: this.centermassFbo,
      clusterTexture: this.clusterTexture,
      clusterPositionsTexture: this.clusterPositionsTexture,
      clusterForceCoefficientTexture: this.clusterForceCoefficientTexture,
      centermassTexture: this.centermassTexture,
      calculateCentermassUniformStore: this.calculateCentermassUniformStore,
      applyForcesUniformStore: this.applyForcesUniformStore,
      pointIndices: this.pointIndices,
      applyForcesVertexCoordBuffer: this.applyForcesVertexCoordBuffer,
    }))
  }
}
