import { type GraphConfigInterface } from '@/graph/config'
import {
  createLinkArrows,
  createNumericValues,
  createPointImageIndices,
  createPointImageSizes,
  createPointShapes,
  createRgbaValues,
} from './conversions'
import { resolvePointDefaultShape } from './defaults'
import { calculateDegrees, createAdjacencyLists } from './links'
import { updateGraphData } from './lifecycle'
import {
  getConnectedLinkIndices as getConnectedLinkIndicesForData,
  getConnectedPointIndices as getConnectedPointIndicesForData,
  getNeighboringPointIndices as getNeighboringPointIndicesForData,
} from './queries'
import { type LinkAdjacencyList } from './types'
import { resolveLinkStrength, updateClusterData } from './updates'

export { PointShape } from './point-shape'
export type { LinkAdjacencyEntry, LinkAdjacencyList } from './types'

export class GraphData {
  public inputPointPositions: Float32Array | undefined
  public inputPointColors: Float32Array | undefined
  public inputPointSizes: Float32Array | undefined
  public inputPointShapes: Float32Array | undefined
  public inputImageData: ImageData[] | undefined
  public inputPointImageIndices: Float32Array | undefined
  public inputPointImageSizes: Float32Array | undefined
  public inputLinkColors: Float32Array | undefined
  public inputLinkWidths: Float32Array | undefined
  public inputLinkStrength: Float32Array | undefined
  public inputPointClusters: (number | undefined)[] | undefined
  public inputClusterPositions: (number | undefined)[] | undefined
  public inputClusterStrength: Float32Array | undefined
  public inputPinnedPoints: number[] | undefined

  public pointPositions: Float32Array | undefined
  public pointColors: Float32Array | undefined
  public pointSizes: Float32Array | undefined
  public pointShapes: Float32Array | undefined
  public pointImageIndices: Float32Array | undefined
  public pointImageSizes: Float32Array | undefined

  public inputLinks: Float32Array | undefined
  public links: Float32Array | undefined
  public linkColors: Float32Array | undefined
  public linkWidths: Float32Array | undefined
  public linkArrowsBoolean: boolean[] | undefined
  public linkArrows: number[] | undefined
  public linkStrength: Float32Array | undefined

  public pointClusters: (number | undefined)[] | undefined
  public clusterPositions: (number | undefined)[] | undefined
  public clusterStrength: Float32Array | undefined

  /**
   * Each inner array of `sourceIndexToTargetIndices` and `targetIndexToSourceIndices` contains pairs where:
   *   - The first value is the target/source index in the point array.
   *   - The second value is the link index in the array of links.
  */
  public sourceIndexToTargetIndices: LinkAdjacencyList | undefined
  public targetIndexToSourceIndices: LinkAdjacencyList | undefined

  public degree: number[] | undefined
  public inDegree: number[] | undefined
  public outDegree: number[] | undefined
  private _config: GraphConfigInterface

  public constructor (config: GraphConfigInterface) {
    this._config = config
  }

  public get pointsNumber (): number | undefined {
    return this.pointPositions && this.pointPositions.length / 2
  }

  public get linksNumber (): number | undefined {
    return this.links && this.links.length / 2
  }

  public updatePoints (): void { this.pointPositions = this.inputPointPositions }

  public updatePointColor (): void {
    this.pointColors = this.pointsNumber === undefined
      ? undefined
      : createRgbaValues(this.inputPointColors, this.pointsNumber, this._config.pointDefaultColor)
  }

  public updatePointSize (): void {
    this.pointSizes = this.pointsNumber === undefined
      ? undefined
      : createNumericValues(this.inputPointSizes, this.pointsNumber, this._config.pointDefaultSize)
  }

  public updatePointShape (): void {
    this.pointShapes = this.pointsNumber === undefined
      ? undefined
      : createPointShapes(this.inputPointShapes, this.pointsNumber, resolvePointDefaultShape(this._config))
  }

  public updatePointImageIndices (): void {
    this.pointImageIndices = this.pointsNumber === undefined
      ? undefined
      : createPointImageIndices(this.inputPointImageIndices, this.pointsNumber)
  }

  public updatePointImageSizes (): void {
    this.pointImageSizes = this.pointsNumber === undefined
      ? undefined
      : createPointImageSizes(
        this.inputPointImageSizes,
        this.pointsNumber,
        this.pointSizes,
        this._config.pointDefaultSize
      )
  }

  public updateLinks (): void { this.links = this.inputLinks }

  public updateLinkColor (): void {
    this.linkColors = this.linksNumber === undefined
      ? undefined
      : createRgbaValues(this.inputLinkColors, this.linksNumber, this._config.linkDefaultColor)
  }

  public updateLinkWidth (): void {
    this.linkWidths = this.linksNumber === undefined
      ? undefined
      : createNumericValues(this.inputLinkWidths, this.linksNumber, this._config.linkDefaultWidth)
  }

  public updateArrows (): void {
    this.linkArrows = this.linksNumber === undefined
      ? undefined
      : createLinkArrows(this.linkArrowsBoolean, this.linksNumber, this._config.linkDefaultArrows)
  }

  public updateLinkStrength (): void {
    this.linkStrength = resolveLinkStrength(this.inputLinkStrength, this.linksNumber)
  }

  public updateClusters (): void {
    updateClusterData(this)
  }

  public update (): void {
    updateGraphData(this)
    this._createAdjacencyLists()
    this._calculateDegrees()
  }

  public getNeighboringPointIndices (pointIndices: number | number[]): number[] {
    return getNeighboringPointIndicesForData(this, pointIndices)
  }

  public getConnectedLinkIndices (pointIndices: number | number[]): number[] {
    return getConnectedLinkIndicesForData(this, pointIndices)
  }

  public getConnectedPointIndices (linkIndices: number | number[]): number[] {
    return getConnectedPointIndicesForData(this, linkIndices)
  }

  private _createAdjacencyLists (): void {
    const adjacencyLists = createAdjacencyLists(this.links, this.linksNumber, this.pointsNumber)
    this.sourceIndexToTargetIndices = adjacencyLists.sourceIndexToTargetIndices
    this.targetIndexToSourceIndices = adjacencyLists.targetIndexToSourceIndices
  }

  private _calculateDegrees (): void {
    const degrees = calculateDegrees(
      this.pointsNumber,
      this.sourceIndexToTargetIndices,
      this.targetIndexToSourceIndices
    )
    this.degree = degrees.degree
    this.inDegree = degrees.inDegree
    this.outDegree = degrees.outDegree
  }
}
