import type { GraphConfig } from '@/graph/config'
import type { GraphData } from '@/graph/modules/GraphData'
import {
  setRuntimeClusterPositions,
  setRuntimeConfig,
  setRuntimeConfigPartial,
  setRuntimeImageData,
  setRuntimeLinkArrows,
  setRuntimeLinkColors,
  setRuntimeLinkStrength,
  setRuntimeLinks,
  setRuntimeLinkWidths,
  setRuntimePinnedPoints,
  setRuntimePointClusterStrength,
  setRuntimePointClusters,
  setRuntimePointColors,
  setRuntimePointImageIndices,
  setRuntimePointImageSizes,
  setRuntimePointPositions,
  setRuntimePointShapes,
  setRuntimePointSizes,
} from '@/graph/graph/runtime-data-setters'
import { GraphRuntimeContexts } from '@/graph/graph/runtime-contexts'

interface GraphRuntimeDataApiOwner {
  _isDestroyed: boolean;
  graph: GraphData;
}

export abstract class GraphRuntimeDataApi extends GraphRuntimeContexts {
  private get dataOwner (): GraphRuntimeDataApiOwner {
    return this as unknown as GraphRuntimeDataApiOwner
  }

  public setConfig (config: GraphConfig): void {
    setRuntimeConfig(this.getDataUpdateContext(), config, () => this.setConfig(config))
  }

  public setConfigPartial (config: GraphConfig): void {
    setRuntimeConfigPartial(this.getDataUpdateContext(), config, () => this.setConfigPartial(config))
  }

  public setPointPositions (pointPositions: Float32Array, dontRescale?: boolean | undefined): void {
    setRuntimePointPositions(this.getDataUpdateContext(), pointPositions, dontRescale, () => this.setPointPositions(pointPositions, dontRescale))
  }

  public setPointColors (pointColors: Float32Array): void {
    setRuntimePointColors(this.getDataUpdateContext(), pointColors, () => this.setPointColors(pointColors))
  }

  public getPointColors (): Float32Array {
    const owner = this.dataOwner
    if (owner._isDestroyed) return new Float32Array()
    return owner.graph.pointColors ?? new Float32Array()
  }

  public setPointSizes (pointSizes: Float32Array): void {
    setRuntimePointSizes(this.getDataUpdateContext(), pointSizes, () => this.setPointSizes(pointSizes))
  }

  public setPointShapes (pointShapes: Float32Array): void {
    setRuntimePointShapes(this.getDataUpdateContext(), pointShapes, () => this.setPointShapes(pointShapes))
  }

  public setImageData (imageDataArray: ImageData[]): void {
    setRuntimeImageData(this.getDataUpdateContext(), imageDataArray, () => this.setImageData(imageDataArray))
  }

  public setPointImageIndices (imageIndices: Float32Array): void {
    setRuntimePointImageIndices(this.getDataUpdateContext(), imageIndices, () => this.setPointImageIndices(imageIndices))
  }

  public setPointImageSizes (imageSizes: Float32Array): void {
    setRuntimePointImageSizes(this.getDataUpdateContext(), imageSizes, () => this.setPointImageSizes(imageSizes))
  }

  public getPointSizes (): Float32Array {
    const owner = this.dataOwner
    if (owner._isDestroyed) return new Float32Array()
    return owner.graph.pointSizes ?? new Float32Array()
  }

  public setLinks (links: Float32Array): void {
    setRuntimeLinks(this.getDataUpdateContext(), links, () => this.setLinks(links))
  }

  public setLinkColors (linkColors: Float32Array): void {
    setRuntimeLinkColors(this.getDataUpdateContext(), linkColors, () => this.setLinkColors(linkColors))
  }

  public getLinkColors (): Float32Array {
    const owner = this.dataOwner
    if (owner._isDestroyed) return new Float32Array()
    return owner.graph.linkColors ?? new Float32Array()
  }

  public setLinkWidths (linkWidths: Float32Array): void {
    setRuntimeLinkWidths(this.getDataUpdateContext(), linkWidths, () => this.setLinkWidths(linkWidths))
  }

  public getLinkWidths (): Float32Array {
    const owner = this.dataOwner
    if (owner._isDestroyed) return new Float32Array()
    return owner.graph.linkWidths ?? new Float32Array()
  }

  public setLinkArrows (linkArrows: boolean[]): void {
    setRuntimeLinkArrows(this.getDataUpdateContext(), linkArrows, () => this.setLinkArrows(linkArrows))
  }

  public setLinkStrength (linkStrength: Float32Array): void {
    setRuntimeLinkStrength(this.getDataUpdateContext(), linkStrength, () => this.setLinkStrength(linkStrength))
  }

  public setPointClusters (pointClusters: (number | undefined)[]): void {
    setRuntimePointClusters(this.getDataUpdateContext(), pointClusters, () => this.setPointClusters(pointClusters))
  }

  public setClusterPositions (clusterPositions: (number | undefined)[]): void {
    setRuntimeClusterPositions(this.getDataUpdateContext(), clusterPositions, () => this.setClusterPositions(clusterPositions))
  }

  public setPointClusterStrength (clusterStrength: Float32Array): void {
    setRuntimePointClusterStrength(this.getDataUpdateContext(), clusterStrength, () => this.setPointClusterStrength(clusterStrength))
  }

  public setPinnedPoints (pinnedIndices: number[] | null): void {
    setRuntimePinnedPoints(this.getDataUpdateContext(), pinnedIndices, () => this.setPinnedPoints(pinnedIndices))
  }
}
