import { Texture } from '@luma.gl/core'
import type { Lines } from '@/graph/modules/Lines/renderer/lines'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'

export function updateLinkIndexFramebuffer (lines: Lines): void {
  const { device, store } = lines

  if (device.info?.type === 'webgpu') return

  // Only create and update the link index FBO if link hovering is enabled
  if (!lines.store.isLinkHoveringEnabled) return

  const screenSize = store.screenSize ?? [0, 0]
  const screenWidth = screenSize[0]
  const screenHeight = screenSize[1]

  // Avoid invalid uploads when size is zero
  if (!screenWidth || !screenHeight) return

  // Check if screen size changed
  const screenSizeChanged =
    lines.previousScreenSize?.[0] !== screenWidth ||
    lines.previousScreenSize?.[1] !== screenHeight

  if (!lines.linkIndexTexture || screenSizeChanged) {
    // Destroy old framebuffer and texture if they exist
    if (lines.linkIndexFbo && !lines.linkIndexFbo.destroyed) {
      lines.linkIndexFbo.destroy()
    }
    if (lines.linkIndexTexture && !lines.linkIndexTexture.destroyed) {
      lines.linkIndexTexture.destroy()
    }

    // Create new texture
    lines.linkIndexTexture = device.createTexture({
      width: screenWidth,
      height: screenHeight,
      format: 'rgba32float',
      usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
    })
    lines.linkIndexTexture.copyImageData({
      data: new Float32Array(screenWidth * screenHeight * 4).fill(0),
      bytesPerRow: getBytesPerRow('rgba32float', screenWidth),
      mipLevel: 0,
      x: 0,
      y: 0,
    })

    // Create new framebuffer
    lines.linkIndexFbo = device.createFramebuffer({
      width: screenWidth,
      height: screenHeight,
      colorAttachments: [lines.linkIndexTexture],
    })

    lines.previousScreenSize = [screenWidth, screenHeight]
  }
}
