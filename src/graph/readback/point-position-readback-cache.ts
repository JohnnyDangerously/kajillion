export type PointPositionReadback = () => Promise<Float32Array>

interface PointPositionReadbackCacheOptions {
  readonly minSnapshotIntervalMs?: number;
  readonly now?: () => number;
}

interface PointPositionReadbackRequest {
  readonly force?: boolean;
  readonly readPositions: PointPositionReadback;
  readonly isDestroyed: () => boolean;
  readonly onCache?: (positions: Float32Array, epoch: number) => void;
  readonly onError?: (error: unknown) => void;
}

export class PointPositionReadbackCache {
  private readonly minSnapshotIntervalMs: number
  private readonly now: () => number
  private currentEpoch = 0
  private cached: Float32Array | undefined
  private cachedEpochValue = -1
  private isReadbackInFlight = false
  private isReadbackQueued = false
  private lastReadbackMs = 0

  public constructor (options: PointPositionReadbackCacheOptions = {}) {
    this.minSnapshotIntervalMs = options.minSnapshotIntervalMs ?? 250
    this.now = options.now ?? (() => performance.now())
  }

  public get epoch (): number {
    return this.currentEpoch
  }

  public get cachedPositions (): Float32Array | undefined {
    return this.cached
  }

  public get cachedEpoch (): number {
    return this.cachedEpochValue
  }

  public get isStale (): boolean {
    return this.cachedEpochValue < this.currentEpoch
  }

  public markChanged (invalidateCache = false): void {
    this.currentEpoch += 1
    if (invalidateCache) this.clearCache()
  }

  public clearCache (): void {
    this.cached = undefined
    this.cachedEpochValue = -1
  }

  public cachePositions (positions: Float32Array, epoch: number): void {
    this.cached = positions
    this.cachedEpochValue = epoch
    this.lastReadbackMs = this.now()
  }

  public async readCurrent (request: Omit<PointPositionReadbackRequest, 'force' | 'onError'>): Promise<Float32Array> {
    const epoch = this.currentEpoch
    const positions = await request.readPositions()
    if (!request.isDestroyed() && positions.length > 0) {
      this.cachePositions(positions, epoch)
      request.onCache?.(positions, epoch)
    }
    return positions
  }

  public requestSnapshot (request: PointPositionReadbackRequest): void {
    const force = request.force ?? false
    const now = this.now()
    if (!force && now - this.lastReadbackMs < this.minSnapshotIntervalMs) return
    if (this.isReadbackInFlight) {
      this.isReadbackQueued = true
      return
    }
    this.isReadbackInFlight = true
    const epoch = this.currentEpoch
    request.readPositions()
      .then((positions) => {
        if (!request.isDestroyed() && positions.length > 0) {
          this.cachePositions(positions, epoch)
          request.onCache?.(positions, epoch)
        }
      })
      .catch((error) => {
        request.onError?.(error)
      })
      .finally(() => {
        this.isReadbackInFlight = false
        if (this.isReadbackQueued) {
          this.isReadbackQueued = false
          this.requestSnapshot({ ...request, force: true })
        }
      })
  }
}

export function copyPointPositions (
  positions: Float32Array | undefined,
  pointCount: number
): number[] {
  const result: number[] = []
  result.length = pointCount * 2
  if (!positions) return result
  for (let i = 0; i < pointCount; i += 1) {
    result[i * 2] = positions[i * 2] ?? 0
    result[i * 2 + 1] = positions[i * 2 + 1] ?? 0
  }
  return result
}
