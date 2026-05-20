import type { Buffer, RenderPass, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { LineInstancePrecomputePass } from '@/graph/modules/Lines/passes/precompute/line-instance-pass'
import type { VisibleLineCullingPass } from '@/graph/modules/Lines/passes/visible-culling/visible-line-culling-pass'
import type { LineDrawUniformStoreShape } from './contracts'

interface LineDrawAttributeBuffers {
  pointABuffer: Buffer | undefined;
  pointBBuffer: Buffer | undefined;
  colorBuffer: Buffer | undefined;
  widthBuffer: Buffer | undefined;
  arrowBuffer: Buffer | undefined;
}

interface DrawPrecomputedLinesOptions extends LineDrawAttributeBuffers {
  pass: LineInstancePrecomputePass;
  renderPass: RenderPass;
  command: Model | undefined;
  uniformStore: UniformStore<LineDrawUniformStoreShape> | undefined;
  hasHighlighting: boolean;
  linkIndexBuffer: Buffer | undefined;
}

export function drawPrecomputedLines (
  options: DrawPrecomputedLinesOptions
): boolean {
  const {
    pass,
    renderPass,
    command,
    uniformStore,
    hasHighlighting,
    pointABuffer,
    pointBBuffer,
    colorBuffer,
    widthBuffer,
    arrowBuffer,
    linkIndexBuffer,
  } = options

  return pass.draw(
    renderPass,
    command,
    uniformStore,
    hasHighlighting,
    pointABuffer,
    pointBBuffer,
    colorBuffer,
    widthBuffer,
    arrowBuffer,
    linkIndexBuffer
  )
}

interface DrawCulledLinesIndirectOptions extends LineDrawAttributeBuffers {
  pass: VisibleLineCullingPass;
  renderPass: RenderPass;
  command: Model | undefined;
  uniformStore: UniformStore<LineDrawUniformStoreShape> | undefined;
  linkStatusTexture: Texture | undefined;
}

export function drawCulledLinesIndirect (
  options: DrawCulledLinesIndirectOptions
): boolean {
  const {
    pass,
    renderPass,
    command,
    uniformStore,
    linkStatusTexture,
    pointABuffer,
    pointBBuffer,
    colorBuffer,
    widthBuffer,
    arrowBuffer,
  } = options

  return pass.draw(
    renderPass,
    command,
    uniformStore,
    linkStatusTexture,
    pointABuffer,
    pointBBuffer,
    colorBuffer,
    widthBuffer,
    arrowBuffer
  )
}
