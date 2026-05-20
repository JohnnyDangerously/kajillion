import { Buffer, type BufferProps, type Device, Texture, type TextureProps } from '@luma.gl/core'

export type DestroyableResource = {
  destroyed?: boolean;
  destroy: () => void;
}

export type TextureCopyPayload = Parameters<Texture['copyImageData']>[0]

export const FULLSCREEN_QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])

export function destroyResource<T extends DestroyableResource | undefined> (resource: T): undefined {
  if (resource && resource.destroyed !== true) resource.destroy()
  return undefined
}

export function createFullscreenQuadBuffer (device: Device): Buffer {
  return device.createBuffer({ data: FULLSCREEN_QUAD_VERTICES })
}

export function writeOrCreateBuffer (
  device: Device,
  buffer: Buffer | undefined,
  data: NonNullable<BufferProps['data']>,
  usage: number
): Buffer {
  if (!buffer || buffer.destroyed || buffer.byteLength !== data.byteLength) {
    destroyResource(buffer)
    return device.createBuffer({ data, usage })
  }
  buffer.write(data)
  return buffer
}

export function writeOrCreateTexture (
  device: Device,
  texture: Texture | undefined,
  props: TextureProps,
  copyPayload: TextureCopyPayload
): Texture {
  const needsTexture = !texture ||
    texture.destroyed ||
    texture.width !== props.width ||
    texture.height !== props.height

  if (!needsTexture) {
    texture.copyImageData(copyPayload)
    return texture
  }
  destroyResource(texture)
  const nextTexture = device.createTexture(props)
  nextTexture.copyImageData(copyPayload)
  return nextTexture
}
