import type { RenderPass } from '@luma.gl/core'
import { CoreModule } from '@/graph/modules/core-module'
import type { VisiblePointCullState } from '@/graph/modules/Points/passes/visible-culling/prepare'
import * as pointAttributes from '@/graph/modules/Points/runtime-attributes'
import * as pointCulling from '@/graph/modules/Points/runtime-culling'
import * as pointDraw from '@/graph/modules/Points/runtime-draw'
import * as pointImpostorConfig from '@/graph/modules/Points/runtime-impostor-config'
import * as pointPosition from '@/graph/modules/Points/runtime-position'

export abstract class PointRuntimeInternalApi extends CoreModule {
  private get effectivePixelRatio (): number {
    const storeRatio = this.store.effectivePixelRatio
    if (Number.isFinite(storeRatio) && storeRatio > 0) return storeRatio
    const configRatio = this.config.pixelRatio
    return Number.isFinite(configRatio) && configRatio > 0 ? configRatio : 1
  }

  private getTileImpostorSize (): number {
    return pointImpostorConfig.getRuntimeTileImpostorSize(this)
  }

  private getTileImpostorMicroSplats (): number {
    return pointImpostorConfig.getRuntimeTileImpostorMicroSplats(this)
  }

  private getHybridAnchorsPerTile (): number {
    return pointImpostorConfig.getRuntimeHybridAnchorsPerTile(this)
  }

  private getTileBuildSampleRate (): number {
    return pointImpostorConfig.getRuntimeTileBuildSampleRate(this)
  }

  private getTileBuildSampleWeight (): number {
    return pointImpostorConfig.getRuntimeTileBuildSampleWeight(this)
  }

  private setVisiblePointCullState (state: VisiblePointCullState): void {
    pointCulling.setVisiblePointCullState(this, state)
  }

  private drawCulledPointsIndirect (renderPass: RenderPass): boolean {
    return pointDraw.drawCulledPointsIndirect(this, renderPass)
  }

  private ensureDensityImpostorTarget (): void {
    pointDraw.ensureDensityImpostorTarget(this)
  }

  private initDensityImpostorCommands (): void {
    pointDraw.initDensityImpostorCommands(this)
  }

  private initSyncPositionPipeline (): void {
    pointPosition.initSyncPositionPipeline(this)
  }

  private initUpdatePositionComputePipeline (): void {
    pointPosition.initUpdatePositionComputePipeline(this)
  }

  private initDragPointComputePipeline (): void {
    pointPosition.initDragPointComputePipeline(this)
  }

  private updatePositionCompute (): void {
    pointPosition.updatePositionCompute(this)
  }

  private dragCompute (): void {
    pointPosition.dragCompute(this)
  }

  private getEffectivePointLodStrength (): number {
    return this.config.renderLodMode === 'exact' ? 0 : this.config.pointLodStrength
  }

  private rescaleInitialNodePositions (): void {
    pointAttributes.rescaleInitialNodePositions(this)
  }
}
