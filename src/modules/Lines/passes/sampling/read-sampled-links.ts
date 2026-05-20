import type { Device, Framebuffer, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { FillSampledLinksUniforms, FillSampledLinksUniformStoreShape } from './contracts'

export type SampledLinkRecord = {
  index: number;
  x: number;
  y: number;
  angle: number;
}

export type RenderSampledLinksGridOptions = {
  device: Device;
  framebuffer: Framebuffer;
  command: Model | undefined;
  uniformStore: UniformStore<FillSampledLinksUniformStoreShape> | undefined;
  positionsTexture: Texture;
  linksNumber: number;
  uniforms: FillSampledLinksUniforms;
}

export function renderSampledLinksGrid ({
  device,
  framebuffer,
  command,
  uniformStore,
  positionsTexture,
  linksNumber,
  uniforms,
}: RenderSampledLinksGridOptions): void {
  if (!command || !uniformStore) return

  command.setVertexCount(linksNumber)
  uniformStore.setUniforms({
    fillSampledLinksUniforms: uniforms,
  })
  command.setBindings({
    positionsTexture,
  })

  const fillPass = device.beginRenderPass({
    framebuffer,
    clearColor: [-1, -1, -1, -1],
  })
  command.draw(fillPass)
  fillPass.end()
}

export function decodeSampledLinkPixels (pixels: Float32Array): SampledLinkRecord[] {
  const records: SampledLinkRecord[] = []
  for (let i = 0; i < pixels.length / 4; i++) {
    const index = pixels[i * 4]
    const x = pixels[i * 4 + 1]
    const y = pixels[i * 4 + 2]
    const angle = pixels[i * 4 + 3]

    if (index !== undefined && index >= 0 && x !== undefined && y !== undefined && angle !== undefined) {
      records.push({
        index: Math.round(index),
        x,
        y,
        angle,
      })
    }
  }
  return records
}
