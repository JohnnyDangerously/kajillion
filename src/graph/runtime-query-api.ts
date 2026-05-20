import * as runtimeSelection from '@/graph/graph/selection/runtime-selection'
import { GraphRuntimeQueryAccessorApi } from '@/graph/graph/runtime-query-accessor-api'
import {
  getRuntimeConnectedLinkIndices,
  getRuntimeConnectedPointIndices,
  getRuntimeNeighboringPointIndices,
} from '@/graph/graph/runtime-query-owner'

export abstract class GraphRuntimeQueryApi extends GraphRuntimeQueryAccessorApi {
  /**
   * Find point indices inside a rectangular area.
   *
   * **Important:** This method is synchronous and must only be called when the graph is ready.
   * Ensure `await graph.ready` has resolved (or use the result inside `graph.ready.then(...)`) before
   * calling. If called before initialization completes, returns an empty array.
   *
   * @param rect - Array of two corner points `[[left, top], [right, bottom]]`.
   * The coordinates should be from 0 to the width/height of the canvas.
   * @returns Array of point indices inside the rectangle.
   */
  public findPointsInRect (rect: [[number, number], [number, number]]): number[] {
    return runtimeSelection.findPointsInRect(this.getSelectionContext(), rect)
  }

  /**
   * Async version of `findPointsInRect`. On WebGPU this runs the existing GPU
   * selection mask pass and reads back the mask, avoiding CPU geometry tests.
   */
  public async findPointsInRectAsync (rect: [[number, number], [number, number]]): Promise<number[]> {
    return runtimeSelection.findPointsInRectAsync(this.getSelectionContext(), rect)
  }

  /**
   * Find point indices inside a polygon area.
   *
   * **Important:** This method is synchronous and must only be called when the graph is ready.
   * Ensure `await graph.ready` has resolved (or use the result inside `graph.ready.then(...)`) before
   * calling. If called before initialization completes, returns an empty array.
   *
   * @param polygonPath - Array of points `[[x1, y1], [x2, y2], ..., [xn, yn]]` that defines the polygon.
   * The coordinates should be from 0 to the width/height of the canvas.
   * @returns Array of point indices inside the polygon.
   */
  public findPointsInPolygon (polygonPath: [number, number][]): number[] {
    return runtimeSelection.findPointsInPolygon(this.getSelectionContext(), polygonPath)
  }

  /**
   * Async version of `findPointsInPolygon`. On WebGPU this runs the GPU
   * polygon selection mask pass and reads back the mask, avoiding CPU
   * point-in-polygon tests.
   */
  public async findPointsInPolygonAsync (polygonPath: [number, number][]): Promise<number[]> {
    return runtimeSelection.findPointsInPolygonAsync(this.getSelectionContext(), polygonPath)
  }

  /**
   * Get point indices that are neighbors of the given point(s) - connected by a link in either direction.
   * @param pointIndices A single point index or an array of point indices.
   * @returns Deduplicated array of neighboring point indices.
   */
  public getNeighboringPointIndices (pointIndices: number | number[]): number[] {
    return getRuntimeNeighboringPointIndices(this, pointIndices)
  }

  /**
   * Get link indices where both endpoints are within the given point(s).
   * @param pointIndices A single point index or an array of point indices.
   * @returns Deduplicated array of link indices connecting points within the provided set.
   */
  public getConnectedLinkIndices (pointIndices: number | number[]): number[] {
    return getRuntimeConnectedLinkIndices(this, pointIndices)
  }

  /**
   * Get point indices at the endpoints of the given link(s).
   * @param linkIndices A single link index or an array of link indices.
   * @returns Deduplicated array of point indices at the ends of the provided links.
   */
  public getConnectedPointIndices (linkIndices: number | number[]): number[] {
    return getRuntimeConnectedPointIndices(this, linkIndices)
  }
}
