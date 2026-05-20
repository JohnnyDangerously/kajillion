import { flattenPointPositions, pairPointPositions } from '@/graph/graph/coordinate-arrays'
import { renderGraphRuntime } from '@/graph/graph/runtime-render-entry'
import {
  fitRuntimeView,
  fitRuntimeViewByPointIndices,
  fitRuntimeViewByPointPositions,
  setRuntimeZoomTransformByPointPositions,
  zoomRuntimeToPointByIndex,
} from '@/graph/graph/runtime-view-controls'
import { GraphRuntimeInspectionApi } from '@/graph/graph/runtime-inspection-api'
import * as runtimeViewOwner from '@/graph/graph/runtime-view-owner'

export abstract class GraphRuntimeViewApi extends GraphRuntimeInspectionApi {
  private get viewOwner (): runtimeViewOwner.GraphRuntimeViewOwner {
    return this as unknown as runtimeViewOwner.GraphRuntimeViewOwner
  }

  /**
   * Renders the graph and starts rendering.
   * Does NOT modify simulation state - use start(), stop(), pause(), unpause() to control simulation.
   *
   * @param {number} [simulationAlpha] - Optional alpha value to set.
   *   - If 0: Sets alpha to 0, simulation stops after one frame (graph becomes static).
   *   - If positive: Sets alpha to that value.
   *   - If undefined: Keeps current alpha value.
   */
  public render (simulationAlpha?: number): void {
    renderGraphRuntime(this.getRenderEntryContext(), simulationAlpha, () => this.render(simulationAlpha))
  }

  /**
   * Center the view on a point and zoom in, by point index.
   * @param index The index of the point in the array of points.
   * @param duration Duration of the animation transition in milliseconds (`700` by default).
   * @param scale Scale value to zoom in or out (`3` by default).
   * @param canZoomOut Set to `false` to prevent zooming out from the point (`true` by default).
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public zoomToPointByIndex (index: number, duration = 700, scale = 3, canZoomOut = true, enableSimulation = true): void {
    zoomRuntimeToPointByIndex(
      this.getViewControlContext(),
      index,
      duration,
      scale,
      canZoomOut,
      enableSimulation,
      () => this.zoomToPointByIndex(index, duration, scale, canZoomOut, enableSimulation),
    )
  }

  /**
   * Zoom the view in or out to the specified zoom level.
   * @param value Zoom level
   * @param duration Duration of the zoom in/out transition.
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public zoom (value: number, duration = 0, enableSimulation = true): void {
    runtimeViewOwner.zoomRuntimeView(this.viewOwner, value, duration, enableSimulation)
  }

  /**
   * Zoom the view in or out to the specified zoom level.
   * @param value Zoom level
   * @param duration Duration of the zoom in/out transition.
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public setZoomLevel (value: number, duration = 0, enableSimulation = true): void {
    runtimeViewOwner.setRuntimeViewZoomLevel(this.viewOwner, value, duration, enableSimulation, () => this.setZoomLevel(value, duration, enableSimulation))
  }

  /**
   * Set zoom using the normalized product distance scale.
   * `100` is the configured minimum zoom / macro overview, `1` is the configured maximum zoom / close work mode.
   */
  public setZoomDistance (value: number, duration = 0, enableSimulation = true): void {
    runtimeViewOwner.setRuntimeViewZoomDistance(this.viewOwner, value, duration, enableSimulation)
  }

  /**
   * Get zoom level.
   * @returns Zoom level value of the view.
   */
  public getZoomLevel (): number {
    return runtimeViewOwner.getRuntimeViewZoomLevel(this.viewOwner)
  }

  /**
   * Get the normalized product zoom distance.
   * `100` is the configured minimum zoom / macro overview, `1` is the configured maximum zoom / close work mode.
   */
  public getZoomDistance (): number {
    return runtimeViewOwner.getRuntimeViewZoomDistance(this.viewOwner)
  }

  public zoomLevelToDistance (zoomLevel: number): number {
    return runtimeViewOwner.runtimeViewZoomLevelToDistance(this.viewOwner, zoomLevel)
  }

  public zoomDistanceToLevel (distance: number): number {
    return runtimeViewOwner.runtimeViewZoomDistanceToLevel(this.viewOwner, distance)
  }

  /**
   * Center and zoom in/out the view to fit all points in the scene.
   * @param duration Duration of the center and zoom in/out animation in milliseconds (`250` by default).
   * @param padding Padding around the viewport in percentage (`0.1` by default).
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public fitView (duration = 250, padding = 0.1, enableSimulation = true): void {
    fitRuntimeView(this.getViewControlContext(), duration, padding, enableSimulation, () => this.fitView(duration, padding, enableSimulation))
  }

  /**
   * Center and zoom in/out the view to fit points by their indices in the scene.
   * @param indices Point indices to fit in the view.
   * @param duration Duration of the center and zoom in/out animation in milliseconds (`250` by default).
   * @param padding Padding around the viewport in percentage (`0.1` by default).
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public fitViewByPointIndices (indices: number[], duration = 250, padding = 0.1, enableSimulation = true): void {
    fitRuntimeViewByPointIndices(
      this.getViewControlContext(),
      indices,
      duration,
      padding,
      enableSimulation,
      () => this.fitViewByPointIndices(indices, duration, padding, enableSimulation),
    )
  }

  /**
   * Center and zoom in/out the view to fit points by their positions in the scene.
   * @param positions Flat array of point coordinates as `[x0, y0, x1, y1, ...]`.
   * @param duration Duration of the center and zoom in/out animation in milliseconds (`250` by default).
   * @param padding Padding around the viewport in percentage (`0.1` by default).
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public fitViewByPointPositions (positions: number[], duration = 250, padding = 0.1, enableSimulation = true): void {
    fitRuntimeViewByPointPositions(
      this.getViewControlContext(),
      positions,
      duration,
      padding,
      enableSimulation,
      () => this.fitViewByPointPositions(positions, duration, padding, enableSimulation),
    )
  }

  /**
   * Sets the zoom transform so that the given point positions fit in the viewport, with optional animation.
   *
   * @param positions Flat array of point coordinates as `[x0, y0, x1, y1, ...]`.
   * @param duration Animation duration in milliseconds. Default `250`.
   * @param scale Optional scale factor; if omitted, scale is chosen to fit the positions.
   * @param padding Padding around the viewport as a fraction (e.g. `0.1` = 10%). Default `0.1`.
   * @param enableSimulation Whether to run the simulation during the zoom transition (`true` by default).
   */
  public setZoomTransformByPointPositions (positions: Float32Array, duration = 250, scale?: number, padding = 0.1, enableSimulation = true): void {
    setRuntimeZoomTransformByPointPositions(
      this.getViewControlContext(),
      positions,
      duration,
      scale,
      padding,
      enableSimulation,
      () => this.setZoomTransformByPointPositions(positions, duration, scale, padding, enableSimulation),
    )
  }

  /**
   * Converts an array of tuple positions to a single array containing all coordinates sequentially
   * @param pointPositions An array of tuple positions
   * @returns A flatten array of coordinates
   */
  public flatten (pointPositions: [number, number][]): number[] {
    return flattenPointPositions(pointPositions)
  }

  /**
   * Converts a flat array of point positions to a tuple pairs representing coordinates
   * @param pointPositions A flattened array of coordinates
   * @returns An array of tuple positions
   */
  public pair (pointPositions: number[]): [number, number][] {
    return pairPointPositions(pointPositions)
  }
}
