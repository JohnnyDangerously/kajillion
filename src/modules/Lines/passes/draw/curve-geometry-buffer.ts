import { Buffer } from '@luma.gl/core'
import { getCurveLineGeometry } from '@/graph/modules/Lines/geometry'
import { getEffectiveLineSegments } from '@/graph/modules/Lines/features/draw-lifecycle/lifecycle'
import type { LinesRendererContext } from '@/graph/modules/Lines/renderer/contracts'

export function updateCurveLineGeometryBuffer (lines: LinesRendererContext): void {
  const { device } = lines
  lines.curveLineGeometry = getCurveLineGeometry(getEffectiveLineSegments(lines.config))

  // Flatten the 2D array to 1D
  const flatGeometry = new Float32Array(lines.curveLineGeometry.length * 2)
  for (let i = 0; i < lines.curveLineGeometry.length; i++) {
    flatGeometry[i * 2] = lines.curveLineGeometry[i]![0]!
    flatGeometry[i * 2 + 1] = lines.curveLineGeometry[i]![1]!
  }

  if (!lines.curveLineBuffer || lines.curveLineBuffer.byteLength !== flatGeometry.byteLength) {
    if (lines.curveLineBuffer && !lines.curveLineBuffer.destroyed) {
      lines.curveLineBuffer.destroy()
    }
    lines.curveLineBuffer = device.createBuffer({
      data: flatGeometry,
      usage: Buffer.VERTEX | Buffer.COPY_DST,
    })
  } else {
    lines.curveLineBuffer.write(flatGeometry)
  }

  // Update vertex count in model if it exists
  if (lines.drawCurveCommand) {
    lines.drawCurveCommand.setAttributes({
      position: lines.curveLineBuffer,
    })
    lines.drawCurveCommand.setVertexCount(lines.curveLineGeometry.length)
  }
  if (lines.drawCurveInstancedCommand) {
    lines.drawCurveInstancedCommand.setAttributes({
      position: lines.curveLineBuffer,
    })
    lines.drawCurveInstancedCommand.setVertexCount(lines.curveLineGeometry.length)
  }
  if (lines.drawCurveIndexCommand) {
    lines.drawCurveIndexCommand.setAttributes({
      position: lines.curveLineBuffer,
    })
    lines.drawCurveIndexCommand.setVertexCount(lines.curveLineGeometry.length)
  }
  if (lines.drawCulledCurveCommand) {
    lines.drawCulledCurveCommand.setAttributes({
      position: lines.curveLineBuffer,
    })
    lines.drawCulledCurveCommand.setVertexCount(lines.curveLineGeometry.length)
  }
}
