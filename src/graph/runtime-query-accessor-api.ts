import * as runtimeAccessors from '@/graph/graph/runtime-accessors'
import { GraphRuntimeViewApi } from '@/graph/graph/runtime-view-api'
import { trackRuntimePointPositionsByIndices } from '@/graph/graph/runtime-query-owner'

export abstract class GraphRuntimeQueryAccessorApi extends GraphRuntimeViewApi {
  /**
   * Converts the X and Y point coordinates from the space coordinate system to the screen coordinate system.
   * @param spacePosition Array of x and y coordinates in the space coordinate system.
   * @returns Array of x and y coordinates in the screen coordinate system.
   */
  public spaceToScreenPosition (spacePosition: [number, number]): [number, number] {
    return runtimeAccessors.spaceToScreenPosition(this.getAccessorContext(), spacePosition)
  }

  /**
   * Converts the X and Y point coordinates from the screen coordinate system to the space coordinate system.
   * @param screenPosition Array of x and y coordinates in the screen coordinate system.
   * @returns Array of x and y coordinates in the space coordinate system.
   */
  public screenToSpacePosition (screenPosition: [number, number]): [number, number] {
    return runtimeAccessors.screenToSpacePosition(this.getAccessorContext(), screenPosition)
  }

  /**
   * Converts the point radius value from the space coordinate system to the screen coordinate system.
   * @param spaceRadius Radius of point in the space coordinate system.
   * @returns Radius of point in the screen coordinate system.
   */
  public spaceToScreenRadius (spaceRadius: number): number {
    return runtimeAccessors.spaceToScreenRadius(this.getAccessorContext(), spaceRadius)
  }

  /**
   * Get point radius by its index.
   * @param index Index of the point.
   * @returns Radius of the point.
   */
  public getPointRadiusByIndex (index: number): number | undefined {
    return runtimeAccessors.getPointRadiusByIndex(this.getAccessorContext(), index)
  }

  /**
   * Track multiple point positions by their indices on each Cosmos tick.
   * @param indices Array of points indices.
   */
  public trackPointPositionsByIndices (indices: number[]): void {
    trackRuntimePointPositionsByIndices(this, indices)
  }

  /**
   * Get current X and Y coordinates of the tracked points.
   * Do not mutate the returned map - it may affect future calls.
   * @returns A ReadonlyMap where keys are point indices and values are their corresponding X and Y coordinates in the [number, number] format.
   * @see trackPointPositionsByIndices To set which points should be tracked
   */
  public getTrackedPointPositionsMap (): ReadonlyMap<number, [number, number]> {
    return runtimeAccessors.getTrackedPointPositionsMap(this.getAccessorContext())
  }

  /**
   * Get current X and Y coordinates of the tracked points as an array.
   * @returns Array of point positions in the format [x1, y1, x2, y2, ..., xn, yn] for tracked points only.
   * The positions are ordered by the tracking indices (same order as provided to trackPointPositionsByIndices).
   * Returns an empty array if no points are being tracked.
   */
  public getTrackedPointPositionsArray (): number[] {
    return runtimeAccessors.getTrackedPointPositionsArray(this.getAccessorContext())
  }

  /**
   * For the points that are currently visible on the screen, get a sample of point indices with their coordinates.
   * The resulting number of points will depend on the `pointSamplingDistance` configuration property,
   * and the sampled points will be evenly distributed.
   * @returns A Map object where keys are the index of the points and values are their corresponding X and Y coordinates in the [number, number] format.
   */
  public getSampledPointPositionsMap (): Map<number, [number, number]> {
    return runtimeAccessors.getSampledPointPositionsMap(this.getAccessorContext())
  }

  /**
   * For the points that are currently visible on the screen, get a sample of point indices and positions.
   * The resulting number of points will depend on the `pointSamplingDistance` configuration property,
   * and the sampled points will be evenly distributed.
   * @returns An object containing arrays of point indices and positions.
   */
  public getSampledPoints (): { indices: number[]; positions: number[] } {
    return runtimeAccessors.getSampledPoints(this.getAccessorContext())
  }

  /**
   * For the links that are currently visible on the screen, get a sample of link indices with their midpoint coordinates and angle.
   * The resulting number of links will depend on the `linkSamplingDistance` configuration property,
   * and the sampled links will be evenly distributed (one link per grid cell, based on link midpoint in screen space).
   * Each value is [x, y, angle]: position in data space; angle in radians for screen-space rotation (0 = right, positive = clockwise, e.g. for CSS rotation).
   */
  public getSampledLinkPositionsMap (): Map<number, [number, number, number]> {
    return runtimeAccessors.getSampledLinkPositionsMap(this.getAccessorContext())
  }

  /**
   * For the links that are currently visible on the screen, get a sample of link indices, midpoint positions, and angles.
   * The resulting number of links will depend on the `linkSamplingDistance` configuration property,
   * and the sampled links will be evenly distributed.
   * Positions are in data space; angles are in radians for screen-space rotation (0 = right, positive = clockwise, e.g. for CSS rotation).
   */
  public getSampledLinks (): { indices: number[]; positions: number[]; angles: number[] } {
    return runtimeAccessors.getSampledLinks(this.getAccessorContext())
  }

  /**
   * Gets the X-axis of rescaling function.
   *
   * This scale is automatically created when position rescaling is enabled.
   */
  public getScaleX (): ((x: number) => number) | undefined {
    return runtimeAccessors.getScaleX(this.getAccessorContext())
  }

  /**
   * Gets the Y-axis of rescaling function.
   *
   * This scale is automatically created when position rescaling is enabled.
   */
  public getScaleY (): ((y: number) => number) | undefined {
    return runtimeAccessors.getScaleY(this.getAccessorContext())
  }
}
