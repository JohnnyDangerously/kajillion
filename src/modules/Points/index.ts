import { Framebuffer, Buffer, Texture, type Device } from '@luma.gl/core'
// import { scaleLinear } from 'd3-scale'
// import { extent } from 'd3-array'
import { type GraphConfigInterface } from '@/graph/config'
import { GraphData } from '@/graph/modules/GraphData'
import { Store } from '@/graph/modules/Store'
import { initializePointRuntimeState } from '@/graph/modules/Points/runtime-state'
import { PointRuntimeCore } from '@/graph/modules/Points/runtime-api'

export class Points extends PointRuntimeCore {
  public currentPositionFbo: Framebuffer | undefined
  public previousPositionFbo: Framebuffer | undefined
  public velocityFbo: Framebuffer | undefined
  public searchFbo: Framebuffer | undefined
  public hoveredFbo: Framebuffer | undefined
  public scaleX: ((x: number) => number) | undefined
  public scaleY: ((y: number) => number) | undefined
  public shouldSkipRescale: boolean | undefined
  public imageAtlasTexture: Texture | undefined
  // WebGPU-only mirror of currentPositionTexture as a storage buffer. Vertex
  // shaders read positions[idx] instead of textureSampleLevel(positionsTexture)
  // — the texture path costs ~750ms/frame at n=100k due to vertex-stage texture
  // sampling on Apple TBDR; storage-buffer reads drop that to ~10ms.
  public positionStorageBuffer: Buffer | undefined
  public previousRenderPositionStorageBuffer: Buffer | undefined
  public renderPositionMix = 1
  public isPositionStorageBufferDirty = true
  public pointStatusStorageBuffer: Buffer | undefined
  public imageCount = 0
  // Cached at setPointShapes() time. Lets the fragment shader skip the
  // 8-way shape-distance ladder when every point in the dataset is the
  // default circle (the common case for tools that don't customize point
  // shapes per-instance).
  public hasNonCircleShapes = false
  // Add texture properties for position data (public for Clusters module access)
  public currentPositionTexture: Texture | undefined
  public previousPositionTexture: Texture | undefined
  public velocityTexture: Texture | undefined
  public pointStatusTexture: Texture | undefined
  /**
   * Whether the cached cluster centroid positions are still valid.
   * Set to `false` in `swapFbo()` whenever GPU point positions change (simulation tick or drag).
   * Set to `true` by `Clusters.getCentroidPositions()` after a fresh computation.
   * Used together with `Clusters.cachedCentroidPositions` to skip redundant GPU readbacks.
   */
  public areClusterCentroidsUpToDate = false

  public constructor (
    device: Device,
    config: GraphConfigInterface,
    store: Store,
    data: GraphData,
    points?: Points
  ) {
    super(device, config, store, data, points)
    initializePointRuntimeState(this)
  }
}
