import { Device, type Buffer, type Framebuffer, type Texture } from '@luma.gl/core'
import { type GraphConfigInterface } from '@/graph/config/schema'
import { GraphData } from '@/graph/modules/GraphData'
import { Store } from '@/graph/modules/Store'

export interface CorePointsRef {
  currentPositionFbo: Framebuffer | undefined;
  previousPositionFbo: Framebuffer | undefined;
  velocityFbo: Framebuffer | undefined;
  currentPositionTexture: Texture | undefined;
  previousPositionTexture: Texture | undefined;
  velocityTexture: Texture | undefined;
  positionStorageBuffer: Buffer | undefined;
  previousRenderPositionStorageBuffer: Buffer | undefined;
  renderPositionMix: number;
  areClusterCentroidsUpToDate: boolean;
  updatePosition: () => void;
  swapFbo: () => void;
  trackPoints: () => void;
}

export class CoreModule {
  public readonly device: Device
  public readonly config: GraphConfigInterface
  public readonly store: Store
  public readonly data: GraphData
  public readonly points: CorePointsRef | undefined
  public _debugRandomNumber = Math.floor(Math.random() * 1000)

  public constructor (
    device: Device,
    config: GraphConfigInterface,
    store: Store,
    data: GraphData,
    points?: CorePointsRef
  ) {
    this.device = device
    this.config = config
    this.store = store
    this.data = data
    if (points) this.points = points
  }
}
