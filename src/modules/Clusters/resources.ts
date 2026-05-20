import { Texture } from '@luma.gl/core'
import type { Device, Framebuffer } from '@luma.gl/core'

import { getBytesPerRow } from '@/graph/modules/Shared/texture-utils'

import { createClusterTextureState } from './state'

export type ClusterGpuResources = {
  clusterTexture: Texture;
  clusterPositionsTexture: Texture;
  clusterForceCoefficientTexture: Texture;
  centermassTexture: Texture;
  centermassFbo: Framebuffer | undefined;
}

export function createOrUpdateClusterGpuResources (options: {
  device: Device;
  pointsTextureSize: number;
  clustersTextureSize: number;
  clusterCount: number;
  pointsNumber: number;
  pointClusters: (number | undefined)[] | undefined;
  clusterPositionValues: (number | undefined)[] | undefined;
  clusterStrength: Float32Array | undefined;
  sizesChanged: boolean;
  previousClustersTextureSize: number | undefined;
  clusterTexture: Texture | undefined;
  clusterPositionsTexture: Texture | undefined;
  clusterForceCoefficientTexture: Texture | undefined;
  centermassTexture: Texture | undefined;
  centermassFbo: Framebuffer | undefined;
}): ClusterGpuResources {
  const {
    clusterState,
    clusterPositions,
    clusterForceCoefficient,
  } = createClusterTextureState({
    pointsTextureSize: options.pointsTextureSize,
    clustersTextureSize: options.clustersTextureSize,
    clusterCount: options.clusterCount,
    pointsNumber: options.pointsNumber,
    pointClusters: options.pointClusters,
    clusterPositions: options.clusterPositionValues,
    clusterStrength: options.clusterStrength,
  })

  const centermassTarget = createOrClearCentermassTarget({
    device: options.device,
    texture: options.centermassTexture,
    framebuffer: options.centermassFbo,
    shouldRecreate: options.previousClustersTextureSize !== options.clustersTextureSize,
    textureSize: options.clustersTextureSize,
    textureDataSize: options.clustersTextureSize * options.clustersTextureSize * 4,
  })

  return {
    clusterTexture: createOrUpdateRgba32FloatTexture({
      device: options.device,
      texture: options.clusterTexture,
      shouldRecreate: options.sizesChanged,
      width: options.pointsTextureSize,
      height: options.pointsTextureSize,
      data: clusterState,
    }),
    clusterPositionsTexture: createOrUpdateRgba32FloatTexture({
      device: options.device,
      texture: options.clusterPositionsTexture,
      shouldRecreate: options.sizesChanged,
      width: options.clustersTextureSize,
      height: options.clustersTextureSize,
      data: clusterPositions,
    }),
    clusterForceCoefficientTexture: createOrUpdateRgba32FloatTexture({
      device: options.device,
      texture: options.clusterForceCoefficientTexture,
      shouldRecreate: options.sizesChanged,
      width: options.pointsTextureSize,
      height: options.pointsTextureSize,
      data: clusterForceCoefficient,
    }),
    centermassTexture: centermassTarget.texture,
    centermassFbo: centermassTarget.framebuffer,
  }
}

export function createOrUpdateRgba32FloatTexture (options: {
  device: Device;
  texture: Texture | undefined;
  shouldRecreate: boolean;
  width: number;
  height: number;
  data: Float32Array;
}): Texture {
  if (!options.texture || options.shouldRecreate) {
    if (options.texture && !options.texture.destroyed) {
      options.texture.destroy()
    }
    const texture = options.device.createTexture({
      width: options.width,
      height: options.height,
      format: 'rgba32float',
      usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
    })
    copyRgba32FloatTexture(texture, options.data, options.width)
    return texture
  }

  copyRgba32FloatTexture(options.texture, options.data, options.width)
  return options.texture
}

export function createOrClearCentermassTarget (options: {
  device: Device;
  texture: Texture | undefined;
  framebuffer: Framebuffer | undefined;
  shouldRecreate: boolean;
  textureSize: number;
  textureDataSize: number;
}): {
  texture: Texture;
  framebuffer: Framebuffer | undefined;
} {
  const zeroData = new Float32Array(options.textureDataSize).fill(0)

  if (!options.texture || options.shouldRecreate) {
    if (options.framebuffer && !options.framebuffer.destroyed) {
      options.framebuffer.destroy()
    }
    if (options.texture && !options.texture.destroyed) {
      options.texture.destroy()
    }
    const texture = options.device.createTexture({
      width: options.textureSize,
      height: options.textureSize,
      format: 'rgba32float',
      usage: Texture.SAMPLE | Texture.RENDER | Texture.COPY_DST,
    })
    copyRgba32FloatTexture(texture, zeroData, options.textureSize)

    return {
      texture,
      framebuffer: options.device.createFramebuffer({
        width: options.textureSize,
        height: options.textureSize,
        colorAttachments: [texture],
      }),
    }
  }

  copyRgba32FloatTexture(options.texture, zeroData, options.textureSize)
  return {
    texture: options.texture,
    framebuffer: options.framebuffer,
  }
}

export function destroyTextureIfAlive (texture: Texture | undefined): void {
  if (texture && !texture.destroyed) {
    texture.destroy()
  }
}

function copyRgba32FloatTexture (texture: Texture, data: Float32Array, width: number): void {
  texture.copyImageData({
    data,
    bytesPerRow: getBytesPerRow('rgba32float', width),
    mipLevel: 0,
    x: 0,
    y: 0,
  })
}
