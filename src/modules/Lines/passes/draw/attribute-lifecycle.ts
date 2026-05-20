import type { Lines } from '@/graph/modules/Lines/renderer/lines'
import {
  createLinkArrowAttributeData,
  createLinkEndpointAttributeData,
  createSequentialLinkIndexData,
} from '@/graph/modules/Lines/passes/draw/attribute-data'
import { updateFloatAttributeBuffer } from '@/graph/modules/Lines/passes/draw/attribute-buffer'
import {
  createSampledLinksAttributes,
} from '@/graph/modules/Lines/passes/sampling/sampled-links-renderer'
import { getLineAttributeBufferUsage } from '@/graph/modules/Lines/passes/draw/program-lifecycle'

export function updateLineEndpointAttributes (lines: Lines): void {
  const { device, data, store } = lines
  if (data.linksNumber === undefined || data.links === undefined) return
  if (!store.pointsTextureSize) return // Guard against 0/undefined

  const { pointAData, pointBData } = createLinkEndpointAttributeData(
    data.linksNumber,
    data.links,
    store.pointsTextureSize
  )

  // Check if buffer needs to be resized (buffers can't be resized, need to recreate)
  const currentSize = (lines.pointABuffer?.byteLength ?? 0) / (Float32Array.BYTES_PER_ELEMENT * 2)
  if (!lines.pointABuffer || currentSize !== data.linksNumber) {
    if (lines.pointABuffer && !lines.pointABuffer.destroyed) {
      lines.pointABuffer.destroy()
    }
    lines.pointABuffer = device.createBuffer({
      data: pointAData,
      usage: getLineAttributeBufferUsage(device),
    })
    // Note: Model attributes are set at creation time, so if Model exists and buffer is recreated,
    // the Model will need to be recreated too. For now, we ensure buffers exist before initPrograms.
  } else {
    lines.pointABuffer.write(pointAData)
  }

  if (!lines.pointBBuffer || currentSize !== data.linksNumber) {
    if (lines.pointBBuffer && !lines.pointBBuffer.destroyed) {
      lines.pointBBuffer.destroy()
    }
    lines.pointBBuffer = device.createBuffer({
      data: pointBData,
      usage: getLineAttributeBufferUsage(device),
    })
  } else {
    lines.pointBBuffer.write(pointBData)
  }

  const linkIndices = createSequentialLinkIndexData(data.linksNumber)
  if (!lines.linkIndexBuffer || currentSize !== data.linksNumber) {
    if (lines.linkIndexBuffer && !lines.linkIndexBuffer.destroyed) {
      lines.linkIndexBuffer.destroy()
    }
    lines.linkIndexBuffer = device.createBuffer({
      data: linkIndices,
      usage: getLineAttributeBufferUsage(device),
    })
  } else {
    lines.linkIndexBuffer.write(linkIndices)
  }
  if (lines.drawCurveCommand) {
    lines.drawCurveCommand.setAttributes({
      pointA: lines.pointABuffer,
      pointB: lines.pointBBuffer,
      linkIndices: lines.linkIndexBuffer,
    })
  }
  lines.drawCurveIndexCommand?.setAttributes({
    pointA: lines.pointABuffer,
    pointB: lines.pointBBuffer,
    linkIndices: lines.linkIndexBuffer,
  })
  if (lines.fillSampledLinksFboCommand) {
    lines.fillSampledLinksFboCommand.setAttributes(createSampledLinksAttributes({
      pointABuffer: lines.pointABuffer,
      pointBBuffer: lines.pointBBuffer,
      linkIndexBuffer: lines.linkIndexBuffer,
    }))
  }

  lines.updateSampledLinksGrid()
  if (lines.config.highlightedLinkIndices !== undefined) lines.updateLinkStatus()
}

export function updateLineColorAttribute (lines: Lines): void {
  const { device, data } = lines
  const linksNumber = data.linksNumber ?? 0
  const colorData = data.linkColors ?? new Float32Array(linksNumber * 4).fill(0)

  lines.colorBuffer = updateFloatAttributeBuffer({
    device,
    buffer: lines.colorBuffer,
    data: colorData,
    itemCount: linksNumber,
    componentsPerItem: 4,
    usage: getLineAttributeBufferUsage(device),
  })
  if (lines.drawCurveCommand) {
    lines.drawCurveCommand.setAttributes({
      color: lines.colorBuffer,
    })
  }
  lines.drawCurveIndexCommand?.setAttributes({
    color: lines.colorBuffer,
  })
}

export function updateLineWidthAttribute (lines: Lines): void {
  const { device, data } = lines
  const linksNumber = data.linksNumber ?? 0
  const widthData = data.linkWidths ?? new Float32Array(linksNumber).fill(0)

  lines.widthBuffer = updateFloatAttributeBuffer({
    device,
    buffer: lines.widthBuffer,
    data: widthData,
    itemCount: linksNumber,
    componentsPerItem: 1,
    usage: getLineAttributeBufferUsage(device),
  })
  if (lines.drawCurveCommand) {
    lines.drawCurveCommand.setAttributes({
      width: lines.widthBuffer,
    })
  }
  lines.drawCurveIndexCommand?.setAttributes({
    width: lines.widthBuffer,
  })
}

export function updateLineArrowAttribute (lines: Lines): void {
  const { device, data } = lines
  // linkArrows is number[] not Float32Array, so we need to convert it
  // Ensure we have the right size even if linkArrows is undefined
  const linksNumber = data.linksNumber ?? 0
  const { arrowData, hasArrowedLinks } = createLinkArrowAttributeData(linksNumber, data.linkArrows)
  // Expose the all-zero (no-arrows) case to the fragment shader as a
  // dead-strippable uniform flag.
  lines.hasArrowedLinks = hasArrowedLinks

  lines.arrowBuffer = updateFloatAttributeBuffer({
    device,
    buffer: lines.arrowBuffer,
    data: arrowData,
    itemCount: linksNumber,
    componentsPerItem: 1,
    usage: getLineAttributeBufferUsage(device),
  })
  if (lines.drawCurveCommand) {
    lines.drawCurveCommand.setAttributes({
      arrow: lines.arrowBuffer,
    })
  }
  lines.drawCurveIndexCommand?.setAttributes({
    arrow: lines.arrowBuffer,
  })
}
