import type { Device, Texture } from '@luma.gl/core'
import type { WebGLDevice } from '@luma.gl/webgl'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'
import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'
import { createAtlasDataFromImageData } from '@/graph/modules/Points/atlas-utils'

export type PointAtlasState = {
  imageAtlasTexture: Texture | undefined;
  imageAtlasCoordsTexture: Texture | undefined;
  imageCount: number;
  imageAtlasCoordsTextureSize: number;
}

export function createPointImageAtlas (
  device: Device,
  data: GraphData,
  store: Store,
  state: PointAtlasState
): PointAtlasState {
  if (!data.inputImageData?.length) {
    return {
      imageCount: 0,
      imageAtlasCoordsTextureSize: 0,
      imageAtlasCoordsTexture: state.imageAtlasCoordsTexture || device.createTexture({
        data: new Float32Array(4).fill(0),
        width: 1,
        height: 1,
        format: 'rgba32float',
      }),
      imageAtlasTexture: state.imageAtlasTexture || device.createTexture({
        data: new Uint8Array(4).fill(0),
        width: 1,
        height: 1,
        format: 'rgba8unorm',
      }),
    }
  }

  const atlasResult = createAtlasDataFromImageData(data.inputImageData, store.webglMaxTextureSize)
  if (!atlasResult) {
    console.warn('Failed to create atlas from image data')
    return state
  }

  const { atlasData, atlasSize, atlasCoords, atlasCoordsSize } = atlasResult

  if (state.imageAtlasTexture && !state.imageAtlasTexture.destroyed) {
    state.imageAtlasTexture.destroy()
  }
  const imageAtlasTexture = device.createTexture({
    width: atlasSize,
    height: atlasSize,
    format: 'rgba8unorm',
    sampler: {
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    },
  })
  imageAtlasTexture.copyImageData({
    data: atlasData,
    bytesPerRow: getBytesPerRow('rgba8unorm', atlasSize),
    rowsPerImage: atlasSize,
    mipLevel: 0,
    x: 0,
    y: 0,
  })

  const rawGl = (device as WebGLDevice).gl as WebGL2RenderingContext | null
  const handle = (imageAtlasTexture as { handle?: WebGLTexture }).handle
  if (rawGl && handle) {
    rawGl.bindTexture(rawGl.TEXTURE_2D, handle)
    rawGl.generateMipmap(rawGl.TEXTURE_2D)
    rawGl.texParameteri(rawGl.TEXTURE_2D, rawGl.TEXTURE_MIN_FILTER, rawGl.LINEAR_MIPMAP_LINEAR)
    rawGl.texParameteri(rawGl.TEXTURE_2D, rawGl.TEXTURE_MAG_FILTER, rawGl.LINEAR)
    rawGl.bindTexture(rawGl.TEXTURE_2D, null)
  }

  if (state.imageAtlasCoordsTexture && !state.imageAtlasCoordsTexture.destroyed) {
    state.imageAtlasCoordsTexture.destroy()
  }
  const imageAtlasCoordsTexture = device.createTexture({
    width: atlasCoordsSize,
    height: atlasCoordsSize,
    format: 'rgba32float',
  })
  imageAtlasCoordsTexture.copyImageData({
    data: atlasCoords,
    bytesPerRow: getBytesPerRow('rgba32float', atlasCoordsSize),
    rowsPerImage: atlasCoordsSize,
    mipLevel: 0,
    x: 0,
    y: 0,
  })

  return {
    imageAtlasTexture,
    imageAtlasCoordsTexture,
    imageCount: data.inputImageData.length,
    imageAtlasCoordsTextureSize: atlasCoordsSize,
  }
}
