import { PointShape } from '@kajillion/graph'
import { applyWorkFocusVisuals } from './work-focus-visuals'
import { applyEdgeVisualAttributes } from './edge-attributes'
import { applyNodeVisualAttributes } from './node-attributes'
import type { VisualAttributeData, VisualAttributeOptions, VisualAttributes } from './types'
import { buildVisualAttributeContext } from './visual-context'

export { buildAnalystPointSizes } from './analyst-sizing'
export type { VisualAttributes } from './types'

export function buildVisualAttributes (
  data: VisualAttributeData,
  options: VisualAttributeOptions
): VisualAttributes {
  const attributes = {
    pointColors: new Float32Array(data.nodeCount * 4),
    pointSizes: new Float32Array(data.nodeCount),
    pointShapes: new Float32Array(data.nodeCount).fill(PointShape.Circle),
    linkColors: new Float32Array(data.edgeCount * 4),
    linkWidths: new Float32Array(data.edgeCount),
  }
  const context = buildVisualAttributeContext(data, options)

  applyNodeVisualAttributes(data, attributes, context)
  applyEdgeVisualAttributes(data, attributes, context)

  if (context.isWork && options.workFocusState) {
    applyWorkFocusVisuals(
      data,
      options.config,
      options.workFocusState,
      attributes.pointColors,
      attributes.pointSizes,
      attributes.linkColors,
      attributes.linkWidths
    )
  }

  return attributes
}
