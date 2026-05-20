import { Texture, type Device } from '@luma.gl/core'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'

export interface LinkStatusTextureState {
  texture: Texture | undefined;
  textureSize: number;
}

export interface UpdateLinkStatusTextureOptions extends LinkStatusTextureState {
  device: Device;
  linksNumber: number;
  highlightedLinkIndices: number[] | undefined;
}

export function ensureLinkStatusPlaceholderTexture (
  device: Device,
  state: LinkStatusTextureState
): LinkStatusTextureState {
  if (state.texture && !state.texture.destroyed) {
    return {
      texture: state.texture,
      textureSize: 0,
    }
  }

  return {
    texture: device.createTexture({
      width: 1,
      height: 1,
      format: 'rgba32float',
      usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
      data: new Float32Array(4).fill(0),
    }),
    textureSize: 0,
  }
}

export function updateLinkStatusTexture (
  options: UpdateLinkStatusTextureOptions
): LinkStatusTextureState {
  const {
    device,
    linksNumber,
    highlightedLinkIndices,
  } = options

  // Keep a valid binding for the linkStatus sampler. luma.gl skips draws when
  // a declared sampler is unbound, even when uniforms keep the shader branch off.
  if (!linksNumber) {
    if (options.texture && !options.texture.destroyed) {
      return {
        texture: options.texture,
        textureSize: options.textureSize,
      }
    }
    return ensureLinkStatusPlaceholderTexture(device, options)
  }

  if (highlightedLinkIndices === undefined) {
    return ensureLinkStatusPlaceholderTexture(device, options)
  }

  const textureSize = Math.ceil(Math.sqrt(linksNumber))
  const state = new Float32Array(textureSize * textureSize * 4)

  for (let i = 0; i < linksNumber; i++) {
    state[i * 4] = 1
  }
  for (const idx of highlightedLinkIndices) {
    if (idx >= 0 && idx < linksNumber) {
      state[idx * 4] = 0
    }
  }

  const copyData = {
    data: state,
    bytesPerRow: getBytesPerRow('rgba32float', textureSize),
    mipLevel: 0,
    x: 0,
    y: 0,
  }

  let texture = options.texture
  if (!texture || texture.width !== textureSize || texture.height !== textureSize) {
    if (texture && !texture.destroyed) {
      texture.destroy()
    }
    texture = device.createTexture({
      width: textureSize,
      height: textureSize,
      format: 'rgba32float',
      usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
    })
  }

  texture.copyImageData(copyData)
  return {
    texture,
    textureSize,
  }
}
