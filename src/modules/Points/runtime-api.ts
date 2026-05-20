import type { RenderPass } from '@luma.gl/core'
import type {
  GpuTimerLike,
} from '@/graph/modules/Points/passes/shared/contracts'
import { destroyPointResources } from '@/graph/modules/Points/passes/resources/destroy'
import {
  drawImpostorCompositePass,
  drawImpostorExactOverlayPass,
  renderImpostorDensityPass,
} from '@/graph/modules/Points/passes/impostors/stateRender'
import { initPointPrograms } from '@/graph/modules/Points/passes/programs/init'
import { PointRuntimeInternalApi } from '@/graph/modules/Points/runtime-api-internals'
import { markPointRuntimeActiveMaskDirty } from '@/graph/modules/Points/runtime-state'
import * as pointAttributes from '@/graph/modules/Points/runtime-attributes'
import * as pointCulling from '@/graph/modules/Points/runtime-culling'
import * as pointDraw from '@/graph/modules/Points/runtime-draw'
import * as pointPosition from '@/graph/modules/Points/runtime-position'
import * as pointSearchTracking from '@/graph/modules/Points/runtime-search-tracking'

export abstract class PointRuntimeCore extends PointRuntimeInternalApi {
  public updatePositions (): void {
    pointAttributes.updatePointPositions(this)
  }

  public initPrograms (): void {
    initPointPrograms(this)
  }

  public updateColor (): void {
    pointAttributes.updatePointColor(this)
  }

  public updatePointStatus (): void {
    pointAttributes.updatePointStatus(this)
  }

  public updatePinnedStatus (): void {
    pointAttributes.updatePinnedPointStatus(this)
  }

  public updateSize (): void {
    pointAttributes.updatePointSize(this)
  }

  public updateShape (): void {
    pointAttributes.updatePointShape(this)
  }

  public updateImageIndices (): void {
    pointAttributes.updatePointImageIndices(this)
  }

  public updateImageSizes (): void {
    pointAttributes.updatePointImageSizes(this)
  }

  public createAtlas (): void {
    pointAttributes.createPointAtlas(this)
  }

  public updateSampledPointsGrid (): void {
    pointAttributes.updateSampledPointsGridState(this)
  }

  public trackPoints (): void {
    pointSearchTracking.trackPoints(this)
  }

  public draw (renderPass: RenderPass, usePreparedCulledDraw = false): void {
    pointDraw.drawPoints(this, renderPass, usePreparedCulledDraw)
  }

  public prepareGpuCulledDraw (timer?: GpuTimerLike, forcePolicy = false): boolean {
    return pointCulling.prepareGpuCulledPointDraw(this, timer, forcePolicy)
  }

  public renderImpostorDensity (timer?: GpuTimerLike, positionEpoch = 0): boolean {
    return renderImpostorDensityPass(this, timer, positionEpoch)
  }

  public drawImpostorComposite (renderPass: RenderPass): boolean {
    return drawImpostorCompositePass(this, renderPass)
  }

  public drawImpostorExactOverlay (renderPass: RenderPass): void {
    drawImpostorExactOverlayPass(this, renderPass)
  }

  public updatePosition (): void {
    pointPosition.updatePosition(this)
  }

  public drag (): void {
    pointPosition.dragPoint(this)
  }

  public findPointsInRect (): boolean {
    return pointSearchTracking.findPointsInRect(this)
  }

  public findPointsInPolygon (): boolean {
    return pointSearchTracking.findPointsInPolygon(this)
  }

  public updatePolygonPath (polygonPath: [number, number][]): void {
    pointSearchTracking.updatePolygonPath(this, polygonPath)
  }

  public findHoveredPoint (): void {
    pointSearchTracking.findHoveredPoint(this)
  }

  public trackPointsByIndices (indices?: number[] | undefined): void {
    pointSearchTracking.trackPointsByIndices(this, indices)
  }

  public getTrackedPositionsMap (): ReadonlyMap<number, [number, number]> {
    return pointSearchTracking.getTrackedPositionsMap(this)
  }

  public getSampledPointPositionsMap (): Map<number, [number, number]> {
    return pointSearchTracking.getSampledPointPositionsMap(this)
  }

  public getSampledPoints (): { indices: number[]; positions: number[] } {
    return pointSearchTracking.getSampledPoints(this)
  }

  public getTrackedPositionsArray (): number[] {
    return pointSearchTracking.getTrackedPositionsArray(this)
  }

  public destroy (): void {
    destroyPointResources(this)
  }

  public syncPositionStorageBuffer (force = false): boolean {
    return pointPosition.syncPositionStorageBuffer(this, force)
  }

  public setRenderPositionInterpolation (value: number): void {
    pointPosition.setRenderPositionInterpolation(this, value)
  }

  public captureRenderPreviousPositions (): boolean {
    return pointPosition.captureRenderPreviousPositions(this)
  }

  public async readbackPointPositions (): Promise<Float32Array> {
    return pointPosition.readbackPointPositions(this)
  }

  public swapFbo (): void {
    pointPosition.swapFbo(this)
  }

  public updateActivePointMask (): void {
    pointCulling.updateActivePointMask(this)
  }

  public markActivePointMaskDirty (): void {
    markPointRuntimeActiveMaskDirty(this)
  }
}
